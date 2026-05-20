"use client"

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createTransaction } from '@/app/actions/transaction'
import { EasyTerm } from '@/components/ui/EasyTerm'
import SelfCheckFeedback from '@/components/ui/SelfCheckFeedback'

interface FundingSource {
  id: string
  name: string
}

export default function ReceiptUploadForm({
  participantId,
  fundingSources
}: {
  participantId: string
  fundingSources: FundingSource[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)

  // 영수증 사진 상태
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  // 활동 사진 상태 (최대 1장)
  const [activityPreview, setActivityPreview] = useState<string | null>(null)
  const [activityFile, setActivityFile] = useState<File | null>(null)

  // 폼 필드 상태
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // 증빙서류 상태 (최대 5장)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([])

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    if (!newFiles.length) return
    const remaining = 5 - evidenceFiles.length
    const toAdd = newFiles.slice(0, remaining)
    setEvidenceFiles(prev => [...prev, ...toAdd])
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setEvidencePreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleRemoveEvidence = (idx: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== idx))
    setEvidencePreviews(prev => prev.filter((_, i) => i !== idx))
  }


  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setReceiptPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleActivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActivityFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setActivityPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveActivityPhoto = () => {
    setActivityPreview(null)
    setActivityFile(null)
    const input = document.getElementById('activity-input') as HTMLInputElement
    if (input) input.value = ''
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('participant_id', participantId)
      formData.set('date', date)
      formData.set('description', description)
      formData.set('amount', amount)
      if (receiptFile) formData.set('receipt', receiptFile)
      if (activityFile) formData.set('activity_image', activityFile)
      // 증빙서류 (최대 5장)
      evidenceFiles.forEach((file, i) => formData.set(`evidence_${i}`, file))

      const result = await createTransaction(formData)
      if (result.success) {
        setShowFeedback(true)
      }
    } catch (error) {
      console.error(error)
      setToast({type: 'error', message: '저장이 안 됐어요. 다시 눌러주세요.'})
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {toast && toast.type === 'error' && (
        <div className="p-4 rounded-2xl text-sm font-bold animate-fade-in-up bg-red-50 text-red-700 ring-1 ring-red-200">
          <div className="flex justify-between items-center">
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="text-lg ml-2" aria-label="알림 닫기">✕</button>
          </div>
        </div>
      )}

      {/* 영수증 사진 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-500 ml-1">🧾 <EasyTerm formal="영수증 사진" easy="물건 산 종이 사진" /> <span className="text-zinc-300 font-medium">(선택)</span></label>
          {receiptPreview && (
            <button type="button" onClick={() => { setReceiptPreview(null); setReceiptFile(null) }}
              className="text-xs text-red-400 font-bold">삭제</button>
          )}
        </div>
        <div
          className="relative aspect-square w-full rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
          onClick={() => document.getElementById('receipt-input')?.click()}
        >
          {receiptPreview ? (
            <img src={receiptPreview} alt="영수증 미리보기" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <span className="text-5xl">🧾</span>
              <p className="font-bold"><EasyTerm formal="영수증 사진 선택" easy="물건 산 종이 사진 찍기" /> (선택)</p>
              <p className="text-xs">사진은 지원자 선생님이 확인할 때 참고해요</p>
            </div>
          )}
        </div>
        <input id="receipt-input" type="file" accept="image/*" capture="environment"
          className="hidden" onChange={handleReceiptChange} />
      </div>

      {/* 활동 사진 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-500 ml-1">📸 <EasyTerm formal="활동 사진" easy="오늘 한 일 사진" /> <span className="text-zinc-300 font-medium">(선택, 1장)</span></label>
          {activityPreview && (
            <button type="button" onClick={handleRemoveActivityPhoto}
              className="text-xs text-red-400 font-bold">삭제</button>
          )}
        </div>
        <div
          className="relative aspect-square w-full rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
          onClick={() => !activityPreview && document.getElementById('activity-input')?.click()}
        >
          {activityPreview ? (
            <img src={activityPreview} alt="활동 사진 미리보기" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <span className="text-5xl">📷</span>
              <p className="font-bold">활동 사진 선택 (1장)</p>
              <p className="text-xs">오늘 활동한 사진을 올려요</p>
            </div>
          )}
        </div>
        <input id="activity-input" type="file" accept="image/*" capture="environment"
          className="hidden" onChange={handleActivityChange} />
      </div>

      {/* 활동 내용 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">📝 무엇을 했나요?</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 편의점 간식, 영화 티켓"
          className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
          required
        />
      </div>

      {/* 금액 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">💰 얼마인가요?</label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full p-4 pr-12 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-2xl font-black text-right transition-all"
            required
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">원</span>
        </div>
      </div>

      {/* 재원 선택 (1개이면 자동선택 숨김) */}
      {fundingSources.length <= 1 ? (
        <input type="hidden" name="funding_source_id" value={fundingSources[0]?.id ?? ''} />
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-zinc-500 ml-1">💳 <EasyTerm formal="결제 수단" easy="어떤 돈을 썼나요" />?</label>
          <select
            name="funding_source_id"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold appearance-none"
            required
          >
            {fundingSources.map(fs => (
              <option key={fs.id} value={fs.id}>{fs.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 날짜 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">📅 언제인가요?</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
        />
      </div>

      {/* 증빙서류 (최대 5장) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-500 ml-1">📋 증빙서류 <span className="text-zinc-300 font-medium">(선택, 최대 5장)</span></label>
          {evidenceFiles.length < 5 && (
            <label className="text-xs font-bold text-blue-600 cursor-pointer">
              + 추가
              <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleEvidenceChange} />
            </label>
          )}
        </div>
        {evidencePreviews.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {evidencePreviews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-100">
                <img src={src} alt={`증빙 ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveEvidence(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center hover:bg-red-600 transition-colors"
                >✕</button>
              </div>
            ))}
            {evidenceFiles.length < 5 && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-zinc-400 transition-colors">
                <span className="text-2xl">📎</span>
                <span className="text-xs text-zinc-400 font-bold">추가</span>
                <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleEvidenceChange} />
              </label>
            )}
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 cursor-pointer hover:border-zinc-300 transition-colors active:scale-[0.98]">
            <span className="text-2xl">📋</span>
            <span className="text-sm font-bold text-zinc-500">증빙서류 선택 (최대 5장)</span>
            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleEvidenceChange} />
          </label>
        )}
      </div>

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-5 rounded-3xl bg-green-600 text-white text-xl font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all mt-4"
      >
        {loading ? '등록 중...' : '활동 기록하기'}
      </button>

      <p className="text-center text-zinc-400 text-sm font-medium">
        사진은 선택사항이에요.<br/>지원자 선생님이 확인하면 예산에 반영해요.
      </p>

      {/* 성공 알림 + 자기결정 피드백 — Portal로 화면 중앙 오버레이 */}
      {showFeedback && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center gap-2 animate-fade-in-up">
            <span className="text-5xl">✅</span>
            <p className="text-xl font-black text-zinc-900">활동을 기록했어요!</p>
            <p className="text-sm text-zinc-500 font-medium text-center">지원자 선생님이 확인하면 예산에 반영해요.</p>
            <div className="w-full h-px bg-zinc-100 my-2" />
            <SelfCheckFeedback
              question="활동을 기록하기 쉬웠나요?"
              context="receipt_upload"
              onComplete={() => {
                setTimeout(() => {
                  router.push('/')
                  router.refresh()
                }, 1200)
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </form>
  )
}
