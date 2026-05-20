'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/utils/supabase/server'

const CARD_IMAGE_BUCKET = 'card-photos'

export interface CardRegistration {
  id: string
  participant_id: string
  image_urls: string[]
  created_at: string
  participant?: { name?: string } | null
}

export async function createCardRegistration(formData: FormData) {
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
    return { success: false, error: '당사자 계정에서만 카드 등록을 할 수 있습니다.' }
  }

  const files = formData
    .getAll('card_images')
    .filter((item): item is File => item instanceof File && item.size > 0)

  if (files.length < 2) {
    return { success: false, error: '실물 카드의 앞뒷면을 모두 등록해주세요.' }
  }

  const imageUrls: string[] = []

  for (const [index, file] of files.entries()) {
    if (!file.type.startsWith('image/')) {
      return { success: false, error: '카드 사진은 이미지 파일만 등록할 수 있습니다.' }
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/${Date.now()}-${index}.${ext}`
    const { error: uploadError } = await admin.storage
      .from(CARD_IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Card image upload error:', uploadError)
      return { success: false, error: '카드 사진 업로드에 실패했습니다.' }
    }

    const { data: { publicUrl } } = admin.storage
      .from(CARD_IMAGE_BUCKET)
      .getPublicUrl(path)
    imageUrls.push(publicUrl)
  }

  const { error } = await admin
    .from('card_registrations')
    .insert({
      participant_id: user.id,
      image_urls: imageUrls,
    })

  if (error) {
    console.error('Card registration insert error:', error)
    return { success: false, error: '카드 등록에 실패했습니다.' }
  }

  revalidatePath('/')
  revalidatePath('/card-registration')
  revalidatePath('/supporter/evaluations')
  revalidatePath('/supporter/documents')

  return { success: true }
}
