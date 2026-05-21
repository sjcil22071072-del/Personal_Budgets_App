export interface FundingSourceRolloverInput {
  monthly_budget: number | string | null
  current_month_balance: number | string | null
  last_rollover_month?: string | null
}

export interface ParticipantRolloverInput {
  budget_start_date?: string | null
}

export interface FundingSourceRolloverUpdate {
  current_month_balance: number
  last_rollover_month: string
  months_added: number
}

function toMonthStart(value: string | Date): Date | null {
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

export function calculateFundingSourceRollover(
  participant: ParticipantRolloverInput,
  fundingSource: FundingSourceRolloverInput,
  currentDate: Date = new Date()
): FundingSourceRolloverUpdate | null {
  const currentMonth = toMonthStart(currentDate)
  if (!currentMonth) return null

  const startMonth = participant.budget_start_date
    ? toMonthStart(participant.budget_start_date)
    : null
  const lastRolloverMonth = fundingSource.last_rollover_month
    ? toMonthStart(fundingSource.last_rollover_month)
    : startMonth

  if (!lastRolloverMonth || lastRolloverMonth > currentMonth) return null

  const monthsToAdd = monthDiff(lastRolloverMonth, currentMonth)
  if (monthsToAdd <= 0) return null

  const monthlyBudget = Number(fundingSource.monthly_budget || 0)
  const currentBalance = Number(fundingSource.current_month_balance || 0)

  return {
    current_month_balance: currentBalance + monthlyBudget * monthsToAdd,
    last_rollover_month: formatMonthStart(currentMonth),
    months_added: monthsToAdd,
  }
}
