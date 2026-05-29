'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'
import { EasyTerm } from '@/components/ui/EasyTerm'

interface Tx {
  id: string
  activity_name: string
  amount: number
  date: string
  category: string | null
  memo: string | null
  payment_method: string | null
  status: 'pending' | 'confirmed' | 'rejected'
  receipt_image_urls?: string[] | null
  activity_image_urls?: string[] | null
  evidence_image_urls?: string[] | null
  place_name?: string | null
}

export default function TransactionDetailView({ tx }: { tx: Tx }) {
  const receiptUrls = tx.receipt_image_urls || []
  const activityUrls = tx.activity_image_urls || []
  const evidenceUrls = tx.evidence_image_urls || []

  const initialTab =
    receiptUrls.length === 0 && activityUrls.length > 0 ? 'activity' : 'receipt'

  const [viewTab, setViewTab] = useState<'receipt' | 'activity' | 'evidence'>(initialTab)
  const [imgIdx, setImgIdx] = useState(0)

  const currentUrls =
    viewTab === 'receipt'
      ? receiptUrls
      : viewTab === 'activity'
      ? activityUrls
      : evidenceUrls

  // 거절된 거래면 확인한 것으로 localStorage에 저장
  useEffect(() => {
    if (tx.status === 'rejected') {
      try {
        const raw = localStorage.getItem('seen_rejected_txs')
        const seen: string[] = raw ? JSON.parse(raw) : []
        if (!seen.includes(tx.id)) {
          seen.push(tx.id)
          localStorage.setItem('seen_rejected_txs', JSON.stringify(seen))
          // 다른 탭/홈 컴포넌트에 알림
          window.dispatchEvent(new Event('seen_rejected_updated'))
        }
      } catch {}
    }
  }, [tx.id, tx.status])

  const statusConfig = {
    pending: { label: '확인 중', bg: 'bg-orange-100', text: 'text-orange-700', icon: '⏳', border: 'border-orange-200' },
    confirmed: { label: '확정 완료', bg: 'bg-green-100', text: 'text-green-700', icon: '✅', border: 'border-green-200' },
    rejected: { label: '승인 거절', bg: 'bg-red-100', text: 'text-red-700', icon: '❌', border: 'border-red-200' },
  }[tx.status]

  const displayCategory =
    tx.category && tx.category.includes(' - ')
      ? tx.category
      : tx.activity_name && tx.activity_name.includes(' - ')
      ? tx.activity_name
      : tx.category
      ? tx.category
      : '기타'

  const hasPhotos =
    receiptUrls.length > 0 || activityUrls.length > 0 || evidenceUrls.length > 0

  return (
    <div className="flex flex-col min-h-dvh easy-read-bg text-foreground participant-view pb-10">
      {/* 헤더 */}
      <header className="flex h-14 items-center gap-3 px-4 sticky top-0 bg-white/90 backdrop-blur-md border-b border-zinc-150/80 z-10">
        <Link
          href="/calendar"
          className="text-zinc-400 hover:text-zinc-700 text-xl font-bold transition-colors px-1"
          aria-label="뒤로 가기"
        >
          ←
        </Link>
        <h1 className="text-base font-black text-zinc-800">영수증 상세 보기</h1>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">

        {/* 거절 배너 (강조) */}
        {tx.status === 'rejected' && (
          <div className="p-5 rounded-2xl bg-red-50 border border-red-200 flex flex-col gap-2 shadow-sm animate-fade-in-up">
            <div className="flex items-center gap-2">
              <span className="text-2xl">❌</span>
              <div>
                <p className="font-black text-red-800 text-sm">승인이 거절되었습니다</p>
                <p className="text-xs text-red-500 font-bold mt-0.5">담당자가 거절 사유를 남겼어요</p>
              </div>
            </div>
            {tx.memo && (
              <div className="bg-red-100/60 rounded-xl p-3 ml-8">
                <p className="text-sm text-red-800 font-bold leading-relaxed">{tx.memo}</p>
              </div>
            )}
          </div>
        )}

        {/* 상태 뱃지 */}
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} text-sm font-black w-fit shadow-sm`}
        >
          {statusConfig.icon} <EasyTerm formal={statusConfig.label} easy={statusConfig.label} />
        </div>

        {/* 핵심 정보 카드 */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col gap-4">
          <div>
            <p className="text-xs text-zinc-400 font-black uppercase tracking-wider mb-1">분류</p>
            <p className="text-2xl font-black text-zinc-900">{displayCategory}</p>
          </div>
          <div className="h-px bg-zinc-100" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-400 font-black uppercase tracking-wider mb-1">날짜</p>
              <p className="font-bold text-zinc-800 text-base">{tx.date}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 font-black uppercase tracking-wider mb-1">금액</p>
              <p className="font-black text-zinc-900 text-lg">{formatCurrency(Math.abs(tx.amount))}원</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 font-black uppercase tracking-wider mb-1">결제 수단</p>
              <p className="font-bold text-zinc-800">{tx.payment_method || '카드'}</p>
            </div>
            {tx.place_name && (
              <div>
                <p className="text-xs text-zinc-400 font-black uppercase tracking-wider mb-1">장소</p>
                <p className="font-bold text-zinc-800 text-sm">{tx.place_name}</p>
              </div>
            )}
          </div>
          {tx.activity_name && (
            <>
              <div className="h-px bg-zinc-100" />
              <div>
                <p className="text-xs text-zinc-400 font-black uppercase tracking-wider mb-1">활동 내용</p>
                <p className="font-medium text-zinc-700 text-sm leading-relaxed">{tx.activity_name}</p>
              </div>
            </>
          )}

        </div>

        {/* 사진 뷰어 */}
        {hasPhotos && (
          <div className="flex flex-col gap-3">
            {/* 탭 */}
            <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
              {receiptUrls.length > 0 && (
                <button
                  onClick={() => { setViewTab('receipt'); setImgIdx(0) }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    viewTab === 'receipt' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  🧾 영수증 ({receiptUrls.length})
                </button>
              )}
              {activityUrls.length > 0 && (
                <button
                  onClick={() => { setViewTab('activity'); setImgIdx(0) }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    viewTab === 'activity' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  📷 활동사진 ({activityUrls.length})
                </button>
              )}
              {evidenceUrls.length > 0 && (
                <button
                  onClick={() => { setViewTab('evidence'); setImgIdx(0) }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    viewTab === 'evidence' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  📋 증빙서류 ({evidenceUrls.length})
                </button>
              )}
            </div>

            {/* 이미지 */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 flex flex-col items-center gap-3">
              {currentUrls.length > 0 ? (
                <>
                  <div className="relative w-full rounded-xl overflow-hidden bg-zinc-100" style={{ minHeight: 240 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentUrls[imgIdx]}
                      alt={`사진 ${imgIdx + 1}`}
                      className="w-full max-h-[400px] object-contain mx-auto block"
                    />
                  </div>
                  {currentUrls.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 w-full justify-center">
                      {currentUrls.map((url, i) => (
                        <button
                          key={`${url}-${i}`}
                          onClick={() => setImgIdx(i)}
                          className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden ring-2 transition-all ${
                            i === imgIdx ? 'ring-blue-500 scale-105' : 'ring-zinc-200 hover:ring-zinc-400'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`썸네일 ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-zinc-400 font-bold">{imgIdx + 1} / {currentUrls.length}장</p>
                </>
              ) : (
                <div className="py-10 flex flex-col items-center gap-2 text-zinc-400">
                  <span className="text-4xl">🖼️</span>
                  <p className="text-sm font-medium">사진이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 뒤로 버튼 */}
        <Link
          href="/calendar"
          className="w-full mt-2 p-4 rounded-2xl bg-zinc-900 text-white font-black text-center text-sm hover:bg-zinc-800 active:scale-[0.99] transition-all shadow-md"
        >
          달력으로 돌아가기
        </Link>
      </main>
    </div>
  )
}
