'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CarePlanType, CarePlanContent } from '@/types/care-plans'

export interface CarePlanRow {
  id: string
  participant_id: string
  plan_type: string
  plan_year: number
  content: CarePlanContent
  creator_id: string | null
  created_at: string
  updated_at: string
}

/** ?�정 참여?�의 ?�용계획??목록 조회 */
export async function getCarePlans(participantId: string, year?: number): Promise<CarePlanRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('care_plans')
    .select('*')
    .eq('participant_id', participantId)
    .order('plan_year', { ascending: false })

  if (year !== undefined) {
    query = query.eq('plan_year', year)
  }

  const { data, error } = await query
  if (error) {
    console.error('getCarePlans error:', error)
    return []
  }
  return (data || []) as CarePlanRow[]
}

/** ?�정 ?�용계획???�건 조회 */
export async function getCarePlan(
  participantId: string,
  planType: CarePlanType,
  planYear: number
): Promise<CarePlanRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('care_plans')
    .select('*')
    .eq('participant_id', participantId)
    .eq('plan_type', planType)
    .eq('plan_year', planYear)
    .single()

  if (error) return null
  return data as CarePlanRow
}

/** ?�용계획???�??(upsert) */
export async function upsertCarePlan(
  participantId: string,
  planType: CarePlanType,
  planYear: number,
  content: CarePlanContent
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그?�이 ?�요?�니??' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { success: false, error: '권한???�습?�다.' }
  }

  const { error } = await supabase
    .from('care_plans')
    .upsert(
      {
        participant_id: participantId,
        plan_type: planType,
        plan_year: planYear,
        content,
        creator_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'participant_id, plan_type, plan_year' }
    )

  if (error) {
    console.error('upsertCarePlan error:', error)
    return { success: false, error: '?�?�에 ?�패?�습?�다.' }
  }

  revalidatePath(`/supporter/documents/care-plans/${participantId}/${planType}`)
  revalidatePath('/supporter/documents')
  return { success: true }
}

/** ?�용계획????�� */
export async function deleteCarePlan(carePlanId: string): Promise<{ success: boolean; error?: string }> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return { success: false, error: '?�모 모드?�서????��?????�습?�다.' }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그?�이 ?�요?�니??' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { success: false, error: '권한???�습?�다.' }
  }

  const { error } = await supabase
    .from('care_plans')
    .delete()
    .eq('id', carePlanId)

  if (error) {
    console.error('deleteCarePlan error:', error)
    return { success: false, error: '??��???�패?�습?�다.' }
  }

  revalidatePath('/supporter/documents')
  return { success: true }
}

/** 모든 ?�사?�의 ?�용계획??(?�류 보�???목록??
 *  care_plans ?�이블이 ?�직 ?�성?��? ?��? 경우 �?배열 반환
 */
export async function getAllCarePlans(): Promise<CarePlanRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('care_plans')
    .select('id, participant_id, plan_type, plan_year, updated_at, creator_id, created_at, content')
    .order('plan_year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    // ?�이�?미생??42P01) ??DB ?�류??�?배열�?처리???�이지 ?�래??방�?
    console.warn('getAllCarePlans ???�용계획??조회 ?�패 (migration ?�행 ?�일 ???�음):', error.message)
    return []
  }
  return (data || []) as CarePlanRow[]
}
