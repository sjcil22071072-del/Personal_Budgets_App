'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/utils/supabase/server'
import { extractStoragePath } from '@/utils/supabase/storage'

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

  // user.id 또는 email로 participants 조회
  const { data: participant } = await admin
    .from('participants')
    .select('id')
    .or(`id.eq.${user.id},email.eq.${user.email}`)
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
    const path = `${participant.id}/${Date.now()}-${index}.${ext}`
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
      participant_id: participant.id,
      image_urls: imageUrls,
    })

  if (error) {
    console.error('Card registration insert error:', error)
    return { success: false, error: '카드 등록에 실패했습니다.' }
  }

  revalidatePath('/')
  revalidatePath('/card-registration')

  return { success: true }
}

export async function deleteCardRegistration(id: string) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: '로그인이 필요합니다.' }

    // 사용자 권한 확인 (관리자이거나 해당 카드 등록의 당사자인지 검증)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = String(profile?.role ?? '').trim().toLowerCase()
    const isAdminOrStaff = role === 'admin' || role === 'superadmin' || role === 'super_admin'

    const { data: cardReg } = await admin
      .from('card_registrations')
      .select('participant_id, image_urls')
      .eq('id', id)
      .maybeSingle()

    if (!cardReg) {
      return { success: false, error: '존재하지 않는 카드 등록 정보입니다.' }
    }

    // 본인의 카드이거나 관리자여야 삭제 가능
    if (!isAdminOrStaff && cardReg.participant_id !== user.id) {
      const { data: participant } = await admin
        .from('participants')
        .select('id')
        .eq('email', user.email || '')
        .maybeSingle()

      if (!participant || cardReg.participant_id !== participant.id) {
        return { success: false, error: '삭제 권한이 없습니다.' }
      }
    }

    // 1. Storage에서 이미지 삭제
    if (cardReg.image_urls && cardReg.image_urls.length > 0) {
      const paths = cardReg.image_urls
        .map((url: string) => extractStoragePath(url, CARD_IMAGE_BUCKET))
        .filter((path: string | null): path is string => !!path)

      if (paths.length > 0) {
        const { error: storageError } = await admin.storage
          .from(CARD_IMAGE_BUCKET)
          .remove(paths)
        if (storageError) {
          console.error('Failed to delete card photos from storage:', storageError)
        }
      }
    }

    // 2. DB에서 레코드 삭제
    const { error: dbError } = await admin
      .from('card_registrations')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.error('Failed to delete card registration from DB:', dbError)
      return { success: false, error: '카드 등록 정보 삭제에 실패했습니다.' }
    }

    revalidatePath('/')
    revalidatePath('/card-registration')
    revalidatePath('/admin/submitted-documents')

    return { success: true }
  } catch (e: any) {
    console.error('deleteCardRegistration exception:', e)
    return { success: false, error: e?.message || '카드 삭제 중 오류가 발생했습니다.' }
  }
}