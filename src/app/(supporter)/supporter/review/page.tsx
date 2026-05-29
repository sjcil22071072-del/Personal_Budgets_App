/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReviewQueueClient from '@/components/transactions/ReviewQueueClient'
import { isStaffRole, isSupporterRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'

export default async function ReviewQueuePage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const authProfile = await getAuthenticatedUserProfileRole()
  if (!authProfile || !isStaffRole(authProfile.role)) {
    redirect('/')
  }

  let participantsQuery = adminClient
    .from('participants')
    .select('id')

  if (isSupporterRole(authProfile.role)) {
    participantsQuery = participantsQuery.eq('assigned_supporter_id', user.id)
  }

  const { data: participants } = await participantsQuery
  const participantIds = (participants ?? []).map((p: any) => p.id)

  let txQuery = adminClient
    .from('transactions')
    .select(`
      id,
      participant_id,
      date,
      category,
      receipt_reviewed,
      participants!transactions_participant_id_fkey ( name ),
      funding_sources!transactions_funding_source_id_fkey ( name )
    `)
    .eq('status', 'pending')
    .order('date', { ascending: false })

  if (isSupporterRole(authProfile.role) && participantIds.length > 0) {
    txQuery = txQuery.in('participant_id', participantIds)
  }

  const { data: rawTx } = await txQuery

  const transactions = (rawTx ?? []).map((t: any) => ({
    id: t.id,
    participant_name: t.participants?.name ?? '알 수 없음',
    date: t.date,
    category: t.category ?? '기타',
    funding_source_name: t.funding_sources?.name ?? null,
    receipt_reviewed: t.receipt_reviewed ?? false,
  }))

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center gap-3 mb-8">
        <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 transition-colors text-xl">←</Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">영수증 검토 대기열</h1>
          <p className="text-sm text-zinc-500 mt-0.5">대상자를 누르면 거래 상세에서 사진을 확인하고 승인할 수 있어요</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {transactions.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-sm font-black">
              {transactions.length}건 대기
            </span>
          )}
        </div>
      </header>

      <main className="w-full max-w-2xl flex flex-col gap-4">
        <ReviewQueueClient transactions={transactions} />
      </main>
    </div>
  )
}
