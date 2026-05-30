/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import Link from 'next/link'
import { createTransaction, getParticipantsWithFundingSources } from '@/app/actions/transaction'
import type { ParticipantWithFundingSources } from '@/app/actions/transaction'
import ActivityCategoryPicker from '@/components/transactions/ActivityCategoryPicker'
import { compressImage } from '@/utils/image-compression'

const PAYMENT_METHODS = ['카드', '계좌이체'] as const

function NewTransactionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [participants, setParticipants] = useState<ParticipantWithFundingSources[]>([])
  const [selectedParticipant, setSelectedParticipant] = useState('')
  const [selectedFundingSource, setSelectedFundingSource] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [activityName, setActivityName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [memo, setMemo] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>('카드')
  const [status, setStatus] = useState<'pending' | 'confirmed'>('confirmed')

  // Tab & Zoom views
  const [viewTab, setViewTab] = useState<'receipt' | 'activity' | 'evidence'>('receipt')
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)

  // Files & Previews (최대 5장씩)
  const [receiptFiles, setReceiptFiles] = useState<File[]>([])
  const [receiptPreviews, setReceiptPreviews] = useState<string[]>([])
  const [receiptIdx, setReceiptIdx] = useState(0)

  const [activityFiles, setActivityFiles] = useState<File[]>([])
  const [activityPreviews, setActivityPreviews] = useState<string[]>([])
  const [activityIdx, setActivityIdx] = useState(0)

  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([])
  const [evidenceIdx, setEvidenceIdx] = useState(0)

  const receiptInputRef = useRef<HTMLInputElement>(null)
  const activityInputRef = useRef<HTMLInputElement>(null)
  const evidenceInputRef = useRef<HTMLInputElement>(null)

  // 선택된 당사자의 재원 목록 유도
  const currentParticipant = participants.find(p => p.id === selectedParticipant)
  const fundingSources = currentParticipant?.funding_sources || []

  useEffect(() => {
    loadParticipants()
  }, [])

  useEffect(() => {
    if (fundingSources.length > 0) {
      setSelectedFundingSource(fundingSources[0].id)
    } else {
      setSelectedFundingSource('')
    }
  }, [selectedParticipant, fundingSources])

  async function loadParticipants() {
    setLoading(true)
    try {
      const data = await getParticipantsWithFundingSources()
      setParticipants(data)
      const queryId = searchParams.get('participantId') || searchParams.get('participant') || ''
      if (queryId && data.some(p => p.id === queryId)) {
        setSelectedParticipant(queryId)
      } else if (data.length === 1) {
        setSelectedParticipant(data[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleFilesAdd = (
    type: 'receipt' | 'activity' | 'evidence',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const currentLength = type === 'receipt' ? receiptFiles.length : type === 'activity' ? activityFiles.length : evidenceFiles.length
    if (currentLength + files.length > 5) {
      alert('최대 5장까지 첨부할 수 있습니다.')
      return
    }

    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const previewUrl = reader.result as string
        if (type === 'receipt') {
          setReceiptFiles(prev => [...prev, file])
          setReceiptPreviews(prev => {
            const next = [...prev, previewUrl]
            setReceiptIdx(next.length - 1)
            return next
          })
        } else if (type === 'activity') {
          setActivityFiles(prev => [...prev, file])
          setActivityPreviews(prev => {
            const next = [...prev, previewUrl]
            setActivityIdx(next.length - 1)
            return next
          })
        } else if (type === 'evidence') {
          setEvidenceFiles(prev => [...prev, file])
          setEvidencePreviews(prev => {
            const next = [...prev, previewUrl]
            setEvidenceIdx(next.length - 1)
            return next
          })
        }
      }
      reader.readAsDataURL(file)
    })
    setViewTab(type)
  }

  const handleFileRemove = (type: 'receipt' | 'activity' | 'evidence', idx: number) => {
    if (type === 'receipt') {
      setReceiptFiles(prev => prev.filter((_, i) => i !== idx))
      setReceiptPreviews(prev => prev.filter((_, i) => i !== idx))
      setReceiptIdx(i => Math.max(0, i - 1))
    } else if (type === 'activity') {
      setActivityFiles(prev => prev.filter((_, i) => i !== idx))
      setActivityPreviews(prev => prev.filter((_, i) => i !== idx))
      setActivityIdx(i => Math.max(0, i - 1))
    } else if (type === 'evidence') {
      setEvidenceFiles(prev => prev.filter((_, i) => i !== idx))
      setEvidencePreviews(prev => prev.filter((_, i) => i !== idx))
      setEvidenceIdx(i => Math.max(0, i - 1))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedParticipant || !activityName || !amount) {
      setError('필수 항목(당사자, 활동, 금액)을 모두 입력하세요.')
      return
    }

    // 카테고리 유효성 검사 (대분류와 중분류 모두 선택 여부)
    const parts = (category || '').split(" - ");
    if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
      setError("대분류와 중분류를 모두 선택하거나 직접 입력해 주세요.");
      return;
    }

    setSaving(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('participant_id', selectedParticipant)
      if (selectedFundingSource) {
        formData.append('funding_source_id', selectedFundingSource)
      }
      formData.append('amount', amount)
      formData.append('date', date)
      formData.append('description', activityName)
      formData.append('category', category)
      formData.append('memo', memo)
      formData.append('status', status)
      formData.append('is_expense', 'true') // 항상 지출
      formData.append('payment_method', paymentMethod)

      // 로컬 파일 압축 후 주입
      const [compressedReceipts, compressedActivities, compressedEvidences] = await Promise.all([
        Promise.all(receiptFiles.map(file => compressImage(file))),
        Promise.all(activityFiles.map(file => compressImage(file))),
        Promise.all(evidenceFiles.map(file => compressImage(file)))
      ])

      compressedReceipts.forEach((file, i) => formData.append(`receipt_${i}`, file))
      compressedActivities.forEach((file, i) => formData.append(`activity_${i}`, file))
      compressedEvidences.forEach((file, i) => formData.append(`evidence_${i}`, file))

      const result = await createTransaction(formData)
      if (result.success) {
        router.push('/supporter/transactions')
        router.refresh()
      } else {
        setError((result as any).error || '저장에 실패했습니다.')
        setSaving(false)
      }
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 mr-3">←</Link>
          <h1 className="text-xl font-bold tracking-tight">지출 내역 등록</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 font-medium">불러오는 중...</p>
        </main>
      </div>
    )
  }

  const hasReceipt = receiptFiles.length > 0
  const hasActivity = activityFiles.length > 0
  const hasEvidence = evidenceFiles.length > 0

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 text-2xl font-bold transition-colors">←</Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">지출 내역 수동 등록</h1>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-start mx-auto">
        {/* 좌측: 증빙 뷰어 + 업로드 */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          {/* 탭 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setViewTab('receipt')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  viewTab === 'receipt' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                🧾 영수증{hasReceipt ? ` (${receiptFiles.length}/5)` : ''}
              </button>
              <button
                type="button"
                onClick={() => setViewTab('activity')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  viewTab === 'activity' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                📷 활동사진{hasActivity ? ` (${activityFiles.length}/5)` : ''}
              </button>
              <button
                type="button"
                onClick={() => setViewTab('evidence')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  viewTab === 'evidence' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                📋 증빙서류{hasEvidence ? ` (${evidenceFiles.length}/5)` : ''}
              </button>
            </div>
            {/* 업로드 버튼 */}
            <div className="flex gap-2">
              <input ref={receiptInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { handleFilesAdd('receipt', e); e.target.value = '' }} />
              <input ref={activityInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { handleFilesAdd('activity', e); e.target.value = '' }} />
              <input ref={evidenceInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
                onChange={e => { handleFilesAdd('evidence', e); e.target.value = '' }} />

              {viewTab === 'receipt' && receiptFiles.length < 5 && (
                <button type="button" onClick={() => receiptInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors">
                  📎 추가 ({receiptFiles.length}/5)
                </button>
              )}
              {viewTab === 'activity' && activityFiles.length < 5 && (
                <button type="button" onClick={() => activityInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors">
                  📎 추가 ({activityFiles.length}/5)
                </button>
              )}
              {viewTab === 'evidence' && evidenceFiles.length < 5 && (
                <button type="button" onClick={() => evidenceInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  📎 추가 ({evidenceFiles.length}/5)
                </button>
              )}
            </div>
          </div>

          {/* 이미지 뷰어 */}
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-4 flex flex-col items-center justify-center min-h-[400px] w-full">
            {viewTab === 'receipt' ? (
              receiptFiles.length > 0 ? (
                <div className="w-full flex flex-col gap-4">
                  <div className="relative">
                    <img
                      src={receiptPreviews[receiptIdx]}
                      alt={`영수증 ${receiptIdx + 1}`}
                      className="max-w-full max-h-[500px] object-contain rounded-lg mx-auto block cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setZoomImageUrl(receiptPreviews[receiptIdx])}
                    />
                    <button
                      type="button"
                      onClick={() => handleFileRemove('receipt', receiptIdx)}
                      className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                  {receiptPreviews.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {receiptPreviews.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setReceiptIdx(i)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all ${
                            i === receiptIdx ? 'ring-blue-500' : 'ring-zinc-200 hover:ring-zinc-400'
                          }`}
                        >
                          <img src={url} alt={`썸네일 ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-center text-xs text-zinc-400">{receiptIdx + 1} / {receiptFiles.length}장</p>
                </div>
              ) : (
                <div className="text-zinc-400 flex flex-col items-center gap-3">
                  <span className="text-5xl">🧾</span>
                  <p className="font-medium text-sm">첨부된 영수증이 없습니다.</p>
                  <button type="button" onClick={() => receiptInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-bold bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors">
                    📎 영수증 첨부 (최대 5장)
                  </button>
                </div>
              )
            ) : viewTab === 'activity' ? (
              activityFiles.length > 0 ? (
                <div className="w-full flex flex-col gap-4">
                  <div className="relative">
                    <img
                      src={activityPreviews[activityIdx]}
                      alt={`활동사진 ${activityIdx + 1}`}
                      className="max-w-full max-h-[500px] object-contain rounded-lg mx-auto block cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setZoomImageUrl(activityPreviews[activityIdx])}
                    />
                    <button
                      type="button"
                      onClick={() => handleFileRemove('activity', activityIdx)}
                      className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                  {activityPreviews.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {activityPreviews.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setActivityIdx(i)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all ${
                            i === activityIdx ? 'ring-blue-500' : 'ring-zinc-200 hover:ring-zinc-400'
                          }`}
                        >
                          <img src={url} alt={`썸네일 ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-center text-xs text-zinc-400">{activityIdx + 1} / {activityFiles.length}장</p>
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
              evidenceFiles.length > 0 ? (
                <div className="w-full flex flex-col gap-4">
                  <div className="relative">
                    <img
                      src={evidencePreviews[evidenceIdx]}
                      alt={`증빙서류 ${evidenceIdx + 1}`}
                      className="max-w-full max-h-[500px] object-contain rounded-lg mx-auto block cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setZoomImageUrl(evidencePreviews[evidenceIdx])}
                    />
                    <button
                      type="button"
                      onClick={() => handleFileRemove('evidence', evidenceIdx)}
                      className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                  {evidencePreviews.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {evidencePreviews.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setEvidenceIdx(i)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all ${
                            i === evidenceIdx ? 'ring-blue-500' : 'ring-zinc-200 hover:ring-zinc-400'
                          }`}
                        >
                          <img src={url} alt={`썸네일 ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-center text-xs text-zinc-400">{evidenceIdx + 1} / {evidenceFiles.length}장</p>
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

        {/* 우측: 폼 및 등록 */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-zinc-800">지출 정보 입력</h2>
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <fieldset className="flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-500">당사자 선택</label>
                  <select
                    value={selectedParticipant}
                    onChange={(e) => setSelectedParticipant(e.target.value)}
                    className="w-full p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-950 font-bold focus:ring-zinc-400 focus:outline-none"
                    required
                  >
                    <option value="">대상자를 선택하세요</option>
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </fieldset>

                <fieldset className="flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-500">재원 선택</label>
                  <select
                    value={selectedFundingSource}
                    onChange={(e) => setSelectedFundingSource(e.target.value)}
                    className="w-full p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-950 font-bold focus:ring-zinc-400 focus:outline-none"
                    required
                  >
                    <option value="">재원을 선택하세요</option>
                    {fundingSources.map(fs => (
                      <option key={fs.id} value={fs.id}>{fs.name}</option>
                    ))}
                  </select>
                </fieldset>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <fieldset className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-500">거래 날짜</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full min-w-0 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-medium focus:ring-zinc-400 focus:outline-none" required />
                </fieldset>
                <fieldset className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-500">지출 금액 (원)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    className="w-full min-w-0 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-bold focus:ring-zinc-400 focus:outline-none" required min="0" />
                </fieldset>
              </div>

              <fieldset className="min-w-0 flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">활동 내용 (품명)</label>
                <input type="text" value={activityName} onChange={e => setActivityName(e.target.value)}
                  placeholder="어디에 사용했나요?"
                  className="w-full min-w-0 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-medium focus:ring-zinc-400 focus:outline-none" required />
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">분류</label>
                <ActivityCategoryPicker value={category} onChange={setCategory} />
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">결제 방법</label>
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
                  placeholder="기억해야 할 내용이 있다면 적어주세요"
                  className="w-full min-w-0 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-medium focus:ring-zinc-400 focus:outline-none resize-none" />
              </fieldset>

              <div className="h-px bg-zinc-200 my-2" />

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">장부 반영 상태</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStatus('confirmed')}
                    className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                      status === 'confirmed' ? 'bg-green-50 ring-green-300 text-green-700 shadow-sm' : 'bg-zinc-50 ring-zinc-200 text-zinc-400 hover:bg-zinc-100'
                    }`}>
                    <span className="text-lg block mb-1">✅</span>즉시 확정
                  </button>
                  <button type="button" onClick={() => setStatus('pending')}
                    className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                      status === 'pending' ? 'bg-orange-50 ring-orange-300 text-orange-700 shadow-sm' : 'bg-zinc-50 ring-zinc-200 text-zinc-400 hover:bg-zinc-100'
                    }`}>
                    <span className="text-lg block mb-1">⏳</span>임시 대기
                  </button>
                </div>
              </fieldset>

              <button type="submit" disabled={saving || !selectedParticipant || !activityName || !amount}
                className="mt-4 p-4 rounded-xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-md flex items-center justify-center gap-2">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />등록하고 있습니다...</>
                  : '지출 내역 등록하기'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* 이미지 확대 모달 */}
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

export default function NewTransactionPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 text-2xl font-bold transition-colors">←</Link>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">지출 내역 수동 등록</h1>
          </div>
        </header>
        <main className="w-full max-w-6xl flex items-center justify-center min-h-[400px]">
          <p className="text-zinc-400 font-medium">불러오는 중...</p>
        </main>
      </div>
    }>
      <NewTransactionForm />
    </Suspense>
  )
}
