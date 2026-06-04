/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getSignedImageUrl } from '@/app/actions/storage'
import TransactionDetailView from './TransactionDetailView'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ParticipantTransactionDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 현재 유저의 당사자 ID 조회
  const profileData = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const profile = (profileData.data as any)?.data ?? profileData.data
  const role = String(profile?.role ?? '').trim().toLowerCase()

  // 관리자/담당자는 접근 불가 (당사자 전용)
  if (role === 'admin' || role === 'superadmin' || role === 'super_admin' || role === 'supporter') {
    redirect('/supporter/transactions')
  }

  const profileEmail =
    typeof profile?.email === 'string' && profile.email.trim()
      ? profile.email.trim().toLowerCase()
      : user.email?.trim().toLowerCase() || null

  let participantData = await adminClient
    .from('participants')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!participantData.data && profileEmail) {
    participantData = await adminClient
      .from('participants')
      .select('id')
      .ilike('email', profileEmail)
      .maybeSingle()
  }

  const participantId = participantData.data?.id
  if (!participantId) redirect('/')

  // 거래 내역 조회 (본인 것만)
  const { data: tx } = await adminClient
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('participant_id', participantId)
    .single()

  if (!tx) redirect('/calendar')

  // 모든 이미지 signed URL 변환
  const [signedReceiptUrls, signedActivityUrls, signedEvidenceUrls] = await Promise.all([
    Promise.all(
      (tx.receipt_image_urls || []).map((url: string) => getSignedImageUrl(url, 'receipts'))
    ),
    Promise.all(
      (tx.activity_image_urls || []).map((url: string) => getSignedImageUrl(url, 'activity-photos'))
    ),
    Promise.all(
      (tx.evidence_image_urls || []).map((url: string) => getSignedImageUrl(url, 'evidence-documents'))
    ),
  ])

  const txWithSignedUrls = {
    ...tx,
    receipt_image_urls: (tx.receipt_image_urls || []).map(
      (url: string, idx: number) => signedReceiptUrls[idx] ?? url
    ),
    activity_image_urls: (tx.activity_image_urls || []).map(
      (url: string, idx: number) => signedActivityUrls[idx] ?? url
    ),
    evidence_image_urls: (tx.evidence_image_urls || []).map(
      (url: string, idx: number) => signedEvidenceUrls[idx] ?? url
    ),
  }

  return <TransactionDetailView tx={txWithSignedUrls} />
}
