/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ParticipantsList from '@/components/participants/ParticipantsList'
import { isAdminRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'
import { ensureMonthlyBudgetRollover } from '@/app/actions/budgetRollover'

export default async function AdminParticipantsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const authProfile = await getAuthenticatedUserProfileRole()
  if (!authProfile || !isAdminRole(authProfile.role)) {
    redirect('/')
  }

  await ensureMonthlyBudgetRollover()

  let participantsLoadError = ''

  const { data: baseParticipants, error: baseParticipantsError } = await adminClient
    .from('participants')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })

  if (baseParticipantsError) {
    console.error('[admin/participants] participants load failed:', baseParticipantsError)
    participantsLoadError = `당사자 목록 조회 실패: ${baseParticipantsError.message}`
  }

  const participantIds = (baseParticipants || []).map((p: any) => p.id)
  const { data: fundingSourceRows, error: fundingSourcesError } =
    participantIds.length > 0
      ? await adminClient
          .from('funding_sources')
          .select('id, participant_id, name, monthly_budget, current_month_balance, start_date, end_date')
          .in('participant_id', participantIds)
      : { data: [], error: null as any }

  if (fundingSourcesError) {
    console.error('[admin/participants] funding_sources load failed:', fundingSourcesError)
    participantsLoadError = participantsLoadError || `자원 목록 조회 실패: ${fundingSourcesError.message}`
  }

  const fundingByParticipant = new Map<string, any[]>()
  for (const row of fundingSourceRows || []) {
    const list = fundingByParticipant.get(row.participant_id) || []
    list.push(row)
    fundingByParticipant.set(row.participant_id, list)
  }

  const participants = (baseParticipants || []).map((p: any) => ({
    ...p,
    funding_sources: fundingByParticipant.get(p.id) || [],
  }))

  const { data: allParticipantProfiles } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'participant')

  const existingIds = participants.map((p: any) => p.id)
  const unregisteredCount = (allParticipantProfiles || []).filter((p: any) => !existingIds.includes(p.id)).length

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-zinc-400 transition-colors hover:text-zinc-650 font-bold">←</Link>
          <h1 className="text-xl font-black tracking-tight text-zinc-800">당사자 관리</h1>
        </div>
        <div className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold text-red-500 border border-red-100">관리자</div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
        {participantsLoadError && (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 text-sm font-bold text-red-700">
            {participantsLoadError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl bg-white p-5 border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">등록된 당사자</span>
            <p className="mt-1 text-3xl font-black text-zinc-800">{participants.length}<span className="text-xs text-zinc-400 font-bold ml-0.5">명</span></p>
          </div>
          <div className="rounded-3xl bg-white p-5 border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">미등록 계정</span>
            <p className="mt-1 text-3xl font-black text-zinc-800">{unregisteredCount}<span className="text-xs text-zinc-400 font-bold ml-0.5">개</span></p>
          </div>
        </div>

        <Link
          href="/admin/participants/new"
          className="flex items-center justify-center rounded-3xl bg-zinc-900 p-4 text-base font-bold text-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all hover:bg-zinc-800 active:scale-[0.98]"
        >
          👤 새 당사자 등록
        </Link>

        <section className="flex flex-col gap-3">
          <h2 className="ml-1 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">당사자 목록</h2>
          <div className="flex flex-col gap-3">
            <ParticipantsList participants={participants} />
          </div>
        </section>
      </main>
    </div>
  )
}
