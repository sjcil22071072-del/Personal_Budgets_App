'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { extractStoragePath } from '@/utils/supabase/storage'

const SIGNED_URL_EXPIRES = 3600 // 1?�간
const EASY_READ_IMAGE_MAX_BYTES = 2 * 1024 * 1024 // 2MB

/**
 * ?�랜??�� 목록???�수증·활?�사�?URL??signed URL�??�괄 변?�합?�다.
 * receipts, activity-photos 버킷??private(public=false)?????�용?�니??
 *
 * @param items - { id, receiptUrl, activityUrl } 배열
 * @returns id ??{ receipt?, activity? } 매핑
 */
export async function getSignedImageUrls(
  items: { id: string; receiptUrl: string | null; activityUrl: string | null }[]
): Promise<Record<string, { receipt?: string; activity?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const admin = createAdminClient()
  const result: Record<string, { receipt?: string; activity?: string }> = {}

  // ?�명 URL ?�성 ?�청??bucket별로 분류
  const receiptPaths: { id: string; path: string }[] = []
  const activityPaths: { id: string; path: string }[] = []

  for (const item of items) {
    if (item.receiptUrl) {
      const path = extractStoragePath(item.receiptUrl, 'receipts')
      if (path) receiptPaths.push({ id: item.id, path })
    }
    if (item.activityUrl) {
      const path = extractStoragePath(item.activityUrl, 'activity-photos')
      if (path) activityPaths.push({ id: item.id, path })
    }
  }

  // receipts 버킷 signed URLs ?�괄 ?�성
  if (receiptPaths.length > 0) {
    const { data } = await admin.storage
      .from('receipts')
      .createSignedUrls(receiptPaths.map(p => p.path), SIGNED_URL_EXPIRES)
    if (data) {
      data.forEach((item, idx) => {
        if (item.signedUrl) {
          const id = receiptPaths[idx].id
          result[id] = { ...result[id], receipt: item.signedUrl }
        }
      })
    }
  }

  // activity-photos 버킷 signed URLs ?�괄 ?�성
  if (activityPaths.length > 0) {
    const { data } = await admin.storage
      .from('activity-photos')
      .createSignedUrls(activityPaths.map(p => p.path), SIGNED_URL_EXPIRES)
    if (data) {
      data.forEach((item, idx) => {
        if (item.signedUrl) {
          const id = activityPaths[idx].id
          result[id] = { ...result[id], activity: item.signedUrl }
        }
      })
    }
  }

  return result
}

/**
 * ?�일 ?��?지 URL??signed URL�?변?�합?�다.
 * 거래 ?�세 ?�면 ???�건 조회 ???�용?�니??
 */
export async function getSignedImageUrl(
  url: string | null,
  bucket: 'receipts' | 'activity-photos'
): Promise<string | null> {
  if (!url) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const path = extractStoragePath(url, bucket)
  if (!path) return null

  const admin = createAdminClient()
  const { data } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRES)

  return data?.signedUrl ?? null
}

/**
 * Easy Read ?��?지�?activity-photos 버킷???�로?�합?�다.
 * @param file - ?�로?�할 ?�일 (2MB ?�하, ?��?지 ?�식)
 * @param participantId - ?�사??UUID
 * @param entityType - 'plan' | 'goal'
 * @param entityId - 계획 ?�는 목표??UUID
 * @returns Storage path 문자??(DB ?�?�용)
 */
export async function uploadEasyReadImage(
  file: File,
  participantId: string,
  entityType: 'plan' | 'goal',
  entityId: string
): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith('image/')) {
    return { error: '?��?지 ?�일�??�로?�할 ???�습?�다.' }
  }
  if (file.size > EASY_READ_IMAGE_MAX_BYTES) {
    return { error: '?�일 ?�기??2MB ?�하?�야 ?�니??' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '?�증 ?�요' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `${participantId}/easy-read/${entityType}-${entityId}.${ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('activity-photos')
    .upload(storagePath, file, { upsert: true, contentType: file.type })

  if (error) return { error: error.message }
  return { path: storagePath }
}
