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
    .select('id, budget_start_date, funding_sources(id, monthly_budget, yearly_budget, current_month_balance, current_year_balance, last_rollover_month)')

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
      // Query total confirmed spent since the budget start date
      const { data: spentData, error: spentError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('funding_source_id', fundingSource.id)
        .eq('status', 'confirmed')
        .gte('date', startDate)

      if (spentError) {
        console.error('[budgetRollover] spent query failed:', spentError)
        continue
      }

      const totalSpent = (spentData || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

      const rollover = calculateFundingSourceRollover(
        participant,
        {
          ...fundingSource,
          total_spent: totalSpent
        },
        currentDate,
        force
      )

      // Calculate stateless yearly balance
      const startYear = resolvedStartMonth.getFullYear()
      const currentYear = currentMonth.getFullYear()
      const yearsActive = currentYear - startYear + 1
      const yearsActiveClamped = yearsActive < 1 ? 1 : yearsActive
      const yearlyBudget = Number(fundingSource.yearly_budget || 0)
      const targetYearBalance = (yearlyBudget * yearsActiveClamped) - totalSpent

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
        const monthsActive = ((currentMonth.getFullYear() - resolvedStartMonth.getFullYear()) * 12) + (currentMonth.getMonth() - resolvedStartMonth.getMonth()) + 1
        const monthsActiveClamped = monthsActive < 1 ? 1 : monthsActive
        updateData.current_month_balance = (monthlyBudget * monthsActiveClamped) - totalSpent
        updateData.last_rollover_month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`
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

