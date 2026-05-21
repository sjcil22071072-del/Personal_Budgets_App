'use server'

import { createAdminClient } from '@/utils/supabase/server'
import { calculateFundingSourceRollover } from '@/utils/budget-rollover'

type FundingSourceRow = {
  id: string
  monthly_budget: number | string | null
  current_month_balance: number | string | null
  last_rollover_month?: string | null
}

type ParticipantRow = {
  id: string
  budget_start_date?: string | null
  funding_sources?: FundingSourceRow[]
}

export async function ensureMonthlyBudgetRollover(participantId?: string) {
  const supabase = createAdminClient()

  let query = supabase
    .from('participants')
    .select('id, budget_start_date, funding_sources(id, monthly_budget, current_month_balance, last_rollover_month)')

  if (participantId) {
    query = query.eq('id', participantId)
  }

  const { data: participants, error } = await query
  if (error || !participants) {
    if (error) console.error('[budgetRollover] participant query failed:', error)
    return { updated: 0, error: error?.message }
  }

  let updated = 0
  for (const participant of participants as ParticipantRow[]) {
    for (const fundingSource of participant.funding_sources || []) {
      const rollover = calculateFundingSourceRollover(participant, fundingSource)
      if (!rollover) continue

      const { error: updateError } = await supabase
        .from('funding_sources')
        .update({
          current_month_balance: rollover.current_month_balance,
          last_rollover_month: rollover.last_rollover_month,
        })
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
