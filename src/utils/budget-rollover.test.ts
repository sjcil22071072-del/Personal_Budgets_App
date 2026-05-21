import { describe, expect, it } from 'vitest'
import { calculateFundingSourceRollover } from './budget-rollover'

describe('calculateFundingSourceRollover', () => {
  it('adds missed monthly budgets from the participant start month', () => {
    const update = calculateFundingSourceRollover(
      { budget_start_date: '2026-03-01' },
      {
        monthly_budget: 150000,
        current_month_balance: 40000,
        last_rollover_month: null,
      },
      new Date('2026-05-21T00:00:00+09:00')
    )

    expect(update).toEqual({
      current_month_balance: 340000,
      last_rollover_month: '2026-05-01',
      months_added: 2,
    })
  })

  it('does not add the same month twice', () => {
    const update = calculateFundingSourceRollover(
      { budget_start_date: '2026-03-01' },
      {
        monthly_budget: 150000,
        current_month_balance: 340000,
        last_rollover_month: '2026-05-01',
      },
      new Date('2026-05-21T00:00:00+09:00')
    )

    expect(update).toBeNull()
  })

  it('waits until the start month when the budget starts in the future', () => {
    const update = calculateFundingSourceRollover(
      { budget_start_date: '2026-06-01' },
      {
        monthly_budget: 150000,
        current_month_balance: 150000,
        last_rollover_month: null,
      },
      new Date('2026-05-21T00:00:00+09:00')
    )

    expect(update).toBeNull()
  })
})
