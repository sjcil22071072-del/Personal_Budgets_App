'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { isStaffRole } from '@/utils/user-role'

/**
 * 클라이언트 직접 업로드용 서명 URL 발급
 * 파일은 브라우저 → Supabase Storage로 직접 전송 (Vercel body limit 우회)
 */
export async function getDocumentUploadUrl(
  participantId: string,
  originalFileName: string,
): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 역할 확인 (RLS 우회를 위해 adminClient 사용)
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[getDocumentUploadUrl] Profile fetch error:', profileError)
    return { error: `프로필 조회 중 오류가 발생했습니다: ${profileError.message} (코드: ${profileError.code})` }
  }

  if (!profile) {
    console.warn('[getDocumentUploadUrl] Profile not found for user:', user.id)
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  if (!isStaffRole(profile.role)) {
    console.warn('[getDocumentUploadUrl] Insufficient permissions. Role:', profile.role, 'User:', user.id)
    return { error: '권한이 없습니다.' }
  }

  // Storage 경로는 ASCII만 허용 — 확장자만 추출하고 타임스탬프로 고유성 보장
  const ext = (originalFileName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const filePath = `${participantId}/${Date.now()}${ext ? '.' + ext : ''}`

  const { data, error } = await admin.storage
    .from('documents')
    .createSignedUploadUrl(filePath)

  if (error) return { error: '업로드 URL 생성 실패: ' + error.message }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path }
}

/**
 * 클라이언트 직접 업로드 완료 후 DB 레코드 저장
 */
export async function saveDocumentRecord(
  participantId: string,
  title: string,
  fileType: string,
  filePath: string,
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 서버가 발급한 경로 형식인지 검증 (경로 위변조 방지)
  // 형식: {participantId}/{timestamp}.{ext}
  const expectedPrefix = `${participantId}/`
  if (!filePath.startsWith(expectedPrefix) || filePath.includes('..') || /[^a-zA-Z0-9/_.-]/.test(filePath)) {
    return { error: '잘못된 파일 경로입니다.' }
  }

  const admin = createAdminClient()

  // 역할 확인 (RLS 우회를 위해 adminClient 사용)
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[saveDocumentRecord] Profile fetch error:', profileError)
    return { error: `프로필 조회 중 오류가 발생했습니다: ${profileError.message} (코드: ${profileError.code})` }
  }

  if (!profile) {
    console.warn('[saveDocumentRecord] Profile not found for user:', user.id)
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  if (!isStaffRole(profile.role)) {
    console.warn('[saveDocumentRecord] Insufficient permissions. Role:', profile.role, 'User:', user.id)
    return { error: '권한이 없습니다.' }
  }

  const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

  const { error } = await admin.from('file_links').insert({
    participant_id: participantId,
    title,
    url: publicUrl,
    file_type: fileType,
  })

  if (error) return { error: 'DB 저장 실패: ' + error.message }

  revalidatePath('/supporter/documents')
  return { success: true }
}

export async function uploadDocument(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  try {
    // 인증 확인은 사용자 세션 클라이언트로
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: '로그인이 필요합니다.' }

    const admin = createAdminClient()

    // 역할 확인 (RLS 우회를 위해 adminClient 사용)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[uploadDocument] Profile fetch error:', profileError)
      return { error: `프로필 조회 중 오류가 발생했습니다: ${profileError.message} (코드: ${profileError.code})` }
    }

    if (!profile) {
      console.warn('[uploadDocument] Profile not found for user:', user.id)
      return { error: '프로필을 찾을 수 없습니다.' }
    }

    if (!isStaffRole(profile.role)) {
      console.warn('[uploadDocument] Insufficient permissions. Role:', profile.role, 'User:', user.id)
      return { error: '권한이 없습니다.' }
    }

    const participantId = formData.get('participant_id') as string
    const title = formData.get('title') as string
    const fileType = formData.get('file_type') as string
    const file = formData.get('file') as File | null
    const externalUrl = formData.get('url') as string

    const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

    let finalUrl = externalUrl

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return { error: `파일 용량이 20MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)` }
      }

      const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const fileName = `${participantId}/${Date.now()}${ext ? '.' + ext : ''}`
      const mimeMap: Record<string, string> = {
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls:  'application/vnd.ms-excel',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc:  'application/msword',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ppt:  'application/vnd.ms-powerpoint',
        pdf:  'application/pdf',
        csv:  'text/csv',
        txt:  'text/plain',
        png:  'image/png',
        jpg:  'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        heic: 'image/heic',
        heif: 'image/heif',
      }
      const contentType = file.type || mimeMap[ext] || 'application/octet-stream'

      // File 객체를 Buffer로 변환 (서버 환경에서 비이미지 파일의 스트리밍 문제 방지)
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: uploadError } = await admin.storage
        .from('documents')
        .upload(fileName, buffer, { upsert: true, contentType })

      if (uploadError) {
        return { error: `파일 업로드 실패 [${uploadError.message}] (파일: ${file.name}, 타입: ${contentType}, 크기: ${file.size}B)` }
      }

      const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(fileName)
      finalUrl = publicUrl
    }

    if (!finalUrl) return { error: '파일 또는 링크를 입력해주세요.' }

    const { error } = await admin.from('file_links').insert({
      participant_id: participantId,
      title,
      url: finalUrl,
      file_type: fileType,
    })

    if (error) return { error: 'DB 저장 실패: ' + error.message }

    revalidatePath('/supporter/documents')
    return { success: true }
  } catch (err: any) {
    console.error('[uploadDocument] Exception:', err)
    return { error: '서버 내부 오류: ' + (err.message || String(err)) }
  }
}

export async function deleteDocument(id: string): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: '로그인이 필요합니다.' }

    const admin = createAdminClient()

    // 역할 확인 (RLS 우회를 위해 adminClient 사용)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[deleteDocument] Profile fetch error:', profileError)
      return { error: `프로필 조회 중 오류가 발생했습니다: ${profileError.message} (코드: ${profileError.code})` }
    }

    if (!profile) {
      console.warn('[deleteDocument] Profile not found for user:', user.id)
      return { error: '프로필을 찾을 수 없습니다.' }
    }

    if (!isStaffRole(profile.role)) {
      console.warn('[deleteDocument] Insufficient permissions. Role:', profile.role, 'User:', user.id)
      return { error: '권한이 없습니다.' }
    }

    const { error } = await admin.from('file_links').delete().eq('id', id)
    if (error) return { error: 'DB 삭제 실패: ' + error.message }

    revalidatePath('/supporter/documents')
    return { success: true }
  } catch (err: any) {
    console.error('[deleteDocument] Exception:', err)
    return { error: '서버 내부 오류: ' + (err.message || String(err)) }
  }
}
