/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { isStaffRole } from '@/utils/user-role'

export interface MonthlyPlanInput {
  id?: string
  participant_id: string
  month: string                       // first day, 'YYYY-MM-DD'
  order_index: number                 // 1~6
  title: string
  description?: string | null
  funding_source_id?: string | null
  support_goal_id?: string | null
  planned_budget: number
  target_count?: number | null
  scheduled_dates?: string[] | null
  easy_description?: string | null
  easy_image_url?: string | null
}

export interface MonthlyPlan {
  id: string
  participant_id: string
  month: string
  order_index: number
  title: string
  description: string | null
  funding_source_id: string | null
  support_goal_id: string | null
  planned_budget: number
  target_count: number | null
  scheduled_dates: string[] | null
  easy_description: string | null
  easy_image_url: string | null
  funding_source?: { id: string; name: string } | null
  support_goal?: { id: string; support_area: string } | null
}

export interface MonthlyPlanProgress extends MonthlyPlan {
  spent_confirmed: number
  spent_pending: number
  tx_count: number
}

function normalizeMonth(month: string): string {
  // Normalize 'YYYY-MM' or 'YYYY-MM-DD' to the first day of the month.
  const m = month.length === 7 ? `${month}-01` : month
  return m.slice(0, 8) + '01'
}

async function assertStaff() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Authentication required.', supabase, user: null }
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || !isStaffRole(profile.role)) {
    return { ok: false, error: 'Permission denied.', supabase, user }
  }
  return { ok: true, error: null, supabase, user }
}

async function assertAssignedParticipant(participantId: string, userId: string) {
  const adminClient = createAdminClient()
  const { data: participant } = await adminClient
    .from('participants')
    .select('id')
    .eq('id', participantId)
    .eq('assigned_supporter_id', userId)
    .maybeSingle()

  return Boolean(participant)
}

export async function getMonthlyPlans(
  participantId: string,
  month: string
): Promise<MonthlyPlan[]> {
  const supabase = createAdminClient()
  const m = normalizeMonth(month)
  const { data } = await supabase
    .from('monthly_plans')
    .select('id, participant_id, month, order_index, title, description, funding_source_id, support_goal_id, planned_budget, target_count, scheduled_dates, easy_description, easy_image_url, funding_source:funding_sources ( id, name ), support_goal:support_goals ( id, support_area )')
    .eq('participant_id', participantId)
    .eq('month', m)
    .order('order_index', { ascending: true })

  return (data || []).map((p: any) => ({
    ...p,
    easy_description: p.easy_description ?? null,
    easy_image_url: p.easy_image_url ?? null,
    funding_source: Array.isArray(p.funding_source) ? p.funding_source[0] ?? null : p.funding_source ?? null,
    support_goal: Array.isArray(p.support_goal) ? p.support_goal[0] ?? null : p.support_goal ?? null,
  })) as MonthlyPlan[]
}

export async function getMonthlyPlanProgress(
  participantId: string,
  month: string
): Promise<MonthlyPlanProgress[]> {
  const supabase = createAdminClient()
  const m = normalizeMonth(month)

  const plans = await getMonthlyPlans(participantId, m)
  if (plans.length === 0) return []

  const [year, mo] = m.split('-').map(Number)
  const startDate = m
  const nextMonth = new Date(year, mo, 1)
  const endDate = nextMonth.toISOString().split('T')[0]

  const { data: txs } = await supabase
    .from('transactions')
    .select('id, amount, status, monthly_plan_id')
    .eq('participant_id', participantId)
    .gte('date', startDate)
    .lt('date', endDate)
    .in('monthly_plan_id', plans.map(p => p.id))

  const agg = new Map<string, { confirmed: number; pending: number; count: number }>()
  for (const t of txs || []) {
    const key = (t as any).monthly_plan_id as string
    if (!key) continue
    const amount = Math.max(0, Number((t as any).amount) || 0)
    const cur = agg.get(key) ?? { confirmed: 0, pending: 0, count: 0 }
    if ((t as any).status === 'confirmed') cur.confirmed += amount
    else cur.pending += amount
    cur.count += 1
    agg.set(key, cur)
  }

  return plans.map(p => {
    const a = agg.get(p.id) ?? { confirmed: 0, pending: 0, count: 0 }
    return {
      ...p,
      spent_confirmed: a.confirmed,
      spent_pending: a.pending,
      tx_count: a.count,
    }
  })
}

export async function upsertMonthlyPlan(input: MonthlyPlanInput) {
  const { ok, error, user } = await assertStaff()
  const adminClient = createAdminClient()
  if (!ok || !user) return { error: error || 'Permission denied.' }

  if (!await assertAssignedParticipant(input.participant_id, user.id)) {
    return { error: 'Only assigned participants can be edited.' }
  }

  const m = normalizeMonth(input.month)

  const payload = {
    participant_id: input.participant_id,
    month: m,
    order_index: input.order_index,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    funding_source_id: input.funding_source_id || null,
    support_goal_id: input.support_goal_id || null,
    planned_budget: Number(input.planned_budget) || 0,
    target_count: input.target_count ?? null,
    scheduled_dates: input.scheduled_dates?.length ? input.scheduled_dates : [],
    easy_description: input.easy_description?.trim() || null,
    easy_image_url: input.easy_image_url || null,
    creator_id: user.id,
    updated_at: new Date().toISOString(),
  }

  if (!payload.title) return { error: 'Title is required.' }
  if (payload.order_index < 1 || payload.order_index > 6) {
    return { error: 'Plan order must be between 1 and 6.' }
  }

  if (input.id) {
    const { error: upErr } = await adminClient
      .from('monthly_plans')
      .update(payload)
      .eq('id', input.id)
      .eq('participant_id', input.participant_id)
    if (upErr) return { error: upErr.message }
  } else {
    const { error: insErr } = await adminClient
      .from('monthly_plans')
      .insert(payload)
    if (insErr) return { error: insErr.message }
  }

  revalidatePath(`/supporter/evaluations/${input.participant_id}/${m}`)
  revalidatePath(`/supporter/evaluations/${input.participant_id}/${m}/plans`)
  revalidatePath(`/supporter/transactions`)
  revalidatePath(`/`)
  return { success: true }
}

export async function deleteMonthlyPlan(id: string, participantId: string, month: string) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return { error: '데모 모드에서는 삭제할 수 없습니다.' }

  const { ok, error, user } = await assertStaff()
  if (!ok || !user) return { error: error || '권한이 없습니다.' }
  if (!await assertAssignedParticipant(participantId, user.id)) {
    return { error: '담당 당사자만 월별 계획을 삭제할 수 있습니다.' }
  }

  const adminClient = createAdminClient()
  const { error: delErr } = await adminClient
    .from('monthly_plans')
    .delete()
    .eq('id', id)
    .eq('participant_id', participantId)
  if (delErr) return { error: delErr.message }

  const m = normalizeMonth(month)
  revalidatePath(`/supporter/evaluations/${participantId}/${m}`)
  revalidatePath(`/supporter/evaluations/${participantId}/${m}/plans`)
  revalidatePath(`/supporter/transactions`)
  revalidatePath(`/`)
  return { success: true }
}
