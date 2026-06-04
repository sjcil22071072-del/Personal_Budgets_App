/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { compressImage } from '@/utils/image-compression'
import { formatCurrency } from '@/utils/budget-visuals'
import ActivityCategoryPicker from '@/components/transactions/ActivityCategoryPicker'
import {
  updateTransactionDetail,
  deleteTransactionWithBalance,
  addReceiptImage,
  removeReceiptImage,
  addActivityImage,
  removeActivityImage,
  addEvidenceImage,
  removeEvidenceImage,
} from '@/app/actions/transaction'

const PAYMENT_METHODS = ['카드', '계좌이체'] as const

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
  funding_source_id: string | null
  participant_id: string | null
  participant: { name: string } | null
  funding_source: { name: string } | null
  place_name?: string | null
  place_lat?: number | null
  place_lng?: number | null
  receipt_reviewed?: boolean | null
  show_memo_to_participant?: boolean | null
}

export default function TransactionDetailClient({ tx }: { tx: Tx }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [activityName, setActivityName] = useState(tx.activity_name)
  const [amount, setAmount] = useState(String(Math.abs(tx.amount)))

  // 중분류가 정상적으로 포함되어 있는지 확인하는 함수 (형식: "대분류 - 중분류")
  const hasMinorCategory = (cat: string | null) => {
    if (!cat) return false
    const parts = cat.split(' - ')
    return parts.length >= 2 && parts[0].trim() !== '' && parts[1].trim() !== ''
  }

  // 초기 카테고리값 설정: 기존 카테고리에 중분류가 없으면 당사자가 작성한 활동명(activity_name)에서 추출
  const getInitialCategory = () => {
    if (hasMinorCategory(tx.category)) {
      return tx.category as string
    }
    if (hasMinorCategory(tx.activity_name)) {
      return tx.activity_name
    }
    return tx.category || ''
  }

  const [category, setCategory] = useState(getInitialCategory)

  // 분류(category)가 변경되면 활동내용(activityName)도 동일하게 자동 설정
  useEffect(() => {
    if (category) {
      setActivityName(category)
    }
  }, [category])

  const [memo, setMemo] = useState(tx.memo || '')
  const [date, setDate] = useState(tx.date)
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>(
    tx.payment_method === '계좌이체' ? '계좌이체' : '카드'
  )
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'rejected'>(tx.status)
  const [receiptReviewed, setReceiptReviewed] = useState(tx.receipt_reviewed ?? false)
  const [showMemoToParticipant, setShowMemoToParticipant] = useState(tx.show_memo_to_participant ?? false)
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)

  // 이미지 상태 (최대 5장씩)
  const [receiptUrls, setReceiptUrls] = useState<string[]>(tx.receipt_image_urls || [])
  const [activityUrls, setActivityUrls] = useState<string[]>(tx.activity_image_urls || [])
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(tx.evidence_image_urls || [])

  // 드래그 앤 드롭 상태
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [draggedType, setDraggedType] = useState<'receipt' | 'evidence' | 'activity' | null>(null)

  const handleDragStart = (type: 'receipt' | 'evidence' | 'activity', idx: number) => {
    setDraggedIdx(idx)
    setDraggedType(type)
  }

  const handleDragOver = (e: React.DragEvent, type: 'receipt' | 'evidence' | 'activity') => {
    if (draggedType === type) {
      e.preventDefault()
    }
  }

  const handleDrop = (
    type: 'receipt' | 'evidence' | 'activity',
    targetIdx: number,
    urls: string[],
    setUrls: React.Dispatch<React.SetStateAction<string[]>>,
    setIdx: React.Dispatch<React.SetStateAction<number>>
  ) => {
    if (draggedIdx === null || draggedType !== type || draggedIdx === targetIdx) return

    const nextUrls = [...urls]
    const [draggedUrl] = nextUrls.splice(draggedIdx, 1)
    nextUrls.splice(targetIdx, 0, draggedUrl)
    setUrls(nextUrls)

    setIdx(targetIdx)
    setDraggedIdx(null)
    setDraggedType(null)
  }

  const [receiptIdx, setReceiptIdx] = useState(0)
  const [activityIdx, setActivityIdx] = useState(0)
  const [evidenceIdx, setEvidenceIdx] = useState(0)

  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [uploadingActivity, setUploadingActivity] = useState(false)
  const [uploadingEvidence, setUploadingEvidence] = useState(false)

  const [deletingReceiptUrl, setDeletingReceiptUrl] = useState<string | null>(null)
  const [deletingActivityUrl, setDeletingActivityUrl] = useState<string | null>(null)
  const [deletingEvidenceUrl, setDeletingEvidenceUrl] = useState<string | null>(null)

  const [uploadError, setUploadError] = useState('')
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const activityInputRef = useRef<HTMLInputElement>(null)
  const evidenceInputRef = useRef<HTMLInputElement>(null)

  const [viewTab, setViewTab] = useState<'receipt' | 'activity' | 'evidence'>(() =>
    receiptUrls.length === 0 && activityUrls.length > 0 ? 'activity' : 'receipt'
  )

  async function handleReceiptUpload(files: FileList) {
    const fileList = Array.from(files)
    if (fileList.length === 0) return

    if (receiptUrls.length + fileList.length > 20) {
      setUploadError('영수증 사진은 최대 20장까지 첨부할 수 있습니다.')
      return
    }
    setUploadingReceipt(true)
    setUploadError('')
    try {
      const nextUrls = [...receiptUrls]
      // Compress files asynchronously
      const compressedFiles = await Promise.all(fileList.map(f => compressImage(f)))
      for (const file of compressedFiles) {
        const result = await addReceiptImage(tx.id, file)
        if (result.error) {
          setUploadError(result.error)
          break
        } else if (result.url) {
          nextUrls.push(result.url)
        }
      }
      setReceiptUrls(nextUrls)
      setReceiptIdx(nextUrls.length - 1)
      setViewTab('receipt')
    } catch {
      setUploadError('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingReceipt(false)
    }
  }

  async function handleReceiptDelete(url: string) {
    setDeletingReceiptUrl(url)
    setUploadError('')
    try {
      const result = await removeReceiptImage(tx.id, url)
      if (result.error) {
        setUploadError(result.error)
      } else {
        const next = receiptUrls.filter(u => u !== url)
        setReceiptUrls(next)
        setReceiptIdx(i => Math.max(0, i - 1))
      }
    } catch {
      setUploadError('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingReceiptUrl(null)
    }
  }

  async function handleActivityUpload(file: File) {
    if (activityUrls.length >= 5) {
      setUploadError('활동 사진은 최대 5장까지 첨부할 수 있습니다.')
      return
    }
    setUploadingActivity(true)
    setUploadError('')
    try {
      const compressed = await compressImage(file)
      const result = await addActivityImage(tx.id, tx.participant_id ?? '', compressed)
      if (result.error) {
        setUploadError(result.error)
      } else if (result.url) {
        const next = [...activityUrls, result.url]
        setActivityUrls(next)
        setActivityIdx(next.length - 1)
        setViewTab('activity')
      }
    } catch {
      setUploadError('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingActivity(false)
    }
  }

  async function handleActivityDelete(url: string) {
    setDeletingActivityUrl(url)
    setUploadError('')
    try {
      const result = await removeActivityImage(tx.id, url)
      if (result.error) {
        setUploadError(result.error)
      } else {
        const next = activityUrls.filter(u => u !== url)
        setActivityUrls(next)
        setActivityIdx(i => Math.max(0, i - 1))
      }
    } catch {
      setUploadError('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingActivityUrl(null)
    }
  }

  async function handleEvidenceUpload(file: File) {
    if (evidenceUrls.length >= 5) {
      setUploadError('증빙서류는 최대 5장까지 첨부할 수 있습니다.')
      return
    }
    setUploadingEvidence(true)
    setUploadError('')
    try {
      const compressed = await compressImage(file)
      const result = await addEvidenceImage(tx.id, tx.participant_id ?? '', compressed)
      if (result.error) {
        setUploadError(result.error)
      } else if (result.url) {
        const next = [...evidenceUrls, result.url]
        setEvidenceUrls(next)
        setEvidenceIdx(next.length - 1)
        setViewTab('evidence')
      }
    } catch {
      setUploadError('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingEvidence(false)
    }
  }

  async function handleEvidenceDelete(url: string) {
    setDeletingEvidenceUrl(url)
    setUploadError('')
    try {
      const result = await removeEvidenceImage(tx.id, url)
      if (result.error) {
        setUploadError(result.error)
      } else {
        const next = evidenceUrls.filter(u => u !== url)
        setEvidenceUrls(next)
        setEvidenceIdx(i => Math.max(0, i - 1))
      }
    } catch {
      setUploadError('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingEvidenceUrl(null)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()

    // 카테고리 유효성 검사 (대분류와 중분류 모두 선택 여부)
    const parts = (category || '').split(" - ");
    if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
      setError("대분류와 중분류를 모두 선택하거나 직접 입력해 주세요.");
      return;
    }

    // 거절 사유(메모) 입력 확인
    if (status === 'rejected' && !memo.trim()) {
      setError("승인 거절 시에는 메모란에 거절 사유를 반드시 입력해 주세요.");
      return;
    }

    setSaving(true)
    setError('')
    try {
      await updateTransactionDetail(
        tx.id,
        {
          activity_name: activityName,
          amount: Number(amount),
          date,
          category: category || null,
          memo: memo || null,
          payment_method: paymentMethod,
          status,
          receipt_reviewed: status === 'pending' ? receiptReviewed : false,
          show_memo_to_participant: showMemoToParticipant,
          receipt_image_urls: receiptUrls,
          activity_image_urls: activityUrls,
          evidence_image_urls: evidenceUrls,
        }
      )
      router.push('/supporter/review')
      router.refresh()
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteTransactionWithBalance(tx.id)
      router.push('/supporter/transactions')
      router.refresh()
    } catch (e: any) {
      setError(e.message || '삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  const hasReceipt = receiptUrls.length > 0
  const hasActivity = activityUrls.length > 0
  const hasEvidence = evidenceUrls.length > 0

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 text-2xl font-bold transition-colors">←</Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">거래 내역 수정 및 승인</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <span>🖨️</span> 인쇄
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >내역 삭제</button>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-start">
        {/* 좌측: 증빙 뷰어 + 업로드 */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          {/* 탭 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
              <button
                onClick={() => setViewTab('receipt')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  viewTab === 'receipt' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                🧾 영수증{hasReceipt ? ` (${receiptUrls.length}/20)` : ''}
              </button>
              <button
                onClick={() => setViewTab('activity')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  viewTab === 'activity' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                📷 활동사진{hasActivity ? ` (${activityUrls.length}/5)` : ''}
              </button>
              <button
                onClick={() => setViewTab('evidence')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  viewTab === 'evidence' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                📋 증빙서류{hasEvidence ? ` (${evidenceUrls.length}/5)` : ''}
              </button>
            </div>
            {/* 업로드 버튼 */}
            <div className="flex gap-2">
              <input ref={receiptInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { const files = e.target.files; if (files) handleReceiptUpload(files); e.target.value = '' }} />
              <input ref={activityInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleActivityUpload(f); e.target.value = '' }} />
              <input ref={evidenceInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleEvidenceUpload(f); e.target.value = '' }} />

              {viewTab === 'receipt' && receiptUrls.length < 20 && (
                <button type="button" onClick={() => receiptInputRef.current?.click()} disabled={uploadingReceipt}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                  {uploadingReceipt
                    ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> 업로드 중...</>
                    : <>📎 추가 ({receiptUrls.length}/20)</>}
                </button>
              )}
              {viewTab === 'activity' && activityUrls.length < 5 && (
                <button type="button" onClick={() => activityInputRef.current?.click()} disabled={uploadingActivity}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                  {uploadingActivity
                    ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> 업로드 중...</>
                    : <>📎 추가 ({activityUrls.length}/5)</>}
                </button>
              )}
              {viewTab === 'evidence' && evidenceUrls.length < 5 && (
                <button type="button" onClick={() => evidenceInputRef.current?.click()} disabled={uploadingEvidence}
                  className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                  {uploadingEvidence
                    ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> 업로드 중...</>
                    : <>📎 추가 ({evidenceUrls.length}/5)</>}
                </button>
              )}
            </div>
          </div>

          {uploadError && (
            <p className="text-xs text-red-600 font-medium bg-red-50 px-3 py-2 rounded-lg">{uploadError}</p>
          )}

          {/* 이미지 뷰어 */}
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-4 flex flex-col items-center justify-center min-h-[400px]">
            {viewTab === 'receipt' ? (
              receiptUrls.length > 0 ? (
                <div className="w-full flex flex-col gap-4">
                  <div className="relative">
                    <img
                      src={receiptUrls[receiptIdx]}
                      alt={`영수증 ${receiptIdx + 1}`}
                      className="max-w-full max-h-[500px] object-contain rounded-lg mx-auto block cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setZoomImageUrl(receiptUrls[receiptIdx])}
                    />
                    <button
                      type="button"
                      disabled={!!deletingReceiptUrl}
                      onClick={() => handleReceiptDelete(receiptUrls[receiptIdx])}
                      className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deletingReceiptUrl === receiptUrls[receiptIdx] ? '삭제 중...' : '🗑️ 삭제'}
                    </button>
                  </div>
                  {receiptUrls.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {receiptUrls.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          draggable
                          onDragStart={() => handleDragStart('receipt', i)}
                          onDragOver={(e) => handleDragOver(e, 'receipt')}
                          onDrop={() => handleDrop('receipt', i, receiptUrls, setReceiptUrls, setReceiptIdx)}
                          onClick={() => setReceiptIdx(i)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all cursor-move hover:ring-2 hover:ring-zinc-400 active:opacity-50 ${
                            i === receiptIdx ? 'ring-blue-500' : 'ring-zinc-200'
                          }`}
                        >
                          <img src={url} alt={`썸네일 ${i + 1}`} className="w-full h-full object-contain bg-zinc-50" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-center text-xs text-zinc-400">{receiptIdx + 1} / {receiptUrls.length}장</p>
                </div>
              ) : (
                <div className="text-zinc-400 flex flex-col items-center gap-3">
                  <span className="text-5xl">🧾</span>
                  <p className="font-medium text-sm">첨부된 영수증이 없습니다.</p>
                  <button type="button" onClick={() => receiptInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-bold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors">
                    📎 영수증 첨부 (최대 20장)
                  </button>
                </div>
              )
            ) : viewTab === 'activity' ? (
              activityUrls.length > 0 ? (
                <div className="w-full flex flex-col gap-4">
                  <div className="relative">
                    <img
                      src={activityUrls[activityIdx]}
                      alt={`활동사진 ${activityIdx + 1}`}
                      className="max-w-full max-h-[500px] object-contain rounded-lg mx-auto block cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setZoomImageUrl(activityUrls[activityIdx])}
                    />
                    <button
                      type="button"
                      disabled={!!deletingActivityUrl}
                      onClick={() => handleActivityDelete(activityUrls[activityIdx])}
                      className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deletingActivityUrl === activityUrls[activityIdx] ? '삭제 중...' : '🗑️ 삭제'}
                    </button>
                  </div>
                  {activityUrls.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {activityUrls.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          draggable
                          onDragStart={() => handleDragStart('activity', i)}
                          onDragOver={(e) => handleDragOver(e, 'activity')}
                          onDrop={() => handleDrop('activity', i, activityUrls, setActivityUrls, setActivityIdx)}
                          onClick={() => setActivityIdx(i)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all cursor-move hover:ring-2 hover:ring-zinc-400 active:opacity-50 ${
                            i === activityIdx ? 'ring-blue-500' : 'ring-zinc-200'
                          }`}
                        >
                          <img src={url} alt={`썸네일 ${i + 1}`} className="w-full h-full object-contain bg-zinc-50" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-center text-xs text-zinc-400">{activityIdx + 1} / {activityUrls.length}장</p>
                </div>
              ) : (
                <div className="text-zinc-400 flex flex-col items-center gap-3">
                  <span className="text-5xl">📷</span>
                  <p className="font-medium text-sm">첨부된 활동사진이 없습니다.</p>
                  <button type="button" onClick={() => activityInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-bold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors">
                    📎 활동사진 첨부 (최대 5장)
                  </button>
                </div>
              )
            ) : (
              /* 증빙서류 탭 */
              evidenceUrls.length > 0 ? (
                <div className="w-full flex flex-col gap-4">
                  <div className="relative">
                    <img
                      src={evidenceUrls[evidenceIdx]}
                      alt={`증빙서류 ${evidenceIdx + 1}`}
                      className="max-w-full max-h-[500px] object-contain rounded-lg mx-auto block cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setZoomImageUrl(evidenceUrls[evidenceIdx])}
                    />
                    <button
                      type="button"
                      disabled={!!deletingEvidenceUrl}
                      onClick={() => handleEvidenceDelete(evidenceUrls[evidenceIdx])}
                      className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deletingEvidenceUrl === evidenceUrls[evidenceIdx] ? '삭제 중...' : '🗑️ 삭제'}
                    </button>
                  </div>
                  {evidenceUrls.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {evidenceUrls.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          draggable
                          onDragStart={() => handleDragStart('evidence', i)}
                          onDragOver={(e) => handleDragOver(e, 'evidence')}
                          onDrop={() => handleDrop('evidence', i, evidenceUrls, setEvidenceUrls, setEvidenceIdx)}
                          onClick={() => setEvidenceIdx(i)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all cursor-move hover:ring-2 hover:ring-zinc-400 active:opacity-50 ${
                            i === evidenceIdx ? 'ring-blue-500' : 'ring-zinc-200'
                          }`}
                        >
                          <img src={url} alt={`썸네일 ${i + 1}`} className="w-full h-full object-contain bg-zinc-50" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-center text-xs text-zinc-400">{evidenceIdx + 1} / {evidenceUrls.length}장</p>
                </div>
              ) : (
                <div className="text-zinc-400 flex flex-col items-center gap-3">
                  <span className="text-5xl">📋</span>
                  <p className="font-medium text-sm">첨부된 증빙서류가 없습니다.</p>
                  <button type="button" onClick={() => evidenceInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    📎 증빙서류 첨부 (최대 5장)
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* 우측: 폼 및 승인 */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-zinc-800">거래 상세 정보 입력</h2>
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6">
            <div className="mb-6 flex justify-between items-center bg-zinc-50 p-4 rounded-lg">
              <div>
                <p className="text-xs text-zinc-500 font-bold mb-1">당사자</p>
                <p className="font-black text-zinc-900 text-lg">{tx.participant?.name || '알 수 없음'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500 font-bold mb-1">재원</p>
                <p className="font-black text-zinc-900 text-lg">{tx.funding_source?.name || '미지정'}</p>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="flex flex-col gap-5">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <fieldset className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-500">날짜</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full min-w-0 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-medium focus:ring-zinc-400 focus:outline-none" required />
                </fieldset>
                <fieldset className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-500">금액 (원)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    className="w-full min-w-0 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-bold focus:ring-zinc-400 focus:outline-none" required min="0" />
                </fieldset>
              </div>

              <fieldset className="min-w-0 flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">활동 내용 (분류 선택 시 자동 입력)</label>
                <input type="text" value={activityName} readOnly disabled
                  className="w-full min-w-0 p-3 rounded-lg bg-zinc-100 ring-1 ring-zinc-200 text-zinc-400 font-medium cursor-not-allowed focus:outline-none" required />
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">분류</label>
                <ActivityCategoryPicker value={category} onChange={setCategory} />
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">결제 수단</label>
                <div className="flex gap-2">
                  {PAYMENT_METHODS.map(method => (
                    <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors flex-1 ${
                        paymentMethod === method ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}>{method}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">메모</label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2}
                  className="w-full min-w-0 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-medium focus:ring-zinc-400 focus:outline-none resize-none" />
                <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showMemoToParticipant}
                    onChange={e => setShowMemoToParticipant(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-900"
                  />
                  <span className="text-xs font-bold text-zinc-600">당사자에게 메모 보이게 하기</span>
                </label>
              </fieldset>

              <div className="h-px bg-zinc-200 my-2" />

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">반영 상태 (승인)</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStatus('confirmed')}
                    className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                      status === 'confirmed' ? 'bg-green-50 ring-green-300 text-green-700' : 'bg-zinc-50 ring-zinc-200 text-zinc-500 hover:bg-zinc-100'
                    }`}>
                    <span className="text-lg block mb-1">✅</span>확정 처리
                  </button>
                  <button type="button" onClick={() => setStatus('pending')}
                    className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                      status === 'pending' ? 'bg-orange-50 ring-orange-300 text-orange-700' : 'bg-zinc-50 ring-zinc-200 text-zinc-500 hover:bg-zinc-100'
                    }`}>
                    <span className="text-lg block mb-1">⏳</span>임시 대기
                  </button>
                  <button type="button" onClick={() => setStatus('rejected')}
                    className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                      status === 'rejected' ? 'bg-red-50 ring-red-300 text-red-700' : 'bg-zinc-50 ring-zinc-200 text-zinc-500 hover:bg-zinc-100'
                    }`}>
                    <span className="text-lg block mb-1">❌</span>거절 처리
                  </button>
                </div>
              </fieldset>

              {status === 'pending' && (
                <fieldset className="flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-500">검토 상태</label>
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 cursor-pointer hover:bg-zinc-100 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={receiptReviewed}
                      onChange={e => setReceiptReviewed(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-700">1차 검토 완료 처리</span>
                      <span className="text-xs text-zinc-400">대기열 우측에 ✔️ 검토완료 표시가 나타납니다.</span>
                    </div>
                  </label>
                </fieldset>
              )}

              <button type="submit" disabled={saving}
                className="mt-4 p-4 rounded-xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-md flex items-center justify-center gap-2">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />저장하고 있습니다...</>
                  : '수정 사항 저장하기'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-900 mb-2">정말 삭제하시겠습니까?</h3>
            <p className="text-sm text-zinc-500 mb-1">
              <strong>{activityName}</strong> — {formatCurrency(Number(amount))}원
            </p>
            {status === 'confirmed' && (
              <p className="text-sm text-orange-600 font-medium mb-4">
                ⚠️ 확정된 내역입니다. 삭제 시 잔액이 복원됩니다.
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 p-3 rounded-xl bg-zinc-100 text-zinc-600 font-bold hover:bg-zinc-200 transition-colors">
                취소
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 p-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />삭제 중...</>
                  : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center">
            <img
              src={zoomImageUrl}
              alt="확대된 이미지"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-default animate-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setZoomImageUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-zinc-300 text-3xl font-light transition-colors"
              title="닫기"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
