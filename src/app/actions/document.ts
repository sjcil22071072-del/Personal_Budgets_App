'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * ?�라?�언??직접 ?�로?�용 ?�명 URL 발급
 * ?�일?� 브라?��? ??Supabase Storage�?직접 ?�송 (Vercel body limit ?�회)
 */
export async function getDocumentUploadUrl(
  participantId: string,
  originalFileName: string,
): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그?�이 ?�요?�니??' }

  // ??�� ?�인 + supporter??경우 ?�당 참여?�만 ?�근 ?�용
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { error: '권한???�습?�다.' }
  }

  if (profile.role === 'supporter') {
    const { data: assigned } = await supabase
      .from('participants')
      .select('id')
      .eq('id', participantId)
      .eq('assigned_supporter_id', user.id)
      .single()
    if (!assigned) return { error: '?�당 참여?�에 ?�???�근 권한???�습?�다.' }
  }

  const admin = createAdminClient()
  // Storage 경로??ASCII�??�용 ???�장?�만 추출?�고 ?�?�스?�프�?고유??보장
  const ext = (originalFileName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const filePath = `${participantId}/${Date.now()}${ext ? '.' + ext : ''}`

  const { data, error } = await admin.storage
    .from('documents')
    .createSignedUploadUrl(filePath)

  if (error) return { error: '?�로??URL ?�성 ?�패: ' + error.message }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path }
}

/**
 * ?�라?�언??직접 ?�로???�료 ??DB ?�코???�??
 */
export async function saveDocumentRecord(
  participantId: string,
  title: string,
  fileType: string,
  filePath: string,
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그?�이 ?�요?�니??' }

  // ?�버가 발급??경로 ?�식?��? 검�?(경로 ?��?�?방�?)
  // ?�식: {participantId}/{timestamp}.{ext}
  const expectedPrefix = `${participantId}/`
  if (!filePath.startsWith(expectedPrefix) || filePath.includes('..') || /[^a-zA-Z0-9/_.-]/.test(filePath)) {
    return { error: '?�못???�일 경로?�니??' }
  }

  const admin = createAdminClient()
  const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

  const { error } = await admin.from('file_links').insert({
    participant_id: participantId,
    title,
    url: publicUrl,
    file_type: fileType,
  })

  if (error) return { error: 'DB ?�???�패: ' + error.message }

  revalidatePath('/supporter/documents')
  return { success: true }
}

export async function uploadDocument(formData: FormData) {
  // ?�증 ?�인?� ?�용???�션 ?�라?�언?�로
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그?�이 ?�요?�니??')

  const participantId = formData.get('participant_id') as string
  const title = formData.get('title') as string
  const fileType = formData.get('file_type') as string
  const file = formData.get('file') as File | null
  const externalUrl = formData.get('url') as string

  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

  let finalUrl = externalUrl

  // Storage ?�로?�·DB ?�기???�비??�??�라?�언???�용 (RLS ?�회)
  const admin = createAdminClient()

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`?�일 ?�량??20MB�?초과?�니?? (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
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

    // File 객체�?Buffer�?변??(?�버 ?�경?�서 비이미�? ?�일???�트리밍 문제 방�?)
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(fileName, buffer, { upsert: true, contentType })

    if (uploadError) {
      throw new Error(`?�일 ?�로???�패 [${uploadError.message}] (?�일: ${file.name}, ?�?? ${contentType}, ?�기: ${file.size}B)`)
    }

    const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(fileName)
    finalUrl = publicUrl
  }

  if (!finalUrl) throw new Error('?�일 ?�는 링크�??�력?�주?�요.')

  const { error } = await admin.from('file_links').insert({
    participant_id: participantId,
    title,
    url: finalUrl,
    file_type: fileType,
  })

  if (error) throw new Error('DB ?�???�패: ' + error.message)

  revalidatePath('/supporter/documents')
  return { success: true }
}

export async function deleteDocument(id: string) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') throw new Error('?�모 모드?�서????��?????�습?�다.')

  const admin = createAdminClient()

  const { error } = await admin.from('file_links').delete().eq('id', id)
  if (error) throw error

  revalidatePath('/supporter/documents')
  return { success: true }
}
