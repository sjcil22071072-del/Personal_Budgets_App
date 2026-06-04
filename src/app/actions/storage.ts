'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { extractStoragePath } from '@/utils/supabase/storage'

const SIGNED_URL_EXPIRES = 3600 // 1시간
const EASY_READ_IMAGE_MAX_BYTES = 2 * 1024 * 1024 // 2MB

/**
 * 트랜잭션 목록의 영수증·활동사진 URL을 signed URL로 일괄 변환합니다.
 * receipts, activity-photos 버킷이 private(public=false)일 때 사용합니다.
 *
 * @param items - { id, receiptUrl, activityUrl } 배열
 * @returns id → { receipt?, activity? } 매핑
 */
export async function getSignedImageUrls(
  items: { id: string; receiptUrl: string | null; activityUrl: string | null }[]
): Promise<Record<string, { receipt?: string; activity?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const admin = createAdminClient()
  const result: Record<string, { receipt?: string; activity?: string }> = {}

  // 서명 URL 생성 요청을 bucket별로 분류
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

  // receipts 버킷 signed URLs 일괄 생성 (썸네일용 최적화)
  if (receiptPaths.length > 0) {
    const uniqueReceiptPaths = Array.from(new Set(receiptPaths.map(p => p.path)))
    const { data, error } = await admin.storage
      .from('receipts')
      .createSignedUrls(uniqueReceiptPaths, SIGNED_URL_EXPIRES, {
        transform: {
          width: 300,
          quality: 70,
        }
      })
    if (error) {
      console.error('Failed to create signed URLs for receipts:', error)
    }
    if (data) {
      data.forEach(item => {
        if (item.signedUrl && item.path) {
          const matched = receiptPaths.filter(p => p.path === item.path)
          matched.forEach(p => {
            result[p.id] = { ...result[p.id], receipt: item.signedUrl as string }
          })
        }
      })
    }
  }

  // activity-photos 버킷 signed URLs 일괄 생성 (썸네일용 최적화)
  if (activityPaths.length > 0) {
    const uniqueActivityPaths = Array.from(new Set(activityPaths.map(p => p.path)))
    const { data, error } = await admin.storage
      .from('activity-photos')
      .createSignedUrls(uniqueActivityPaths, SIGNED_URL_EXPIRES, {
        transform: {
          width: 300,
          quality: 70,
        }
      })
    if (error) {
      console.error('Failed to create signed URLs for activity-photos:', error)
    }
    if (data) {
      data.forEach(item => {
        if (item.signedUrl && item.path) {
          const matched = activityPaths.filter(p => p.path === item.path)
          matched.forEach(p => {
            result[p.id] = { ...result[p.id], activity: item.signedUrl as string }
          })
        }
      })
    }
  }

  return result
}

/**
 * 단일 이미지 URL을 signed URL로 변환합니다.
 * 거래 상세 화면 등 단건 조회 시 사용합니다.
 */
export async function getSignedImageUrl(
  url: string | null,
  bucket: 'receipts' | 'activity-photos' | 'documents' | 'evidence-documents'
): Promise<string | null> {
  if (!url) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const path = extractStoragePath(url, bucket)
  console.log('extractStoragePath result:', path) // 추가

  if (!path) return null

  const admin = createAdminClient()
  const isPdf = path.toLowerCase().endsWith('.pdf')
  const options = isPdf 
    ? undefined 
    : {
        transform: {
          width: 1000,
          quality: 80,
        }
      }

  const { data, error } = await admin.storage  // error 추가
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRES, options)

  console.log('signedUrl:', data?.signedUrl, 'error:', error) // 추가
  return data?.signedUrl ?? null
}

/**
 * Easy Read 이미지를 activity-photos 버킷에 업로드합니다.
 * @param file - 업로드할 파일 (2MB 이하, 이미지 형식)
 * @param participantId - 당사자 UUID
 * @param entityType - 'plan' | 'goal'
 * @param entityId - 대상 항목 UUID
 * @returns Storage path 문자열 (DB 저장용)
 */
export async function uploadEasyReadImage(
  file: File,
  participantId: string,
  entityType: 'plan' | 'goal',
  entityId: string
): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith('image/')) {
    return { error: '이미지 파일만 업로드할 수 있습니다.' }
  }
  if (file.size > EASY_READ_IMAGE_MAX_BYTES) {
    return { error: '파일 크기는 2MB 이하여야 합니다.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증 필요' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `${participantId}/easy-read/${entityType}-${entityId}.${ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('activity-photos')
    .upload(storagePath, file, { upsert: true, contentType: file.type })

  if (error) return { error: error.message }
  return { path: storagePath }
}
