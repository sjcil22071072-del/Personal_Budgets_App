'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { extractStoragePath } from '@/utils/supabase/storage'

const SIGNED_URL_EXPIRES = 3600 // 1?œê°„
const EASY_READ_IMAGE_MAX_BYTES = 2 * 1024 * 1024 // 2MB

/**
 * ?¸ëœ??…˜ ëª©ë¡???ìˆ˜ì¦Â·í™œ?™ì‚¬ì§?URL??signed URLë¡??¼ê´„ ë³€?˜í•©?ˆë‹¤.
 * receipts, activity-photos ë²„í‚·??private(public=false)?????¬ìš©?©ë‹ˆ??
 *
 * @param items - { id, receiptUrl, activityUrl } ë°°ì—´
 * @returns id ??{ receipt?, activity? } ë§¤í•‘
 */
export async function getSignedImageUrls(
  items: { id: string; receiptUrl: string | null; activityUrl: string | null }[]
): Promise<Record<string, { receipt?: string; activity?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const admin = createAdminClient()
  const result: Record<string, { receipt?: string; activity?: string }> = {}

  // ?œëª… URL ?ì„± ?”ì²­??bucketë³„ë¡œ ë¶„ë¥˜
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

  // receipts ë²„í‚· signed URLs ?¼ê´„ ?ì„±
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

  // activity-photos ë²„í‚· signed URLs ?¼ê´„ ?ì„±
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
 * ?¨ì¼ ?´ë?ì§€ URL??signed URLë¡?ë³€?˜í•©?ˆë‹¤.
 * ê±°ë˜ ?ì„¸ ?”ë©´ ???¨ê±´ ì¡°íšŒ ???¬ìš©?©ë‹ˆ??
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
 * Easy Read ?´ë?ì§€ë¥?activity-photos ë²„í‚·???…ë¡œ?œí•©?ˆë‹¤.
 * @param file - ?…ë¡œ?œí•  ?Œì¼ (2MB ?´í•˜, ?´ë?ì§€ ?•ì‹)
 * @param participantId - ?¹ì‚¬??UUID
 * @param entityType - 'plan' | 'goal'
 * @param entityId - ê³„íš ?ëŠ” ëª©í‘œ??UUID
 * @returns Storage path ë¬¸ì??(DB ?€?¥ìš©)
 */
export async function uploadEasyReadImage(
  file: File,
  participantId: string,
  entityType: 'plan' | 'goal',
  entityId: string
): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith('image/')) {
    return { error: '?´ë?ì§€ ?Œì¼ë§??…ë¡œ?œí•  ???ˆìŠµ?ˆë‹¤.' }
  }
  if (file.size > EASY_READ_IMAGE_MAX_BYTES) {
    return { error: '?Œì¼ ?¬ê¸°??2MB ?´í•˜?¬ì•¼ ?©ë‹ˆ??' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '?¸ì¦ ?„ìš”' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `${participantId}/easy-read/${entityType}-${entityId}.${ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('activity-photos')
    .upload(storagePath, file, { upsert: true, contentType: file.type })

  if (error) return { error: error.message }
  return { path: storagePath }
}
