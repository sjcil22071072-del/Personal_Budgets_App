'use client'

import Link from 'next/link'

interface ReviewTransaction {
  id: string
  participant_name: string
  date: string
  category: string
  funding_source_name: string | null
}

interface Props {
  transactions: ReviewTransaction[]
}

export default function ReviewQueueClient({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-2xl ring-1 ring-zinc-100">
        <span className="text-5xl">✅</span>
        <p className="text-base font-black text-zinc-700">대기 중인 영수증이 없어요</p>
        <p className="text-sm text-zinc-400">모든 거래가 확인 완료되었어요</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <p className="text-sm font-bold text-zinc-500">{transactions.length}건 대기 중</p>

      {transactions.map((tx) => (
        <Link
          key={tx.id}
          href={`/supporter/transactions/${tx.id}`}
          className="block rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200 transition-all hover:ring-zinc-400 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-zinc-900">{tx.participant_name}</p>
              <p className="mt-0.5 truncate text-xs font-bold text-zinc-400">
                {tx.date} · {tx.category || '기타'} · {tx.funding_source_name ?? '재원 미지정'}
              </p>
            </div>
            <span className="text-zinc-300">›</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
