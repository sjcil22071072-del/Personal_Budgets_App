'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { callOpenAI } from '@/utils/openai'

interface PlanOption {
  name: string
  cost: number
  time: string
  icon: string
  description?: string
}

interface PlanContext {
  activity?: string
  when?: string
  where?: string
  who?: string
  why?: string
}

/**
 * ?�계 1: ?�액·?�일 기반 ?�동 2가지 추천 (?�?�된 계획 기반 개인???�함)
 */
export async function suggestActivityOptions(
  balance: number,
  dayOfWeek: string,
  month: number,
  participantId?: string
): Promise<{ success: boolean; data?: { a: string; b: string }; error?: string }> {
  try {
    // ?�전???�?�한 계획?�서 ?�동 목록 조회 (개인?�용)
    let recentContext = ''
    if (participantId) {
      const supabase = await createClient()
      const { data: plans } = await supabase
        .from('plans')
        .select('activity_name')
        .eq('participant_id', participantId)
        .order('date', { ascending: false })
        .limit(10)

      const activities = (plans ?? [])
        .map((p: { activity_name: string }) => p.activity_name)
        .filter(Boolean)

      if (activities.length > 0) {
        const unique = [...new Set(activities)].slice(0, 6).join(', ')
        recentContext = `\n???�람??최근??좋아?�던 ?�동?? ${unique}\n?�전 ?�동�?비슷?�거???��???�??�주�?추천?�되, 가?��? ?�로???�동???�안?�주?�요.`
      }
    }

    const result = await callOpenAI([
      {
        role: 'system',
        content: `?�신?� 발달?�애???�인???�한 ?�상 계획 ?�우미입?�다.
?�용?�는 ?�번 ??${balance.toLocaleString()}?�이 ?�아?�습?�다.
?�늘?� ${dayOfWeek}?�일(${month}???�니??${recentContext}

?�상?�이�??�산??맞는 ?�동 2가지�?추천?�주?�요.
조건:
- �??�동명�? 10글???�내
- ?�산??5~25% ?��???비용
- ?�실?�인 ?�상 ?�동 (?�사, ?�료, ?�핑, ?�책 ??
- ?�수문자(#, &, ~, %, ^, /) ?�용 금�?

반드??JSON?�로�??�답:
{"a": "?�동명A", "b": "?�동명B"}`,
      },
      { role: 'user', content: '?�늘 ?????�는 ?�동??추천?�줘.' },
    ])
    const r = result as { a: string; b: string }
    return { success: true, data: { a: r.a, b: r.b } }
  } catch (error: any) {
    console.error('?�동 추천 ?�류:', error)
    return { success: false, error: error.message }
  }
}

/**
 * ?�계 2: ?�택???�동·?�액 기반 방법·비용 2가지 추천
 */
export async function suggestMethodOptions(
  activity: string,
  balance: number
): Promise<{ success: boolean; data?: { a: string; b: string; a_cost: number; b_cost: number }; error?: string }> {
  try {
    const result = await callOpenAI([
      {
        role: 'system',
        content: `?�사?��? ?�늘 "${activity}"??�? ?�려�??�니??
?�번 ???��? ?�산?� ${balance.toLocaleString()}?�입?�다.

???�동???�는 2가지 방법??추천?�주?�요.
조건:
- 방법 A: ??간단?�거???�?�한 방법
- 방법 B: 조금 ?�른 방법 (비용???�라???�니??
- �??�명?� 15글???�내
- ?�상 비용?� ?�라비아?�자(??�??�시

반드??JSON?�로�??�답:
{"a": "방법 ?�명", "b": "방법 ?�명", "a_cost": 5000, "b_cost": 7000}`,
      },
      { role: 'user', content: `${activity}??�? ?�떻�??�면 좋을지 추천?�줘.` },
    ])
    const r = result as { a: string; b: string; a_cost: number; b_cost: number }
    return {
      success: true,
      data: {
        a: r.a,
        b: r.b,
        a_cost: Number(r.a_cost) || 5000,
        b_cost: Number(r.b_cost) || 10000,
      },
    }
  } catch (error: any) {
    console.error('방법 추천 ?�류:', error)
    return { success: false, error: error.message }
  }
}

/**
 * ?�사?�의 계획??DB???�??
 */
export async function savePlan({
  participantId,
  activityName,
  date,
  options,
  selectedOptionIndex,
  details,
  place_name,
  place_lat,
  place_lng,
}: {
  participantId: string
  activityName: string
  date: string
  options: PlanOption[]
  selectedOptionIndex: number
  details?: PlanContext
  place_name?: string | null
  place_lat?: number | null
  place_lng?: number | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // ?�사?�는 profiles ?�이블에 ?�이 ?�으므�?creator_id FK ?�반 방�?
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()
  const creator_id = profile ? user.id : null

  const { error } = await supabase.from('plans').insert({
    participant_id: participantId,
    activity_name: activityName,
    date,
    options,
    selected_option_index: selectedOptionIndex,
    creator_id,
    details: details || null,
    place_name: place_name ?? null,
    place_lat: place_lat ?? null,
    place_lng: place_lng ?? null,
  })

  if (error) {
    console.error('Plan save error:', error)
    throw new Error('계획 ?�?�에 ?�패?�습?�다.')
  }

  revalidatePath('/plan')
  return { success: true }
}

/**
 * ?�사?�의 ?�?�된 계획 목록 조회
 */
export async function getParticipantPlans(participantId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('participant_id', participantId)
    .order('date', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Plan fetch error:', error)
    return []
  }

  return data || []
}
