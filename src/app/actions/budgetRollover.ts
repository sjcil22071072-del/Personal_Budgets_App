'use server'

import { createAdminClient } from '@/utils/supabase/server'
import {
  getFallbackFundingSourceIdForDate,
} from '@/utils/budget-rollover'

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

function formatMonthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
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
  const targetLastRollover = formatMonthStart(currentMonth)

  for (const participant of participants as ParticipantRow[]) {
    // force가 아닐 때, 모든 재원의 last_rollover_month가 이미 당월(targetLastRollover)과 같다면 Skip
    if (!force) {
      const needsRollover = (participant.funding_sources || []).some(
        (fs) => fs.last_rollover_month !== targetLastRollover
      )
      if (!needsRollover) {
        continue
      }
    }

    const startDate = participant.budget_start_date || '2026-05-01'
    const startMonth = new Date(startDate)
    const resolvedStartMonth = Number.isNaN(startMonth.getTime()) ? currentMonth : new Date(startMonth.getFullYear(), startMonth.getMonth(), 1)

    // 당사자의 모든 거래 내역 조회 (재원 매칭 및 계산용)
    const { data: spentData, error: spentError } = await supabase
      .from('transactions')
      .select('amount, funding_source_id, date')
      .eq('participant_id', participant.id)
      .neq('status', 'rejected')

    if (spentError) {
      console.error('[budgetRollover] spent query failed:', spentError)
      continue
    }

    // 재원 목록을 시작일 기준 시간순 정렬
    const sortedFundingSources = [...(participant.funding_sources || [])].sort((a, b) => {
      const aDate = a.start_date || startDate
      const bDate = b.start_date || startDate
      return aDate.localeCompare(bDate)
    })

    const fundingSourceIds = new Set(sortedFundingSources.map((fs) => fs.id))
    let carryoverAmount = 0
    let carryoverYearAmount = 0

    for (const fundingSource of sortedFundingSources) {
      const effectiveStartDate = fundingSource.start_date || startDate

      // 활성 월 계산 및 한계 월 도출
      const fsStart = fundingSource.start_date ? new Date(fundingSource.start_date) : null
      const fsResolvedStartMonth = fsStart && !Number.isNaN(fsStart.getTime()) 
        ? new Date(fsStart.getFullYear(), fsStart.getMonth(), 1) 
        : resolvedStartMonth
      
      const fsEnd = fundingSource.end_date ? new Date(fundingSource.end_date) : null
      const fsResolvedEndMonth = fsEnd && !Number.isNaN(fsEnd.getTime())
        ? new Date(fsEnd.getFullYear(), fsEnd.getMonth(), 1)
        : null
      const limitMonth = fsResolvedEndMonth && fsResolvedEndMonth < currentMonth ? fsResolvedEndMonth : currentMonth

      const nextMonthOfLimit = new Date(limitMonth.getFullYear(), limitMonth.getMonth() + 1, 1)
      const limitMonthEndStr = nextMonthOfLimit.toISOString().split('T')[0]

      // 해당 재원에 매칭되는 거래 내역 필터링 (날짜 범위 및 fallback 고려)
      const fsTransactions = (spentData || []).filter((tx) => {
        if (tx.date < effectiveStartDate) return false
        if (fundingSource.end_date && tx.date > fundingSource.end_date) return false
        if (tx.date >= limitMonthEndStr) return false

        const txFundingSourceId = tx.funding_source_id || null
        if (txFundingSourceId === fundingSource.id) return true
        if (!txFundingSourceId || !fundingSourceIds.has(txFundingSourceId)) {
          return getFallbackFundingSourceIdForDate(tx.date, sortedFundingSources) === fundingSource.id
        }
        return false
      })

      const totalSpent = fsTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

      // 이번 달 기준 종료 여부 판단
      const isEnded = fsResolvedEndMonth && fsResolvedEndMonth < currentMonth

      // 활성 개월 수 계산
      let monthsActive = 0
      if (fsResolvedStartMonth <= limitMonth) {
        monthsActive = ((limitMonth.getFullYear() - fsResolvedStartMonth.getFullYear()) * 12) + (limitMonth.getMonth() - fsResolvedStartMonth.getMonth()) + 1
      }
      const monthsActiveClamped = monthsActive < 0 ? 0 : monthsActive
      const monthlyBudget = Number(fundingSource.monthly_budget || 0)
      const remainingBalance = monthsActiveClamped === 0 ? 0 : (monthlyBudget * monthsActiveClamped) - totalSpent

      // 이월 금액 합산
      const targetBalance = remainingBalance + carryoverAmount

      // 연도별 예산 계산
      const startYear = fsResolvedStartMonth.getFullYear()
      const currentYear = limitMonth.getFullYear()
      let yearsActive = 0
      if (fsResolvedStartMonth <= limitMonth) {
        yearsActive = currentYear - startYear + 1
      }
      const yearsActiveClamped = yearsActive < 0 ? 0 : yearsActive
      const yearlyBudget = Number(fundingSource.yearly_budget || 0)
      const remainingYearBalance = yearsActiveClamped === 0 ? 0 : (yearlyBudget * yearsActiveClamped) - totalSpent
      const targetYearBalance = remainingYearBalance + carryoverYearAmount

      // 종료된 재원이면 잔액을 이월 변수에 저장하고 다음 루프로 전달, 활성 재원이면 이월을 흡수하고 이월변수 초기화
      if (isEnded) {
        carryoverAmount = targetBalance
        carryoverYearAmount = targetYearBalance
      } else {
        carryoverAmount = 0
        carryoverYearAmount = 0
      }

      // 강제 업데이트(force=true) 혹은 월 이월이 실제로 필요한 경우에만 업데이트
      const currentDbBalance = Number(fundingSource.current_month_balance || 0)
      const currentDbYearBalance = Number(fundingSource.current_year_balance || 0)
      const currentDbLastRollover = fundingSource.last_rollover_month || ''
      const targetLastRollover = formatMonthStart(limitMonth)

      const needsUpdate =
        force ||
        currentDbBalance !== targetBalance ||
        currentDbYearBalance !== targetYearBalance ||
        currentDbLastRollover !== targetLastRollover

      if (needsUpdate) {
        const updateData = {
          current_month_balance: targetBalance,
          current_year_balance: targetYearBalance,
          last_rollover_month: targetLastRollover,
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
  }

  return { updated }
}
