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

  it('uses funding source start_date over participant budget_start_date', () => {
    const update = calculateFundingSourceRollover(
      { budget_start_date: '2026-03-01' },
      {
        monthly_budget: 150000,
        current_month_balance: 40000,
        last_rollover_month: null,
        start_date: '2026-04-01',
      },
      new Date('2026-05-21T00:00:00+09:00')
    )

    // 4월부터 5월까지 2개월 활성 (4월, 5월)
    // 누적 예산: 150,000 * 2 = 300,000
    // totalSpent = 150,000 * 1 - 40,000 = 110,000
    // targetBalance = 300,000 - 110,000 = 190,000
    expect(update).toEqual({
      current_month_balance: 190000,
      last_rollover_month: '2026-05-01',
      months_added: 1,
    })
  })

  it('stops budget accumulation after funding source end_date passes', () => {
    // 3월에 시작해서 4월 30일에 끝난 지원금 (3월, 4월 총 2개월 적용)
    // 현재는 5월 21일이지만 예산 계산은 4월로 제한되어야 함.
    const update = calculateFundingSourceRollover(
      { budget_start_date: '2026-03-01' },
      {
        monthly_budget: 100000,
        current_month_balance: 50000, // 4월 시점 잔액
        last_rollover_month: '2026-04-01',
        end_date: '2026-04-30',
      },
      new Date('2026-05-21T00:00:00+09:00')
    )

    // 이미 last_rollover_month가 limitMonth(4월) 이상이므로 null 리턴
    expect(update).toBeNull()
  })

  it('restricts months active to end_date when running initial rollover past the end date', () => {
    // 3월 시작, 4월 15일 종료인 지원금 (3월, 4월 총 2개월)
    // 5월 21일에 처음으로 이월 계산을 돌리는 경우
    const update = calculateFundingSourceRollover(
      { budget_start_date: '2026-03-01' },
      {
        monthly_budget: 100000,
        current_month_balance: 100000, // 시작 잔액
        last_rollover_month: null,
        end_date: '2026-04-15',
      },
      new Date('2026-05-21T00:00:00+09:00')
    )

    // 3월부터 4월까지 총 2개월치 예산 반영
    // 누적 예산: 100,000 * 2 = 200,000
    // totalSpent = 100,000 * 1 - 100,000 = 0
    // targetBalance = 200,000 - 0 = 200,000
    expect(update).toEqual({
      current_month_balance: 200000,
      last_rollover_month: '2026-04-01', // 종료월(4월)로 고정
      months_added: 1,
    })
  })
})
