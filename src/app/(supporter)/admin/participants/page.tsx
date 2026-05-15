/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ParticipantsList from '@/components/participants/ParticipantsList'
import AdminHelpButton from '@/components/help/AdminHelpButton'
import { isAdminRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'

export default async function AdminParticipantsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const authProfile = await getAuthenticatedUserProfileRole()
  if (!authProfile || !isAdminRole(authProfile.role)) {
    redirect('/')
  }

  let participantsLoadError = ''

  // 당사자 기본 목록 조회
  const { data: baseParticipants, error: baseParticipantsError } = await adminClient
    .from('participants')
    .select('id, name, assigned_supporter_id, created_at')
    .order('created_at', { ascending: false })

  if (baseParticipantsError) {
    console.error('[admin/participants] participants load failed:', baseParticipantsError)
    participantsLoadError = `당사자 목록 조회 실패: ${baseParticipantsError.message}`
  }

  const participantIds = (baseParticipants || []).map((p: any) => p.id)
  const supporterIds = [...new Set((baseParticipants || []).map((p: any) => p.assigned_supporter_id).filter(Boolean))]

  const { data: fundingSourceRows, error: fundingSourcesError } =
    participantIds.length > 0
      ? await adminClient
          .from('funding_sources')
          .select('id, participant_id, name, monthly_budget, current_month_balance')
          .in('participant_id', participantIds)
      : { data: [], error: null as any }

  if (fundingSourcesError) {
    console.error('[admin/participants] funding_sources load failed:', fundingSourcesError)
    participantsLoadError = participantsLoadError || `재원 목록 조회 실패: ${fundingSourcesError.message}`
  }

  const { data: supporterRows, error: supportersError } =
    supporterIds.length > 0
      ? await adminClient
          .from('profiles')
          .select('id, name')
          .in('id', supporterIds)
      : { data: [], error: null as any }

  if (supportersError) {
    console.error('[admin/participants] supporters load failed:', supportersError)
    participantsLoadError = participantsLoadError || `지원자 조회 실패: ${supportersError.message}`
  }

  const fundingByParticipant = new Map<string, any[]>()
  for (const row of fundingSourceRows || []) {
    const list = fundingByParticipant.get(row.participant_id) || []
    list.push(row)
    fundingByParticipant.set(row.participant_id, list)
  }

  const supporterById = new Map<string, any>()
  for (const row of supporterRows || []) {
    supporterById.set(row.id, row)
  }

  const participants = (baseParticipants || []).map((p: any) => ({
    ...p,
    supporter: p.assigned_supporter_id ? supporterById.get(p.assigned_supporter_id) || null : null,
    funding_sources: fundingByParticipant.get(p.id) || [],
  }))

  // 전체 프로필 중 아직 당사자 등록이 안 된 사용자 조회
  const { data: allParticipantProfiles } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'participant')

  const existingIds = (participants || []).map((p: any) => p.id)
  const unregisteredCount = (allParticipantProfiles || []).filter((p: any) => !existingIds.includes(p.id)).length

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors">←</Link>
          <h1 className="text-xl font-bold tracking-tight">당사자 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-red-50 rounded-full text-[10px] font-bold text-red-500">관리자</div>
          <AdminHelpButton pageKey="participants" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {participantsLoadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {participantsLoadError}
          </div>
        )}

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">등록된 당사자</span>
            <p className="text-3xl font-black text-zinc-900 mt-1">{participants?.length || 0}명</p>
          </div>
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">미등록 사용자</span>
            <p className="text-3xl font-black text-zinc-900 mt-1">{unregisteredCount}</p>
          </div>
        </div>

        {/* 새 당사자 등록 버튼 */}
        <Link 
          href="/admin/participants/new"
          className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors active:scale-[0.98] shadow-lg"
        >
          <span className="text-xl">➕</span>
          새 당사자 등록
        </Link>

        {/* 당사자 목록 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">당사자 목록</h2>
          <ParticipantsList participants={participants || []} />
        </section>
      </main>
    </div>
  )
}
