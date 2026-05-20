'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/utils/supabase/server'

const BUCKET_NAME = 'family-relation-photos'

export interface FamilyRegistration {
  id: string
  participant_id: string
  image_url: string
  created_at: string
  updated_at: string
}

/**
 * 로그인한 당사자의 가족관계증명서 등록 내역을 조회합니다.
 */
export async function getFamilyRegistration() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await admin
    .from('family_registrations')
    .select('*')
    .eq('participant_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('getFamilyRegistration error:', error)
    return null
  }

  return data as FamilyRegistration | null
}

/**
 * 가족관계증명서를 등록하거나 수정(업데이트)합니다.
 */
export async function saveFamilyRegistration(formData: FormData) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  const { data: participant } = await admin
    .from('participants')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!participant) {
    return { success: false, error: '당사자 계정에서만 가족관계증명서를 등록할 수 있습니다.' }
  }

  const file = formData.get('family_relation_photo') as File | null
  if (!file || file.size === 0) {
    return { success: false, error: '등록할 증명서 사진 파일을 선택해 주세요.' }
  }

  if (!file.type.startsWith('image/')) {
    return { success: false, error: '이미지 파일만 등록할 수 있습니다.' }
  }

  // 1. 기존 데이터가 있는지 확인 (기존 파일 삭제 목적)
  const { data: existing } = await admin
    .from('family_registrations')
    .select('image_url')
    .eq('participant_id', user.id)
    .maybeSingle()

  // 2. 새 이미지 업로드
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${user.id}/${Date.now()}-family-relation.${ext}`
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

  // 3. DB upsert
  const { error: dbError } = await admin
    .from('family_registrations')
    .upsert({
      participant_id: user.id,
      image_url: publicUrl,
      updated_at: new Date().toISOString()
    }, { onConflict: 'participant_id' })

  if (dbError) {
    console.error('Family registration save error:', dbError)
    // 업로드한 파일 롤백 삭제
    await admin.storage.from(BUCKET_NAME).remove([path])
    return { success: false, error: '증명서 저장에 실패했습니다.' }
  }

  // 4. 기존 파일이 존재했을 경우 스토리지에서 구 파일 삭제
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
  revalidatePath('/supporter/evaluations')
  revalidatePath('/supporter/documents')

  return { success: true }
}
