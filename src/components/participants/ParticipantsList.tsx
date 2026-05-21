'use client'

import Link from 'next/link'

interface FundingSource {
  id: string
  name: string
  monthly_budget: number
  current_month_balance: number
}

interface Participant {
  id: string
  name?: string
  funding_sources?: FundingSource[]
}

interface ParticipantsListProps {
  participants: Participant[]
}

export default function ParticipantsList({ participants }: ParticipantsListProps) {
  if (!participants || participants.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
        <p className="font-medium text-zinc-500">아직 등록된 당사자가 없습니다.</p>
        <p className="mt-1 text-sm text-zinc-400">위 버튼을 눌러 당사자를 등록하세요.</p>
      </div>
    )
  }

  return (
    <>
      {participants.map((p) => {
        const totalBalance = (p.funding_sources || []).reduce(
          (acc, fs) => acc + Number(fs.current_month_balance),
          0
        )
        const totalBudget = (p.funding_sources || []).reduce(
          (acc, fs) => acc + Number(fs.monthly_budget),
          0
        )
        const percentage = totalBudget > 0 ? Math.round((totalBalance / totalBudget) * 100) : 0

        return (
          <Link
            key={p.id}
            href={`/admin/participants/${p.id}`}
            className="block rounded-3xl bg-white p-5 border border-zinc-200/80 transition-all hover:border-zinc-350 hover:bg-zinc-50/30 active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.015)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100/80 text-sm font-black text-zinc-600">
                  {(p.name || '?')[0]}
                </div>
                <div>
                  <p className="font-bold text-zinc-800 text-sm">{p.name || '이름 없음'}</p>
                  <p className="text-[11px] text-zinc-400 font-medium">자원 {p.funding_sources?.length || 0}개</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-base font-black ${
                  percentage <= 20 ? 'text-red-500' : percentage <= 40 ? 'text-orange-500' : 'text-zinc-800'
                }`}>
                  {percentage}%
                </p>
                <p className="text-[10px] text-zinc-400 font-bold">이번 달 잔액</p>
              </div>
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full transition-all ${
                  percentage <= 20 ? 'bg-red-500' : percentage <= 40 ? 'bg-orange-500' : 'bg-zinc-800'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </Link>
        )
      })}
    </>
  )
}
