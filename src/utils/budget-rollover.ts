export interface FundingSourceRolloverInput {
  monthly_budget: number | string | null
  current_month_balance: number | string | null
  last_rollover_month?: string | null
  total_spent?: number | string | null
  start_date?: string | null
  end_date?: string | null
}

export interface ParticipantRolloverInput {
  budget_start_date?: string | null
}

export interface FundingSourceRolloverUpdate {
  current_month_balance: number
  last_rollover_month: string
  months_added: number
}

export function toMonthStart(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatMonthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function monthDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

export function isFundingSourceActiveInMonth(
  fs: { start_date?: string | null; end_date?: string | null },
  monthStart: Date
): boolean {
  if (fs.start_date) {
    const startMonth = toMonthStart(fs.start_date)
    if (startMonth && startMonth > monthStart) return false
  }
  if (fs.end_date) {
    const endMonth = toMonthStart(fs.end_date)
    if (endMonth && endMonth < monthStart) return false
  }
  return true
}

export function getFallbackFundingSourceIdForDate(
  dateStr: string,
  fundingSources: any[]
): string | null {
  const txDate = toMonthStart(dateStr)
  if (!txDate) return fundingSources[0]?.id || null

  const activeFs = fundingSources.find((fs) => isFundingSourceActiveInMonth(fs, txDate))
  return activeFs ? activeFs.id : (fundingSources[0]?.id || null)
}

export function calculateFundingSourceRollover(
  participant: ParticipantRolloverInput,
  fundingSource: FundingSourceRolloverInput,
  currentDate: Date = new Date(),
  force = false
): FundingSourceRolloverUpdate | null {
  const currentMonth = toMonthStart(currentDate)
  if (!currentMonth) return null

  const startMonth = fundingSource.start_date
    ? toMonthStart(fundingSource.start_date)
    : (participant.budget_start_date ? toMonthStart(participant.budget_start_date) : null)
  const resolvedStartMonth = startMonth || currentMonth

  const lastRolloverMonth = (fundingSource.last_rollover_month
    ? toMonthStart(fundingSource.last_rollover_month)
    : null) || resolvedStartMonth

  const endMonth = fundingSource.end_date ? toMonthStart(fundingSource.end_date) : null
  const limitMonth = endMonth && endMonth < currentMonth ? endMonth : currentMonth

  if (endMonth && resolvedStartMonth > endMonth) {
    return null
  }

  if (!force && lastRolloverMonth >= limitMonth) return null
  if (!force && lastRolloverMonth >= currentMonth) return null

  const monthsActive = monthDiff(resolvedStartMonth, limitMonth) + 1
  const monthsActiveClamped = monthsActive < 0 ? 0 : monthsActive

  const monthlyBudget = Number(fundingSource.monthly_budget || 0)
  const currentBalance = Number(fundingSource.current_month_balance || 0)

  // Calculate total spent since the start of the budget.
  // If not provided, infer it from the current balance and the months elapsed up to the last rollover.
  let totalSpent = 0
  if (fundingSource.total_spent !== undefined && fundingSource.total_spent !== null) {
    totalSpent = Number(fundingSource.total_spent)
  } else {
    const lastRolloverMonthsActive = monthDiff(resolvedStartMonth, lastRolloverMonth) + 1
    const lastRolloverMonthsClamped = lastRolloverMonthsActive < 0 ? 0 : lastRolloverMonthsActive
    totalSpent = (monthlyBudget * lastRolloverMonthsClamped) - currentBalance
  }

  const targetBalance = monthsActiveClamped === 0 ? 0 : (monthlyBudget * monthsActiveClamped) - totalSpent

  return {
    current_month_balance: targetBalance,
    last_rollover_month: formatMonthStart(limitMonth),
    months_added: monthDiff(lastRolloverMonth, limitMonth),
  }
}

