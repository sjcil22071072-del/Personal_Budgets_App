/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types/database'
import { OPERATION_END_DATE, OPERATION_START_DATE } from '@/constants/operation-period'

/**
 * 관리자 권한 검증
 */
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
 
  if (!user) throw new Error('로그인이 필요합니다.')
 
  const adminClient = createAdminClient()
 
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
 
  const role = String(profile?.role ?? '').trim().toLowerCase()
 
  const isAdmin =
    role === 'admin' ||
    role === 'superadmin' ||
    role === 'super_admin'
 
  if (!isAdmin) {
    console.error('verifyAdmin failed:', { userId: user.id, role })
    throw new Error('관리자 권한이 필요합니다.')
  }
 
  return { user, supabase: adminClient }
}
 
/**
 * 사용자 역할 변경
 */
export async function updateUserRole(userId: string, newRole: UserRole) {
  await verifyAdmin()
  void userId
  void newRole
  return { error: '역할은 최초 지정 후 수정할 수 없습니다. 기존 당사자를 관리자로 바꾸려면 관리자 등록 화면을 사용해주세요.' }
}

/**
 * 전체 사용자 목록 조회 (관리자 전용)
 */
export async function getAllUsers() {
  const { supabase } = await verifyAdmin()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message, profiles: [] }
  }

  return { profiles: profiles || [] }
}

export async function getSupporters() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { supporters: [], error: '로그인이 필요합니다.' }
 
    const adminClient = createAdminClient()
 
const { data, error } = await adminClient
  .from('profiles')
  .select('id, name, role')
  .eq('role', 'admin')
  .order('name', { ascending: true })
 
    if (error) {
      console.error('[admin.getSupporters] query error:', error)
      return { supporters: [], error: error.message }
    }
 
    return { supporters: data || [] }
  } catch (e: any) {
    console.error('[admin.getSupporters] exception:', e)
    return { supporters: [], error: e?.message || '관리자 목록을 불러오지 못했습니다.' }
  }
}
/**
 * 최초 로그인 시 admin이 없으면 자동 admin 부여 (§2)
 * PostgreSQL RPC를 사용한 원자적(atomic) 처리로 Race Condition 방지
 */
export async function assignRoleForFirstUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  try {
    // PostgreSQL 함수로 원자적 처리
    // (만약 RPC 함수가 없으면 데이터베이스 트리거 사용)
    const { error } = await supabase.rpc('assign_first_admin', { 
      user_id: user.id 
    })

    if (!error) {
      revalidatePath('/')
    }
  } catch (e) {
    // RPC 함수가 없으면 폴백: 관리자가 없으면 업데이트
    // (이 방식도 경합 조건이 있지만, DB 트리거가 최종 보호)
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')

    if (count === 0) {
      await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id)
      revalidatePath('/')
    }
  }
}

/**
 * 새 당사자 등록 (participants 테이블에 직접 생성)
 * participants는 profiles와 독립 — 자체 name, email 컬럼 보유
 */


export async function createParticipant(formData: {
  name: string
  email: string
  monthlyBudget: number
  yearlyBudget: number
  startDate: string
  endDate: string
  alertThreshold: number
  supporterId: string | null
  fundingSources: Array<{
    name: string
    monthlyBudget: number
    yearlyBudget: number
  }>
}) {
  try {
    console.log('[admin.createParticipant] called with:', {
      name: formData.name,
      email: formData.email,
      monthlyBudget: formData.monthlyBudget,
      yearlyBudget: formData.yearlyBudget,
      startDate: OPERATION_START_DATE,
      endDate: OPERATION_END_DATE,
      alertThreshold: formData.alertThreshold,
      supporterId: formData.supporterId,
      fundingSourceCount: formData.fundingSources?.length ?? 0,
    })
    const { supabase } = await verifyAdmin()

    // 이메일 중복 검사
    const { data: existing } = await supabase
      .from('participants')
      .select('id')
      .eq('email', formData.email)
      .maybeSingle()

    if (existing) {
      return { error: '이미 등록된 이메일(아이디)입니다.' }
    }

    // 1. 당사자 등록 (profiles 불필요 — participants 자체 인적사항 보유)
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        name: formData.name,
        email: formData.email,
        monthly_budget_default: formData.monthlyBudget,
        yearly_budget_default: formData.yearlyBudget,
        budget_start_date: OPERATION_START_DATE,
        budget_end_date: OPERATION_END_DATE,
        funding_source_count: formData.fundingSources.length,
        alert_threshold: formData.alertThreshold,
        assigned_supporter_id: formData.supporterId || null,
      })
      .select('id')
      .single()

    if (participantError || !participant) {
      console.error('[admin.createParticipant] participant insert error:', participantError)
      const detailParts = [
        participantError?.message,
        participantError?.details,
        participantError?.hint,
        participantError?.code ? `(code: ${participantError.code})` : '',
      ].filter(Boolean)
      return { error: `당사자 등록 실패: ${detailParts.join(' / ') || '알 수 없는 오류'}` }
    }

    const newParticipantId = participant.id

    // 1-1. auth.users에 가입된 이메일이 있는지 확인하여 profiles 테이블과 연동
    try {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
      if (!listError && users) {
        const matchedUser = users.find((u: any) => u.email?.toLowerCase() === formData.email.toLowerCase())
        if (matchedUser) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: matchedUser.id,
              name: formData.name,
              email: formData.email,
              role: 'participant'
            }, { onConflict: 'id' })
          
          if (profileError) {
            console.error('[admin.createParticipant] profile sync error:', profileError)
          }
        }
      }
    } catch (err) {
      console.error('[admin.createParticipant] profile sync exception:', err)
    }

    // 2. 재원 등록 (배치 INSERT)
    if (formData.fundingSources.length > 0) {
      const { error: fsError } = await supabase
        .from('funding_sources')
        .insert(
          formData.fundingSources.map((fs: any) => ({
            participant_id: newParticipantId,
            name: fs.name,
            monthly_budget: fs.monthlyBudget,
            yearly_budget: fs.yearlyBudget,
            current_month_balance: fs.monthlyBudget,
            current_year_balance: fs.yearlyBudget,
          }))
        )

      if (fsError) {
        console.error('[admin.createParticipant] funding source insert error:', fsError)
        const detailParts = [
          fsError.message,
          fsError.details,
          fsError.hint,
          fsError.code ? `(code: ${fsError.code})` : '',
        ].filter(Boolean)
        return { error: `재원 등록 실패: ${detailParts.join(' / ')}` }
      }
    }

    revalidatePath('/admin/participants')
    console.log('[admin.createParticipant] success participantId:', newParticipantId)
    return { success: true, participantId: newParticipantId }
  } catch (e: any) {
    console.error('[admin.createParticipant] exception:', e)
    const message =
      typeof e?.message === 'string' && e.message.trim()
        ? e.message
        : '당사자 등록 중 오류가 발생했습니다.'
    return { error: `오류: ${message}` }
  }
}

/**
 * 당사자 정보 업데이트
 */
export async function updateParticipant(participantId: string, formData: {
  name?: string
  email?: string
  monthlyBudget?: number
  yearlyBudget?: number
  startDate?: string
  endDate?: string
  alertThreshold?: number
  supporterId?: string | null
}) {
  const { supabase } = await verifyAdmin()

  try {
    // 업데이트 전 원래 당사자 이메일 확인
    const { data: originalParticipant } = await supabase
      .from('participants')
      .select('email')
      .eq('id', participantId)
      .maybeSingle()
    const oldEmail = originalParticipant?.email

    const updateData: any = {}
    if (formData.name !== undefined) updateData.name = formData.name
    if (formData.email !== undefined) {
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('email', formData.email)
        .neq('id', participantId)
        .maybeSingle()

      if (existing) {
        return { error: '이미 등록된 이메일(아이디)입니다.' }
      }
      updateData.email = formData.email
    }
    if (formData.monthlyBudget !== undefined) updateData.monthly_budget_default = formData.monthlyBudget
    if (formData.yearlyBudget !== undefined) updateData.yearly_budget_default = formData.yearlyBudget
    updateData.budget_start_date = OPERATION_START_DATE
    updateData.budget_end_date = OPERATION_END_DATE
    if (formData.alertThreshold !== undefined) updateData.alert_threshold = formData.alertThreshold
    if (formData.supporterId !== undefined) updateData.assigned_supporter_id = formData.supporterId

    const { error } = await supabase
      .from('participants')
      .update(updateData)
      .eq('id', participantId)

    if (error) {
      return { error: `업데이트 실패: ${error.message}` }
    }

    // profiles 테이블 정보도 동기화
    if (oldEmail) {
      try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (!listError && users) {
          const matchedUser = users.find((u: any) => u.email?.toLowerCase() === oldEmail.toLowerCase())
          if (matchedUser) {
            const profileUpdate: any = {}
            if (formData.name !== undefined) profileUpdate.name = formData.name
            if (formData.email !== undefined) profileUpdate.email = formData.email
            
            if (Object.keys(profileUpdate).length > 0) {
              const { error: profileError } = await supabase
                .from('profiles')
                .update(profileUpdate)
                .eq('id', matchedUser.id)
              
              if (profileError) {
                console.error('[admin.updateParticipant] profile sync error:', profileError)
              }
            }
          }
        }
      } catch (err) {
        console.error('[admin.updateParticipant] profile sync exception:', err)
      }
    }

    const { ensureMonthlyBudgetRollover } = await import('./budgetRollover')
    await ensureMonthlyBudgetRollover(participantId, true)

    revalidatePath('/admin/participants')
    revalidatePath(`/admin/participants/${participantId}`)
    revalidatePath(`/admin/participants/${participantId}/preview`)
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}

/**
 * 당사자 삭제 (CASCADE로 관련 데이터도 함께 삭제됨)
 */
export async function deleteParticipant(participantId: string) {
  const { supabase } = await verifyAdmin()

  try {
    // 삭제 전 당사자 이메일 확인
    const { data: participant } = await supabase
      .from('participants')
      .select('email')
      .eq('id', participantId)
      .maybeSingle()
    const email = participant?.email

    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId)

    if (error) {
      return { error: `삭제 실패: ${error.message}` }
    }

    // profiles 테이블 정보도 동기화 (해당 이메일의 프로필 삭제)
    if (email) {
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('email', email)
        
        if (profileError) {
          console.error('[admin.deleteParticipant] profile sync error:', profileError)
        }
      } catch (err) {
        console.error('[admin.deleteParticipant] profile sync exception:', err)
      }
    }

    revalidatePath('/admin/participants')
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}

/**
 * 재원 정보 업데이트
 */
export async function updateFundingSource(fundingSourceId: string, formData: {
  name?: string
  monthlyBudget?: number
  yearlyBudget?: number
  startDate?: string | null
  endDate?: string | null
}) {
  const { supabase } = await verifyAdmin()

  try {
    const updateData: any = {}
    if (formData.name !== undefined) updateData.name = formData.name
    if (formData.monthlyBudget !== undefined) updateData.monthly_budget = formData.monthlyBudget
    if (formData.yearlyBudget !== undefined) updateData.yearly_budget = formData.yearlyBudget
    if (formData.startDate !== undefined) updateData.start_date = formData.startDate
    if (formData.endDate !== undefined) updateData.end_date = formData.endDate

    const { error } = await supabase
      .from('funding_sources')
      .update(updateData)
      .eq('id', fundingSourceId)

    if (error) {
      return { error: `재원 업데이트 실패: ${error.message}` }
    }

    const { data: fsData } = await supabase
      .from('funding_sources')
      .select('participant_id')
      .eq('id', fundingSourceId)
      .single()

    if (fsData?.participant_id) {
      const { ensureMonthlyBudgetRollover } = await import('./budgetRollover')
      await ensureMonthlyBudgetRollover(fsData.participant_id, true)
    }

    revalidatePath('/admin/participants')
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}

/**
 * 재원 추가
 */
export async function createFundingSource(participantId: string, formData: {
  name: string
  monthlyBudget: number
  yearlyBudget: number
  startDate?: string | null
  endDate?: string | null
}) {
  const { supabase } = await verifyAdmin()

  try {
    const { error } = await supabase
      .from('funding_sources')
      .insert({
        participant_id: participantId,
        name: formData.name,
        monthly_budget: formData.monthlyBudget,
        yearly_budget: formData.yearlyBudget,
        current_month_balance: formData.monthlyBudget,
        current_year_balance: formData.yearlyBudget,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
      })

    if (error) {
      return { error: `재원 추가 실패: ${error.message}` }
    }

    revalidatePath('/admin/participants')
    revalidatePath(`/admin/participants/${participantId}`)
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}

/**
 * 재원 삭제
 */
export async function deleteFundingSource(fundingSourceId: string) {
  const { supabase } = await verifyAdmin()

  try {
    const { error } = await supabase
      .from('funding_sources')
      .delete()
      .eq('id', fundingSourceId)

    if (error) {
      return { error: `재원 삭제 실패: ${error.message}` }
    }

    revalidatePath('/admin/participants')
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}

// ──────────────────────────────────────────
// 관리자 사전 등록
// ──────────────────────────────────────────

export type StaffRole = 'admin'

export async function registerStaffUser(formData: {
  name: string
  email: string
  role: StaffRole
  note?: string
}): Promise<{ success?: boolean; error?: string; mode?: 'updated' | 'registered' }> {
  const { supabase, user } = await verifyAdmin()

  const email = formData.email.trim().toLowerCase()
  const name = formData.name.trim()
  const note = formData.note?.trim() || null

  if (!name) return { error: '이름을 입력해주세요.' }
  if (!email) return { error: '이메일을 입력해주세요.' }
  if (formData.role !== 'admin') {
    return { error: '관리자만 등록할 수 있습니다.' }
  }

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()

  if (profileLookupError) {
    return { error: `사용자 확인 실패: ${profileLookupError.message}` }
  }

  if (existingProfile?.id) {
    const currentRole = String((existingProfile as { role?: string }).role ?? '').trim().toLowerCase()
    if (currentRole !== 'participant' && currentRole !== 'admin') {
      return { error: '이미 다른 역할로 등록된 계정입니다.' }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: formData.role, name })
      .eq('id', existingProfile.id)

    if (updateError) {
      return { error: `역할 변경 실패: ${updateError.message}` }
    }

    revalidatePath('/admin/settings')
    revalidatePath('/admin/users/new')
    return { success: true, mode: 'updated' }
  }

  const { data: existingInvitation, error: invitationLookupError } = await supabase
    .from('user_invitations')
    .select('id, role, used_at')
    .eq('email', email)
    .maybeSingle()

  if (invitationLookupError) {
    return { error: `등록 확인 실패: ${invitationLookupError.message}` }
  }

  if (existingInvitation) {
    return { error: '이미 역할이 지정된 이메일입니다. 가입 전 역할도 다시 수정할 수 없습니다.' }
  }

  const { error: invitationError } = await supabase
    .from('user_invitations')
    .insert({
      email,
      role: formData.role,
      note: note || name,
      invited_by: user.id,
      used_at: null,
    })

  if (invitationError) {
    return { error: `등록 실패: ${invitationError.message}` }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/admin/users/new')
  return { success: true, mode: 'registered' }
}
