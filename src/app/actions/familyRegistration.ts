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

  // user.id 또는 email로 participant 조회
  const { data: participant } = await admin
    .from('participants')
    .select('id')
    .or(`id.eq.${user.id},email.eq.${user.email}`)
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

  const { data: existing } = await admin
    .from('family_registrations')
    .select('image_url')
    .eq('participant_id', participant.id)
    .maybeSingle()

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${participant.id}/${Date.now()}-family-relation.${ext}`
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
      participant_id: participant.id,
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

  return { success: true }
}