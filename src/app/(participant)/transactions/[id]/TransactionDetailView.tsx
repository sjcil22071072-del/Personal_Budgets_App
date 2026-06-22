'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/utils/budget-visuals'
import { EasyTerm } from '@/components/ui/EasyTerm'
import ActivityCategoryPicker, {
  getActivityMajor,
} from "@/components/transactions/ActivityCategoryPicker"
import { updateTransaction, deleteTransaction } from '@/app/actions/transaction'
import { extractStoragePath } from '@/utils/supabase/storage'
import ImageLightbox from '@/components/ui/ImageLightbox'
import RotatableImage from '@/components/ui/RotatableImage'

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
  show_memo_to_participant?: boolean | null
  image_rotations?: any | null
}

export default function TransactionDetailView({ tx }: { tx: Tx }) {
  const router = useRouter()
  const receiptUrls = tx.receipt_image_urls || []
  const activityUrls = tx.activity_image_urls || []
  const evidenceUrls = tx.evidence_image_urls || []

  const displayCategory =
    tx.category && tx.category.includes(' - ')
      ? tx.category
      : tx.activity_name && tx.activity_name.includes(' - ')
      ? tx.activity_name
      : tx.category
      ? tx.category
      : '기타'

  const [isEditing, setIsEditing] = useState(false)
  const [editDate, setEditDate] = useState(tx.date)
  const [editAmount, setEditAmount] = useState(String(Math.abs(tx.amount)))
  const [editDescription, setEditDescription] = useState(displayCategory)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!window.confirm('이 영수증 내역을 정말 삭제하시겠습니까? 등록된 모든 사진 파일도 함께 삭제됩니다.')) {
      return
    }
    setDeleting(true)
    try {
      const result = await deleteTransaction(tx.id)
      if (result.success) {
        alert('영수증 내역이 정상적으로 삭제되었습니다.')
        router.push('/')
      }
    } catch (err: any) {
      alert(err.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSave() {
    const parts = editDescription.split(" - ");
    if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
      setError("대분류와 중분류를 모두 선택해 주세요.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const originalSign = Math.sign(tx.amount) || -1;
      const finalAmount = Number(editAmount) * originalSign;

      const result = await updateTransaction(tx.id, {
        date: editDate,
        amount: finalAmount,
        activity_name: editDescription,
        category: getActivityMajor(editDescription),
      });

      if (result.success) {
        setIsEditing(false);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const initialTab =
    receiptUrls.length === 0 && activityUrls.length > 0 ? 'activity' : 'receipt'

  const [viewTab, setViewTab] = useState<'receipt' | 'activity' | 'evidence'>(initialTab)
  const [imgIdx, setImgIdx] = useState(0)
  const [zoomTargetUrl, setZoomTargetUrl] = useState<string | null>(null)

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



  const hasPhotos =
    receiptUrls.length > 0 || activityUrls.length > 0 || evidenceUrls.length > 0

  return (
    <div className="flex flex-col min-h-dvh easy-read-bg text-foreground participant-view pb-10">
      {/* 헤더 */}
      <header className="flex h-14 items-center gap-3 px-4 sticky top-0 bg-white/90 backdrop-blur-md border-b border-zinc-150/80 z-10">
        <Link
          href="/"
          className="text-zinc-400 hover:text-zinc-700 text-xl font-bold transition-colors px-1"
          aria-label="뒤로 가기"
        >
          ←
        </Link>
        <h1 className="text-base font-black text-zinc-800">영수증 상세 보기</h1>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">

        {/* 메모 배너 (거절 사유 또는 안내 사항) */}
        {(tx.status === 'rejected' || tx.show_memo_to_participant) && tx.memo && (
          tx.status === 'rejected' ? ( 
            <div className="p-5 rounded-2xl bg-red-50 border border-red-200 flex flex-col gap-2 shadow-sm animate-fade-in-up">
              <div className="flex items-center gap-2">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="font-black text-red-800 text-sm">승인이 거절되었습니다</p>
                  <p className="text-xs text-red-500 font-bold mt-0.5">담당자가 거절 사유를 남겼어요</p>
                </div>
              </div>
              <div className="bg-red-100/60 rounded-xl p-3 ml-8">
                <p className="text-sm text-red-800 font-bold leading-relaxed">{tx.memo}</p>
              </div>
            </div>
          ) : ( 
            <div className="p-5 rounded-2xl bg-sky-50 border border-sky-100 flex flex-col gap-2 shadow-sm animate-fade-in-up">
              <div className="flex items-center gap-2">
                <span className="text-2xl">ℹ️</span>
                <div>
                  <p className="font-black text-sky-900 text-sm">담당 선생님의 안내 사항</p>
                  <p className="text-xs text-sky-500 font-bold mt-0.5">메모가 작성되어 안내해 드려요</p>
                </div>
              </div>
              <div className="bg-sky-100/40 rounded-xl p-3 ml-8">
                <p className="text-sm text-sky-850 font-bold leading-relaxed">{tx.memo}</p>
              </div>
            </div>
          )
        )}

        {/* 상태 뱃지 */}
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} text-sm font-black w-fit shadow-sm`}
        >
          {statusConfig.icon} <EasyTerm formal={statusConfig.label} easy={statusConfig.label} />
        </div>

        {/* 핵심 정보 카드 */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col gap-4">
          {isEditing ? (
            <div className="flex flex-col gap-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 animate-fade-in-up">
                  {error}
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-450 font-black">📅 언제인가요? (날짜)</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-lg font-bold transition-all focus:ring-2 focus:ring-primary outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-450 font-black">💰 얼마인가요? (금액)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-lg font-bold transition-all focus:ring-2 focus:ring-primary outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-450 font-black">📝 무엇을 했나요? (분류)</label>
                <ActivityCategoryPicker
                  value={editDescription}
                  onChange={setEditDescription}
                />
              </div>
            </div>
          ) : (
            <>
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
                  {(() => {
                    const bucket = viewTab === 'receipt' ? 'receipts' : viewTab === 'activity' ? 'activity-photos' : 'evidence-documents'
                    const mainPath = extractStoragePath(currentUrls[imgIdx], bucket) || currentUrls[imgIdx]
                    const mainRotation = (tx.image_rotations as any)?.[mainPath] ?? 0
                    return (
                      <>
                        <RotatableImage
                          src={currentUrls[imgIdx]}
                          alt={`사진 ${imgIdx + 1}`}
                          rotation={mainRotation}
                          onClick={() => setZoomTargetUrl(currentUrls[imgIdx])}
                        />
                        {currentUrls.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto pb-1 w-full justify-center">
                            {currentUrls.map((url, i) => {
                              const path = extractStoragePath(url, bucket) || url
                              const rotation = (tx.image_rotations as any)?.[path] ?? 0
                              return (
                                <button
                                  key={`${url}-${i}`}
                                  onClick={() => setImgIdx(i)}
                                  className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden ring-2 transition-all ${
                                    i === imgIdx ? 'ring-blue-500 scale-105' : 'ring-zinc-200 hover:ring-zinc-400'
                                  }`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`썸네일 ${i + 1}`}
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                    className="w-full h-full object-contain bg-zinc-50"
                                  />
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )
                  })()}
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

        {/* 수정 모드 버튼들 */}
        {isEditing ? (
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditDate(tx.date);
                setEditAmount(String(Math.abs(tx.amount)));
                setEditDescription(displayCategory);
                setError(null);
              }}
              disabled={saving}
              className="flex-1 p-4 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-700 font-black text-center text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 p-4 rounded-2xl bg-green-600 text-white font-black text-center text-sm hover:bg-green-700 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  저장 중...
                </>
              ) : (
                "저장하기"
              )}
            </button>
          </div>
        ) : (
          tx.status === 'pending' && (
            <div className="flex flex-col gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full p-4 rounded-2xl bg-blue-600 text-white font-black text-center text-sm hover:bg-blue-700 active:scale-[0.99] transition-all shadow-md"
              >
                기록 수정하기
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full p-4 rounded-2xl border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-650 font-black text-center text-sm active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-red-650/40 border-t-red-650 rounded-full animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  "삭제하기"
                )}
              </button>
            </div>
          )
        )}


      </main>

      {zoomTargetUrl && (
        <ImageLightbox
          src={zoomTargetUrl}
          initialRotation={(() => {
            const bucket = viewTab === 'receipt' ? 'receipts' : viewTab === 'activity' ? 'activity-photos' : 'evidence-documents'
            const path = extractStoragePath(zoomTargetUrl, bucket) || zoomTargetUrl
            return (tx.image_rotations as any)?.[path] ?? 0
          })()}
          showRotate={false}
          onClose={() => setZoomTargetUrl(null)}
        />
      )}
    </div>
  )
}
