/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSignedImageUrl } from './storage'

export interface ParticipantWithFundingSources {
  id: string
  name: string
  funding_sources: { id: string; name: string }[]
}

export async function getParticipantsWithFundingSources(): Promise<ParticipantWithFundingSources[]> {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let query = adminClient
    .from('participants')
    .select('id, name, funding_sources ( id, name )')

  const { data } = await query
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name || p.id.slice(0, 8),
    funding_sources: p.funding_sources || [],
  }))
}

export async function createTransaction(formData: FormData) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()
  const creator_id = profile ? user.id : null

  const participant_id = formData.get('participant_id') as string
  const funding_source_id = formData.get('funding_source_id') as string
  const rawAmount = Number(formData.get('amount'))
  const date = (formData.get('date') as string) || new Date().toISOString().split('T')[0]
  const description = formData.get('description') as string
  const category = (formData.get('category') as string) || '기타'
  const memo = formData.get('memo') as string
  const status = (formData.get('status') as 'pending' | 'confirmed') || 'pending'
  const is_expense = formData.get('is_expense') !== 'false'
  const rawPaymentMethod = formData.get('payment_method') as string | null
  const payment_method = rawPaymentMethod === '계좌이체' ? '계좌이체' : '카드'
  const place_name = (formData.get('place_name') as string) || null
  const place_lat = formData.get('place_lat') ? Number(formData.get('place_lat')) : null
  const place_lng = formData.get('place_lng') ? Number(formData.get('place_lng')) : null

  // 영수증 사진 목록 (최대 5장)
  const receiptFiles: File[] = []
  for (let i = 0; i < 5; i++) {
    const f = formData.get(`receipt_${i}`) as File | null
    if (f && f.size > 0) receiptFiles.push(f)
  }

  // 활동 사진 목록 (최대 5장)
  const activityFiles: File[] = []
  for (let i = 0; i < 5; i++) {
    const f = formData.get(`activity_${i}`) as File | null
    if (f && f.size > 0) activityFiles.push(f)
  }

  // 증빙서류 파일 목록 (최대 5장)
  const evidenceFiles: File[] = []
  for (let i = 0; i < 5; i++) {
    const f = formData.get(`evidence_${i}`) as File | null
    if (f && f.size > 0) evidenceFiles.push(f)
  }

  const amount = is_expense ? rawAmount : -Math.abs(rawAmount)

  const receipt_image_urls: string[] = []
  const activity_image_urls: string[] = []
  const evidence_image_urls: string[] = []

  // 영수증 업로드 (최대 5장)
  for (const [idx, file] of receiptFiles.entries()) {
    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${user.id}-${Date.now()}-receipt-${idx}.${fileExt}`
    const { error: uploadError } = await adminClient.storage
      .from('receipts')
      .upload(fileName, file)
    if (!uploadError) {
      const { data: { publicUrl } } = adminClient.storage.from('receipts').getPublicUrl(fileName)
      receipt_image_urls.push(publicUrl)
    } else {
      console.error('Receipt upload error:', uploadError)
    }
  }

  // 활동사진 업로드 (최대 5장)
  for (const [idx, file] of activityFiles.entries()) {
    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${participant_id}/${Date.now()}-activity-${idx}.${fileExt}`
    const { error: uploadError } = await adminClient.storage
      .from('activity-photos')
      .upload(fileName, file)
    if (!uploadError) {
      const { data: { publicUrl } } = adminClient.storage.from('activity-photos').getPublicUrl(fileName)
      activity_image_urls.push(publicUrl)
    } else {
      console.error('Activity photo upload error:', uploadError)
    }
  }

  // 증빙서류 업로드 (최대 5장)
  for (const [idx, file] of evidenceFiles.entries()) {
    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${participant_id}/${Date.now()}-evidence-${idx}.${fileExt}`
    const { error: uploadError } = await adminClient.storage
      .from('evidence-documents')
      .upload(fileName, file)
    if (!uploadError) {
      const { data: { publicUrl } } = adminClient.storage
        .from('evidence-documents')
        .getPublicUrl(fileName)
      evidence_image_urls.push(publicUrl)
    } else {
      console.error('Evidence upload error:', uploadError)
    }
  }

  const { error } = await adminClient.from('transactions').insert({
    participant_id,
    creator_id,
    funding_source_id,
    amount,
    date,
    activity_name: description,
    category,
    memo: memo || null,
    status,
    receipt_image_urls,
    activity_image_urls,
    evidence_image_urls,
    payment_method,
    place_name,
    place_lat,
    place_lng,
  })

  if (error) {
    console.error('Insert Error:', error)
    throw new Error('Failed to create transaction')
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/receipt')
  revalidatePath(`/supporter/${participant_id}/transactions`)
  revalidatePath('/supporter/transactions')
  revalidatePath(`/admin/participants/${participant_id}`)
  return { success: true }
}

export async function updateTransactionStatus(transactionId: string, newStatus: 'pending' | 'confirmed') {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await adminClient
    .from('transactions')
    .update({ status: newStatus })
    .eq('id', transactionId)

  if (error) {
    console.error('Update Status Error:', error)
    throw new Error('Failed to update transaction status')
  }

  return { success: true }
}

export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await adminClient
    .from('transactions')
    .delete()
    .eq('id', transactionId)

  if (error) {
    console.error('Delete Error:', error)
    throw new Error('Failed to delete transaction')
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true }
}

export async function updateTransactionDetail(
  transactionId: string,
  updates: {
    activity_name: string
    amount: number
    date: string
    category: string | null
    memo: string | null
    payment_method: string | null
    status: 'pending' | 'confirmed'
    place_name?: string | null
    place_lat?: number | null
    place_lng?: number | null
  },
  oldStatus: 'pending' | 'confirmed',
  oldAmount: number,
  fundingSourceId: string | null
) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Balance is updated automatically by the database trigger calculate_funding_source_balance
  const { error } = await adminClient
    .from('transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', transactionId)
  if (error) throw new Error('Failed to update transaction')


  revalidatePath('/supporter/transactions')
  revalidatePath('/')
  return { success: true }
}

export async function deleteTransactionWithBalance(transactionId: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Balance is updated automatically by the database trigger calculate_funding_source_balance

  const { error } = await adminClient.from('transactions').delete().eq('id', transactionId)
  if (error) throw new Error('Failed to delete transaction')

  revalidatePath('/supporter/transactions')
  revalidatePath('/')
  return { success: true }
}

export async function updateTransaction(
  transactionId: string,
  updates: {
    amount?: number
    date?: string
    activity_name?: string
    category?: string
    memo?: string | null
    status?: 'pending' | 'confirmed'
    funding_source_id?: string
    place_name?: string | null
    place_lat?: number | null
    place_lng?: number | null
  }
) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await adminClient
    .from('transactions')
    .update(updates)
    .eq('id', transactionId)

  if (error) {
    console.error('Update Error:', error)
    throw new Error('Failed to update transaction')
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true }
}

export async function updateTransactionImages(
  transactionId: string,
  participantId: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string; receipt_image_url?: string; activity_image_url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const receiptFile = formData.get('receipt') as File | null
  const activityFile = formData.get('activity_image') as File | null

  const imageUpdates: { receipt_image_url?: string; activity_image_url?: string } = {}

  if (receiptFile && receiptFile.size > 0) {
    const fileExt = (receiptFile.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await admin.storage
      .from('receipts')
      .upload(fileName, receiptFile, { upsert: true })
    if (uploadError) return { error: `영수증 업로드 실패: ${uploadError.message}` }
    const { data: { publicUrl } } = admin.storage.from('receipts').getPublicUrl(fileName)
    imageUpdates.receipt_image_url = publicUrl
  }

  if (activityFile && activityFile.size > 0) {
    const fileExt = (activityFile.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${participantId}/${Date.now()}-activity.${fileExt}`
    const { error: uploadError } = await admin.storage
      .from('activity-photos')
      .upload(fileName, activityFile, { upsert: true })
    if (uploadError) return { error: `활동사진 업로드 실패: ${uploadError.message}` }
    const { data: { publicUrl } } = admin.storage.from('activity-photos').getPublicUrl(fileName)
    imageUpdates.activity_image_url = publicUrl
  }

  if (Object.keys(imageUpdates).length === 0) return { error: '업로드할 파일이 없습니다.' }

  const { error } = await admin
    .from('transactions')
    .update(imageUpdates)
    .eq('id', transactionId)

  if (error) return { error: `저장 실패: ${error.message}` }

  revalidatePath(`/supporter/transactions/${transactionId}`)
  revalidatePath('/supporter/transactions')

  const SIGNED_URL_EXPIRES = 3600
  const signedResult: { receipt_image_url?: string; activity_image_url?: string } = {}
  if (imageUpdates.receipt_image_url) {
    const path = imageUpdates.receipt_image_url.split('/object/public/receipts/')[1]
    if (path) {
      const { data } = await admin.storage.from('receipts').createSignedUrl(path, SIGNED_URL_EXPIRES)
      signedResult.receipt_image_url = data?.signedUrl ?? imageUpdates.receipt_image_url
    } else {
      signedResult.receipt_image_url = imageUpdates.receipt_image_url
    }
  }
  if (imageUpdates.activity_image_url) {
    const path = imageUpdates.activity_image_url.split('/object/public/activity-photos/')[1]
    if (path) {
      const { data } = await admin.storage.from('activity-photos').createSignedUrl(path, SIGNED_URL_EXPIRES)
      signedResult.activity_image_url = data?.signedUrl ?? imageUpdates.activity_image_url
    } else {
      signedResult.activity_image_url = imageUpdates.activity_image_url
    }
  }

  return { success: true, ...signedResult }
}

/**
 * 증빙서류 이미지 1장을 추가로 업로드합니다 (최대 5장 제한).
 */
export async function addEvidenceImage(
  transactionId: string,
  participantId: string,
  file: File
): Promise<{ success?: boolean; error?: string; url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 현재 증빙서류 개수 확인
  const { data: tx } = await admin
    .from('transactions')
    .select('evidence_image_urls')
    .eq('id', transactionId)
    .single()

  const currentUrls: string[] = (tx?.evidence_image_urls as string[]) || []
  if (currentUrls.length >= 5) {
    return { error: '증빙서류는 최대 5장까지 첨부할 수 있습니다.' }
  }

  const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const fileName = `${participantId}/${Date.now()}-evidence.${fileExt}`
  const { error: uploadError } = await admin.storage
    .from('evidence-documents')
    .upload(fileName, file, { upsert: false })

  if (uploadError) return { error: `업로드 실패: ${uploadError.message}` }

  const { data: { publicUrl } } = admin.storage.from('evidence-documents').getPublicUrl(fileName)
  const newUrls = [...currentUrls, publicUrl]

  const { error: dbError } = await admin
    .from('transactions')
    .update({ evidence_image_urls: newUrls })
    .eq('id', transactionId)

  if (dbError) return { error: `저장 실패: ${dbError.message}` }

  revalidatePath(`/supporter/transactions/${transactionId}`)
  const signedUrl = await getSignedImageUrl(publicUrl, 'evidence-documents')
  return { success: true, url: signedUrl ?? publicUrl }
}

/**
 * 증빙서류 이미지 1장을 삭제합니다.
 */
export async function removeEvidenceImage(
  transactionId: string,
  imageUrl: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: tx } = await admin
    .from('transactions')
    .select('evidence_image_urls')
    .eq('id', transactionId)
    .single()

  const currentUrls: string[] = (tx?.evidence_image_urls as string[]) || []
  const newUrls = currentUrls.filter(u => u !== imageUrl)

  // Storage에서 파일 삭제
  const marker = '/object/public/evidence-documents/'
  const idx = imageUrl.indexOf(marker)
  if (idx !== -1) {
    const path = imageUrl.slice(idx + marker.length)
    await admin.storage.from('evidence-documents').remove([path])
  }

  const { error: dbError } = await admin
    .from('transactions')
    .update({ evidence_image_urls: newUrls })
    .eq('id', transactionId)

  if (dbError) return { error: `삭제 실패: ${dbError.message}` }

  revalidatePath(`/supporter/transactions/${transactionId}`)
  return { success: true }
}

/**
 * 영수증 이미지 1장을 추가로 업로드합니다 (최대 5장 제한).
 */
export async function addReceiptImage(
  transactionId: string,
  participantId: string,
  file: File
): Promise<{ success?: boolean; error?: string; url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: tx } = await admin
    .from('transactions')
    .select('receipt_image_urls')
    .eq('id', transactionId)
    .single()

  const currentUrls: string[] = (tx?.receipt_image_urls as string[]) || []
  if (currentUrls.length >= 5) {
    return { error: '영수증 사진은 최대 5장까지 첨부할 수 있습니다.' }
  }

  const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const fileName = `${user.id}-${Date.now()}-receipt.${fileExt}`
  const { error: uploadError } = await admin.storage
    .from('receipts')
    .upload(fileName, file, { upsert: false })

  if (uploadError) return { error: `업로드 실패: ${uploadError.message}` }

  const { data: { publicUrl } } = admin.storage.from('receipts').getPublicUrl(fileName)
  const newUrls = [...currentUrls, publicUrl]

  const { error: dbError } = await admin
    .from('transactions')
    .update({ receipt_image_urls: newUrls })
    .eq('id', transactionId)

  if (dbError) return { error: `저장 실패: ${dbError.message}` }

  revalidatePath(`/supporter/transactions/${transactionId}`)
  const signedUrl = await getSignedImageUrl(publicUrl, 'receipts')
  return { success: true, url: signedUrl ?? publicUrl }
}

/**
 * 영수증 이미지 1장을 삭제합니다.
 */
export async function removeReceiptImage(
  transactionId: string,
  imageUrl: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: tx } = await admin
    .from('transactions')
    .select('receipt_image_urls')
    .eq('id', transactionId)
    .single()

  const currentUrls: string[] = (tx?.receipt_image_urls as string[]) || []
  const newUrls = currentUrls.filter(u => u !== imageUrl)

  const marker = '/object/public/receipts/'
  const idx = imageUrl.indexOf(marker)
  if (idx !== -1) {
    const path = imageUrl.slice(idx + marker.length)
    await admin.storage.from('receipts').remove([path])
  }

  const { error: dbError } = await admin
    .from('transactions')
    .update({ receipt_image_urls: newUrls })
    .eq('id', transactionId)

  if (dbError) return { error: `삭제 실패: ${dbError.message}` }

  revalidatePath(`/supporter/transactions/${transactionId}`)
  return { success: true }
}

/**
 * 활동사진 이미지 1장을 추가로 업로드합니다 (최대 5장 제한).
 */
export async function addActivityImage(
  transactionId: string,
  participantId: string,
  file: File
): Promise<{ success?: boolean; error?: string; url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: tx } = await admin
    .from('transactions')
    .select('activity_image_urls')
    .eq('id', transactionId)
    .single()

  const currentUrls: string[] = (tx?.activity_image_urls as string[]) || []
  if (currentUrls.length >= 5) {
    return { error: '활동 사진은 최대 5장까지 첨부할 수 있습니다.' }
  }

  const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const fileName = `${participantId}/${Date.now()}-activity.${fileExt}`
  const { error: uploadError } = await admin.storage
    .from('activity-photos')
    .upload(fileName, file, { upsert: false })

  if (uploadError) return { error: `업로드 실패: ${uploadError.message}` }

  const { data: { publicUrl } } = admin.storage.from('activity-photos').getPublicUrl(fileName)
  const newUrls = [...currentUrls, publicUrl]

  const { error: dbError } = await admin
    .from('transactions')
    .update({ activity_image_urls: newUrls })
    .eq('id', transactionId)

  if (dbError) return { error: `저장 실패: ${dbError.message}` }

  revalidatePath(`/supporter/transactions/${transactionId}`)
  const signedUrl = await getSignedImageUrl(publicUrl, 'activity-photos')
  return { success: true, url: signedUrl ?? publicUrl }
}

/**
 * 활동사진 이미지 1장을 삭제합니다.
 */
export async function removeActivityImage(
  transactionId: string,
  imageUrl: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: tx } = await admin
    .from('transactions')
    .select('activity_image_urls')
    .eq('id', transactionId)
    .single()

  const currentUrls: string[] = (tx?.activity_image_urls as string[]) || []
  const newUrls = currentUrls.filter(u => u !== imageUrl)

  const marker = '/object/public/activity-photos/'
  const idx = imageUrl.indexOf(marker)
  if (idx !== -1) {
    const path = imageUrl.slice(idx + marker.length)
    await admin.storage.from('activity-photos').remove([path])
  }

  const { error: dbError } = await admin
    .from('transactions')
    .update({ activity_image_urls: newUrls })
    .eq('id', transactionId)

  if (dbError) return { error: `삭제 실패: ${dbError.message}` }

  revalidatePath(`/supporter/transactions/${transactionId}`)
  return { success: true }
}
