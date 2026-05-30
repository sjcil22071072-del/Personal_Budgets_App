'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/utils/supabase/server'
import { extractStoragePath } from '@/utils/supabase/storage'

const BUCKET_NAME = 'family-relation-photos'

export interface FamilyRegistration {
  id: string
  participant_id: string
  image_url: string
  created_at: string
  updated_at: string
}

export async function getFamilyRegistration() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // user.id 또는 email로 participant 조회
  const { data: participant } = await admin
    .from('participants')
    .select('id')
    .or(`id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle()

  if (!participant) return null

  const { data, error } = await admin
    .from('family_registrations')
    .select('*')
    .eq('participant_id', participant.id)
    .maybeSingle()

  if (error) {
    console.error('getFamilyRegistration error:', error)
    return null
  }

  return data as FamilyRegistration | null
}

export async function saveFamilyRegistration(formData: FormData) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = String(profile?.role ?? '').trim().toLowerCase()
  const isAdminOrStaff = role === 'admin' || role === 'superadmin' || role === 'super_admin'

  let participantId = formData.get('participant_id') as string | null

  if (isAdminOrStaff && participantId) {
    // 관리자 또는 스태프인 경우, 입력받은 participantId를 사용합니다.
  } else {
    const { data: participant } = await admin
      .from('participants')
      .select('id')
      .or(`id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle()

    if (!participant) {
      return { success: false, error: '당사자 계정에서만 가족관계증명서를 등록할 수 있습니다.' }
    }
    participantId = participant.id
  }

  const file = formData.get('family_relation_photo') as File | null
  if (!file || file.size === 0) {
    return { success: false, error: '등록할 증명서 사진 파일을 선택해 주세요.' }
  }

  if (!file.type.startsWith('image/')) {
    return { success: false, error: '이미지 파일만 등록할 수 있습니다.' }
  }

  const { data: existing } = await admin
    .from('family_registrations')
    .select('image_url')
    .eq('participant_id', participantId)
    .maybeSingle()

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${participantId}/${Date.now()}-family-relation.${ext}`
  const { error: uploadError } = await admin.storage
    .from(BUCKET_NAME)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('Family relation photo upload error:', uploadError)
    return { success: false, error: '사진 업로드에 실패했습니다.' }
  }

  const { data: { publicUrl } } = admin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path)

  const { error: dbError } = await admin
    .from('family_registrations')
    .upsert({
      participant_id: participantId,
      image_url: publicUrl,
      updated_at: new Date().toISOString()
    }, { onConflict: 'participant_id' })

  if (dbError) {
    console.error('Family registration save error:', dbError)
    await admin.storage.from(BUCKET_NAME).remove([path])
    return { success: false, error: '증명서 저장에 실패했습니다.' }
  }

  if (existing?.image_url) {
    const marker = `/object/public/${BUCKET_NAME}/`
    const idx = existing.image_url.indexOf(marker)
    if (idx !== -1) {
      const oldPath = existing.image_url.slice(idx + marker.length)
      await admin.storage.from(BUCKET_NAME).remove([oldPath])
    }
  }

  revalidatePath('/')
  revalidatePath('/family-registration')
  revalidatePath('/admin/submitted-documents')

  return { success: true }
}

export async function deleteFamilyRegistration(participantId: string) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: '로그인이 필요합니다.' }

    // 사용자 권한 확인 (관리자이거나 해당 당사자 본인인지 검증)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = String(profile?.role ?? '').trim().toLowerCase()
    const isAdminOrStaff = role === 'admin' || role === 'superadmin' || role === 'super_admin'

    // 본인이거나 관리자여야 함
    if (!isAdminOrStaff && participantId !== user.id) {
      const { data: participant } = await admin
        .from('participants')
        .select('id')
        .eq('email', user.email || '')
        .maybeSingle()

      if (!participant || participantId !== participant.id) {
        return { success: false, error: '삭제 권한이 없습니다.' }
      }
    }

    const { data: existing } = await admin
      .from('family_registrations')
      .select('image_url')
      .eq('participant_id', participantId)
      .maybeSingle()

    if (!existing) {
      return { success: false, error: '존재하지 않는 가족관계증명서 정보입니다.' }
    }

    // 1. Storage에서 이미지 삭제
    if (existing.image_url) {
      const path = extractStoragePath(existing.image_url, BUCKET_NAME)
      if (path) {
        const { error: storageError } = await admin.storage
          .from(BUCKET_NAME)
          .remove([path])
        if (storageError) {
          console.error('Failed to delete family relation photo from storage:', storageError)
        }
      }
    }

    // 2. DB에서 레코드 삭제
    const { error: dbError } = await admin
      .from('family_registrations')
      .delete()
      .eq('participant_id', participantId)

    if (dbError) {
      console.error('Failed to delete family registration from DB:', dbError)
      return { success: false, error: '증명서 정보 삭제에 실패했습니다.' }
    }

    revalidatePath('/')
    revalidatePath('/family-registration')
    revalidatePath('/admin/submitted-documents')

    return { success: true }
  } catch (e: any) {
    console.error('deleteFamilyRegistration exception:', e)
    return { success: false, error: e?.message || '증명서 삭제 중 오류가 발생했습니다.' }
  }
}