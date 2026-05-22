'use server'

import { createAdminClient } from '@/utils/supabase/server'
import { calculateFundingSourceRollover } from '@/utils/budget-rollover'

type FundingSourceRow = {
  id: string
  monthly_budget: number | string | null
  yearly_budget: number | string | null
  current_month_balance: number | string | null
  current_year_balance: number | string | null
  last_rollover_month?: string | null
  start_date?: string | null
  end_date?: string | null
}

type ParticipantRow = {
  id: string
  budget_start_date?: string | null
  funding_sources?: FundingSourceRow[]
}

export async function ensureMonthlyBudgetRollover(participantId?: string, force = false) {
  const supabase = createAdminClient()

  let query = supabase
    .from('participants')
    .select('id, budget_start_date, funding_sources(id, monthly_budget, yearly_budget, current_month_balance, current_year_balance, last_rollover_month, start_date, end_date)')

  if (participantId) {
    query = query.eq('id', participantId)
  }

  const { data: participants, error } = await query
  if (error || !participants) {
    if (error) console.error('[budgetRollover] participant query failed:', error)
    return { updated: 0, error: error?.message }
  }

  let updated = 0
  const currentDate = new Date()
  const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)

  for (const participant of participants as ParticipantRow[]) {
    const startDate = participant.budget_start_date || new Date().toISOString().split('T')[0]
    const startMonth = new Date(startDate)
    const resolvedStartMonth = Number.isNaN(startMonth.getTime()) ? currentMonth : new Date(startMonth.getFullYear(), startMonth.getMonth(), 1)

    for (const fundingSource of participant.funding_sources || []) {
      // 해당 지원금의 시작일이 있다면 이를 최우선 적용, 없으면 참여자 시작일 적용
      const effectiveStartDate = fundingSource.start_date || startDate

      // Balance should reflect every recorded transaction. The review status is
      // only for receipt/admin workflow, not for excluding spending from budget math.
      let spentQuery = supabase
        .from('transactions')
        .select('amount, funding_source_id')
        .eq('participant_id', participant.id)
        .gte('date', effectiveStartDate)

      if (fundingSource.end_date) {
        spentQuery = spentQuery.lte('date', fundingSource.end_date)
      }

      const { data: spentData, error: spentError } = await spentQuery

      if (spentError) {
        console.error('[budgetRollover] spent query failed:', spentError)
        continue
      }

      const onlyFundingSource = (participant.funding_sources || []).length === 1
      const totalSpent = (spentData || []).reduce((sum, tx) => {
        const txFundingSourceId = tx.funding_source_id || null
        const belongsToSource = txFundingSourceId === fundingSource.id
        const isLegacyUnassigned = onlyFundingSource && !txFundingSourceId
        return belongsToSource || isLegacyUnassigned ? sum + Number(tx.amount || 0) : sum
      }, 0)

      const rollover = calculateFundingSourceRollover(
        participant,
        {
          ...fundingSource,
          total_spent: totalSpent
        },
        currentDate,
        force
      )

      // 지원금 날짜를 반영한 연도 계산용 시작/종료월 도출
      const fsStart = fundingSource.start_date ? new Date(fundingSource.start_date) : null
      const fsResolvedStartMonth = fsStart && !Number.isNaN(fsStart.getTime()) 
        ? new Date(fsStart.getFullYear(), fsStart.getMonth(), 1) 
        : resolvedStartMonth
      
      const fsEnd = fundingSource.end_date ? new Date(fundingSource.end_date) : null
      const fsResolvedEndMonth = fsEnd && !Number.isNaN(fsEnd.getTime())
        ? new Date(fsEnd.getFullYear(), fsEnd.getMonth(), 1)
        : null
      const limitMonth = fsResolvedEndMonth && fsResolvedEndMonth < currentMonth ? fsResolvedEndMonth : currentMonth

      // Calculate stateless yearly balance
      const startYear = fsResolvedStartMonth.getFullYear()
      const currentYear = limitMonth.getFullYear()
      let yearsActive = 0
      if (fsResolvedStartMonth <= limitMonth) {
        yearsActive = currentYear - startYear + 1
      }
      const yearsActiveClamped = yearsActive < 0 ? 0 : yearsActive
      const yearlyBudget = Number(fundingSource.yearly_budget || 0)
      const targetYearBalance = yearsActiveClamped === 0 ? 0 : (yearlyBudget * yearsActiveClamped) - totalSpent

      if (!rollover && !force) continue

      const updateData: any = {
        current_year_balance: targetYearBalance,
      }

      if (rollover) {
        updateData.current_month_balance = rollover.current_month_balance
        updateData.last_rollover_month = rollover.last_rollover_month
      } else if (force) {
        // If force is true, we should also update current_month_balance in case it was out of sync
        // even if rollover was null (which happens if last_rollover_month is already currentMonth)
        const monthlyBudget = Number(fundingSource.monthly_budget || 0)
        let monthsActive = 0
        if (fsResolvedStartMonth <= limitMonth) {
          monthsActive = ((limitMonth.getFullYear() - fsResolvedStartMonth.getFullYear()) * 12) + (limitMonth.getMonth() - fsResolvedStartMonth.getMonth()) + 1
        }
        const monthsActiveClamped = monthsActive < 0 ? 0 : monthsActive
        updateData.current_month_balance = monthsActiveClamped === 0 ? 0 : (monthlyBudget * monthsActiveClamped) - totalSpent
        updateData.last_rollover_month = `${limitMonth.getFullYear()}-${String(limitMonth.getMonth() + 1).padStart(2, '0')}-01`
      }

      const { error: updateError } = await supabase
        .from('funding_sources')
        .update(updateData)
        .eq('id', fundingSource.id)

      if (updateError) {
        console.error('[budgetRollover] funding source update failed:', updateError)
        continue
      }

      updated += 1
    }
  }

  return { updated }
}

