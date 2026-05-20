/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EvaluationsPageClient from '@/components/evaluations/EvaluationsPageClient'
import AdminHelpButton from '@/components/help/AdminHelpButton'
import { parseMonth, getRecentMonths } from '@/utils/date'
import { formatCurrency } from '@/utils/budget-visuals'
import { isStaffRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'
import { extractStoragePath } from '@/utils/supabase/storage'

const CARD_PHOTO_SIGNED_URL_EXPIRES = 60 * 15

function SectionCard({
  id, icon, title, badge, accentClass = 'text-zinc-700', borderClass = 'border-zinc-200', defaultOpen = true, children,
}: {
  id: string; icon: string; title: string; badge?: React.ReactNode
  accentClass?: string; borderClass?: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  return (
    <details id={id} open={defaultOpen} className="group bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
      <summary className={`flex items-center justify-between gap-3 px-6 py-4 cursor-pointer select-none list-none border-b ${borderClass} group-open:border-b group-not-open:border-b-0 transition-colors hover:bg-zinc-50`}>
        <div className="flex items-center gap-2.5">
          <span className="text-base leading-none">{icon}</span>
          <span className={`text-sm font-black ${accentClass}`}>{title}</span>
          {badge}
        </div>
        <svg className="w-4 h-4 text-zinc-400 transition-transform group-open:rotate-180 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-6 py-5">{children}</div>
    </details>
  )
}

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ participant_id?: string; month?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const authProfile = await getAuthenticatedUserProfileRole()
  if (!authProfile || !isStaffRole(authProfile.role)) {
    redirect('/')
  }

  let query = adminClient
    .from('participants')
    .select('id, name')

  if (authProfile.role === 'supporter') {
    query = query.eq('assigned_supporter_id', user.id)
  }

  const { data: participants } = await query

  const selectedId = params.participant_id || participants?.[0]?.id
  const selectedMonthRaw = params.month || getRecentMonths(1)[0].value

  let inlineData: {
    participant: { id: string; name: string } | null
    displayMonth: string
    month: string
    totalSpent: number
    txCount: number
    existingEvaluation: any | null
    transactions: any[]
    cardRegistrations: { id: string; created_at: string; image_urls: string[] }[]
  } | null = null

  if (selectedId && selectedMonthRaw) {
    const { startDate, endDate, display } = parseMonth(selectedMonthRaw)

    const { data: participant } = await adminClient
      .from('participants')
      .select('id, name')
      .eq('id', selectedId)
      .single()

    const canViewParticipant = Boolean(participant) && (
      authProfile.role === 'admin' ||
      participants?.some((p: any) => p.id === selectedId)
    )

    if (participant && canViewParticipant) {
      const { data: transactions } = await adminClient
        .from('transactions')
        .select('*')
        .eq('participant_id', selectedId)
        .gte('date', startDate)
        .lt('date', endDate)
        .eq('status', 'confirmed')
        .order('date', { ascending: false })

      const totalSpent = transactions?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0

      const { data: existingEvaluation } = await adminClient
        .from('evaluations')
        .select('*')
        .eq('participant_id', selectedId)
        .eq('month', startDate)
        .single()

      const { data: cardData } = await adminClient
        .from('card_registrations')
        .select('id, participant_id, image_urls, created_at')
        .eq('participant_id', selectedId)
        .order('created_at', { ascending: false })

      const cardRegistrations = await Promise.all((cardData || []).map(async (item: any) => {
        const signedUrls = await Promise.all(((item.image_urls || []) as string[]).map(async (url: string) => {
          const path = extractStoragePath(url, 'card-photos')
          if (!path) return null
          const { data } = await adminClient.storage
            .from('card-photos')
            .createSignedUrl(path, CARD_PHOTO_SIGNED_URL_EXPIRES)
          return data?.signedUrl ?? null
        }))

        return {
          id: item.id,
          created_at: item.created_at,
          image_urls: signedUrls.filter((url): url is string => Boolean(url)),
        }
      }))

      inlineData = {
        participant: { id: participant.id, name: participant.name || '이름없음' },
        displayMonth: display,
        month: startDate,
        totalSpent,
        txCount: transactions?.length || 0,
        existingEvaluation,
        transactions: transactions || [],
        cardRegistrations,
      }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-6 md:p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">당사자 평가</h1>
          <p className="text-zinc-500 text-sm mt-1">월별 평가와 당사자 등록 카드를 한 곳에서 확인합니다.</p>
        </div>
        <AdminHelpButton pageKey="evaluations" />
      </header>

      <main className="max-w-5xl flex flex-col gap-4">
        <EvaluationsPageClient
          participants={(participants || []).map((p: any) => ({ id: p.id, name: p.name || '이름없음' }))}
          initialParticipantId={selectedId}
          initialMonth={selectedMonthRaw}
        />

        {inlineData && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-4 px-1">
              <div>
                <h2 className="text-xl font-black text-zinc-900">
                  {inlineData.participant?.name} 님 — {inlineData.displayMonth}
                </h2>
                <p className="text-sm font-bold mt-0.5">
                  {inlineData.existingEvaluation
                    ? <span className="text-emerald-600">✅ 평가 작성 완료</span>
                    : <span className="text-zinc-400">📝 평가 미작성</span>}
                </p>
              </div>
              <Link
                href={`/supporter/evaluations/${inlineData.participant?.id}/${inlineData.month}`}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-colors shadow-sm"
              >
                ✏️ 월별 평가 기록하기
              </Link>
            </div>

            <SectionCard id="section-summary" icon="📊" title="월별 활동 요약" accentClass="text-zinc-800" borderClass="border-zinc-100" defaultOpen={true}
              badge={<span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold">{inlineData.displayMonth}</span>}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">총 지출</p>
                  <p className="text-2xl font-black text-zinc-900">{formatCurrency(inlineData.totalSpent)}원</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">활동 건수</p>
                  <p className="text-2xl font-black text-zinc-900">{inlineData.txCount}건</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard id="section-budget" icon="💳" title="예산 사용 내역" accentClass="text-blue-800" borderClass="border-blue-100" defaultOpen={true}
            >
              <div className="flex flex-col gap-4 -mx-6 px-0">
                {inlineData.transactions.length > 0 && (
                  <div className="bg-white rounded-2xl ring-1 ring-zinc-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">최근 거래 내역 ({inlineData.displayMonth})</p>
                      <Link href={`/supporter/transactions?participant=${inlineData.participant?.id}`}
                        className="text-xs font-bold text-zinc-500 hover:text-zinc-700 underline underline-offset-2">전체 보기 →</Link>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-2 text-left">날짜</th>
                          <th className="px-4 py-2 text-left">활동</th>
                          <th className="px-4 py-2 text-right">금액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {inlineData.transactions.slice(0, 10).map((tx: any) => (
                          <tr key={tx.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-6 py-3 text-zinc-500 text-xs">{tx.date}</td>
                            <td className="px-4 py-3 font-bold text-zinc-900">{tx.activity_name}</td>
                            <td className="px-4 py-3 text-right font-black text-zinc-900">{formatCurrency(Number(tx.amount))}원</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {inlineData.transactions.length > 10 && (
                      <p className="text-center text-xs text-zinc-400 py-3 border-t border-zinc-100">외 {inlineData.transactions.length - 10}건 더 있음</p>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard id="section-card-registration" icon="💳" title="당사자가 등록한 카드" accentClass="text-zinc-800" borderClass="border-zinc-100" defaultOpen={true}
              badge={<span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold">{inlineData.cardRegistrations.length}건</span>}
            >
              {inlineData.cardRegistrations.length === 0 ? (
                <div className="rounded-xl bg-zinc-50 p-6 text-center text-sm font-bold text-zinc-400">
                  선택한 당사자가 등록한 카드가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inlineData.cardRegistrations.map((item) => (
                    <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-zinc-900">{item.created_at.slice(0, 10)} 등록</p>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">{item.image_urls.length}장</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {item.image_urls.map((url, index) => (
                          <a
                            key={`${item.id}-${index}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-[4/3] overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200"
                          >
                            <img
                              src={url}
                              alt={`등록 카드 ${index === 0 ? '앞면' : index === 1 ? '뒷면' : `${index + 1}번째 사진`}`}
                              className="h-full w-full object-cover transition-transform hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>

            {inlineData.existingEvaluation && (
              <SectionCard id="section-evaluation" icon="📝" title="월별 평가 결과" accentClass="text-emerald-800" borderClass="border-emerald-100" defaultOpen={true}>
                {inlineData.existingEvaluation.easy_summary && (
                  <div className="bg-emerald-50 rounded-xl p-4 mb-4 border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5">쉬운 요약</p>
                    <p className="text-sm text-emerald-900 font-bold leading-relaxed">{inlineData.existingEvaluation.easy_summary}</p>
                  </div>
                )}
                {inlineData.existingEvaluation.content && (
                  <p className="text-sm text-zinc-700 leading-relaxed line-clamp-5 whitespace-pre-wrap">
                    {typeof inlineData.existingEvaluation.content === 'string'
                      ? inlineData.existingEvaluation.content
                      : JSON.stringify(inlineData.existingEvaluation.content, null, 2).slice(0, 500)}
                  </p>
                )}
                <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-end">
                  <Link href={`/supporter/evaluations/${inlineData.participant?.id}/${inlineData.month}`}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2">
                    평가 전체 보기 / 편집하기 →
                  </Link>
                </div>
              </SectionCard>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
