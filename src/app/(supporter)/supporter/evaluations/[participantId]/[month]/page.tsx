import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EvaluationPageClient from '@/components/evaluations/EvaluationPageClient'
import { getEvalTemplateSetting } from '@/app/actions/evalTemplates'
import { type EvalTemplateId } from '@/types/eval-templates'
import { normalizeMonth, parseMonth } from '@/utils/date'
import { isStaffRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'

interface Props {
  params: Promise<{ participantId: string; month: string }>
}

export default async function EvaluationDetailPage({ params }: Props) {
  const { participantId, month: monthParam } = await params
  const month = normalizeMonth(monthParam)
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const authProfile = await getAuthenticatedUserProfileRole()
  if (!authProfile || !isStaffRole(authProfile.role)) {
    redirect('/')
  }

  // 당사자 정보 조회
  const participantQuery = adminClient
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .eq('assigned_supporter_id', user.id)

  const { data: participant } = await participantQuery.maybeSingle()

  if (!participant) redirect('/supporter/evaluations')

  // 해당 월의 거래 내역 요약 정보 조회 (평가 참고용)
  const { startDate, endDate, display: displayMonth } = parseMonth(month)

  const { data: transactions } = await adminClient
    .from('transactions')
    .select('*')
    .eq('participant_id', participantId)
    .gte('date', startDate)
    .lt('date', endDate)
    .eq('status', 'confirmed')

  const totalSpent = transactions?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0
  const count = transactions?.length || 0

  // 기존 평가 데이터 조회
  const { data: existingEvaluation } = await adminClient
    .from('evaluations')
    .select('*')
    .eq('participant_id', participantId)
    .eq('month', month)
    .maybeSingle()

  // 기관 평가 양식 기본 설정 (custom_fields 등 참조용)
  const evalSetting = await getEvalTemplateSetting()
  const initialTemplateId: EvalTemplateId =
    (existingEvaluation?.evaluation_template as EvalTemplateId | undefined) ?? evalSetting.active

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8 pb-20">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/supporter/evaluations" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl font-bold">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{participant.name} 님 월별 평가</h1>
            <p className="text-zinc-500 mt-1">{displayMonth} 활동 기록 및 분석</p>
          </div>
        </div>
      </header>
      <main className="max-w-5xl flex flex-col lg:flex-row gap-8">
        {/* 좌측: 당월 활동 요약 (참고용) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">활동 요약 ({displayMonth})</h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <span className="text-sm text-zinc-500 font-medium">총 지출 금액</span>
                <span className="text-xl font-black text-zinc-900">{totalSpent.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-zinc-500 font-medium">확정된 활동 건수</span>
                <span className="text-xl font-black text-zinc-900">{count}건</span>
              </div>
            </div>
          </section>

          <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
            <h4 className="text-blue-800 font-bold text-sm mb-2">💡 작성 팁</h4>
            <p className="text-blue-700 text-xs leading-relaxed">
              당사자의 선택과 경험을 중심으로 기록해 주세요. 수치보다는 당사자가 무엇을 배우고 느꼈는지, 지원자가 무엇을 보았는지가 중요합니다.
              우측에서 기관에 맞는 평가 양식을 선택할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 우측: 양식 선택 + 평가 작성 폼 */}
        <div className="flex-1">
          <EvaluationPageClient
            participantId={participantId}
            month={month}
            initialData={existingEvaluation}
            orgSetting={evalSetting}
            initialTemplateId={initialTemplateId}
          />
        </div>
      </main>
    </div>
  )
}
