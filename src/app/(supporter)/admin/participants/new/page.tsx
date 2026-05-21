'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { createParticipant } from '@/app/actions/admin'

interface FundingSourceInput {
  name: string
  monthly_budget: string
  yearly_budget: string
}

export default function NewParticipantPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [monthlyBudget, setMonthlyBudget] = useState('150000')
  const [yearlyBudget, setYearlyBudget] = useState('1500000')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-12-31')
  const [alertThreshold, setAlertThreshold] = useState('15000')
  const [fundingSourceCount, setFundingSourceCount] = useState(1)
  const [fundingSources, setFundingSources] = useState<FundingSourceInput[]>([
    { name: '주 자원', monthly_budget: '150000', yearly_budget: '1500000' },
  ])

  function handleFundingSourceCountChange(count: number) {
    setFundingSourceCount(count)
    const newSources = [...fundingSources]
    while (newSources.length < count) {
      newSources.push({ name: `자원 ${newSources.length + 1}`, monthly_budget: '0', yearly_budget: '0' })
    }
    while (newSources.length > count) {
      newSources.pop()
    }
    setFundingSources(newSources)
  }

  function updateFundingSource(index: number, field: keyof FundingSourceInput, value: string) {
    const updated = [...fundingSources]
    updated[index] = { ...updated[index], [field]: value }
    setFundingSources(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    if (!email.trim()) {
      setError('이메일을 입력해주세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const result = await createParticipant({
        name: name.trim(),
        email: email.trim(),
        monthlyBudget: Number(monthlyBudget),
        yearlyBudget: Number(yearlyBudget),
        startDate,
        endDate,
        alertThreshold: Number(alertThreshold),
        supporterId: null,
        fundingSources: fundingSources.map((fs) => ({
          name: fs.name,
          monthlyBudget: Number(fs.monthly_budget),
          yearlyBudget: Number(fs.yearly_budget),
        })),
      })

      if (result.error) {
        setError(result.error)
        window.alert(result.error)
        return
      }

      router.push('/admin/participants')
      router.refresh()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.'
      setError(message)
      window.alert(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-zinc-200 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <Link href="/admin/participants" className="mr-3 text-zinc-400 transition-colors hover:text-zinc-600">←</Link>
        <h1 className="text-xl font-bold tracking-tight">새 당사자 등록</h1>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <fieldset className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
            <legend className="px-1 text-xs font-black uppercase tracking-widest text-zinc-400">당사자 정보</legend>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">이름 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="당사자 이름"
                className="rounded-xl bg-zinc-50 p-3 font-medium text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">이메일 *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="participant@example.com"
                className="rounded-xl bg-zinc-50 p-3 font-medium text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400"
                required
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
            <legend className="px-1 text-xs font-black uppercase tracking-widest text-zinc-400">예산 설정</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">월 예산</label>
                <input type="number" value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} className="rounded-xl bg-zinc-50 p-3 font-bold text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">연 예산</label>
                <input type="number" value={yearlyBudget} onChange={(e) => setYearlyBudget(e.target.value)} className="rounded-xl bg-zinc-50 p-3 font-bold text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">운영 시작일</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl bg-zinc-50 p-3 text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">운영 종료일</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl bg-zinc-50 p-3 text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400" required />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">잔액 경고 기준</label>
              <input type="number" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} className="rounded-xl bg-zinc-50 p-3 font-bold text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400" required />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <legend className="px-1 text-xs font-black uppercase tracking-widest text-zinc-400">자원 설정</legend>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleFundingSourceCountChange(Math.max(1, fundingSourceCount - 1))} className="h-8 w-8 rounded-lg bg-zinc-100 font-bold text-zinc-600 transition-colors hover:bg-zinc-200">-</button>
                <span className="w-6 text-center text-sm font-bold text-zinc-700">{fundingSourceCount}</span>
                <button type="button" onClick={() => handleFundingSourceCountChange(Math.min(5, fundingSourceCount + 1))} className="h-8 w-8 rounded-lg bg-zinc-100 font-bold text-zinc-600 transition-colors hover:bg-zinc-200">+</button>
              </div>
            </div>

            {fundingSources.map((fs, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-bold text-zinc-500">자원 {i + 1}</div>
                <input type="text" value={fs.name} onChange={(e) => updateFundingSource(i, 'name', e.target.value)} placeholder="자원 이름" className="rounded-xl bg-white p-3 font-medium text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400" required />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-zinc-400">월 예산</label>
                    <input type="number" value={fs.monthly_budget} onChange={(e) => updateFundingSource(i, 'monthly_budget', e.target.value)} className="rounded-lg bg-white p-2.5 text-sm font-bold text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-zinc-400">연 예산</label>
                    <input type="number" value={fs.yearly_budget} onChange={(e) => updateFundingSource(i, 'yearly_budget', e.target.value)} className="rounded-lg bg-white p-2.5 text-sm font-bold text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-zinc-400" required />
                  </div>
                </div>
              </div>
            ))}
          </fieldset>

          <button type="submit" disabled={saving || !name.trim() || !email.trim()} className="rounded-2xl bg-zinc-900 p-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-zinc-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">
            {saving ? '저장하고 있습니다...' : '당사자 등록하기'}
          </button>
        </form>
      </main>
    </div>
  )
}
