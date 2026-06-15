'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTransaction } from '@/app/actions/transaction'
import { compressImage } from '@/utils/image-compression'

export default function TransactionForm({
  participantId,
  fundingSources,
}: {
  participantId: string
  fundingSources: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 영수증 상태 (최대 5장)
  const [receiptFiles, setReceiptFiles] = useState<File[]>([])
  const [receiptPreviews, setReceiptPreviews] = useState<string[]>([])

  // 증빙서류 상태 (최대 5장)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([])

  // 활동사진 상태 (최대 5장)
  const [activityFiles, setActivityFiles] = useState<File[]>([])
  const [activityPreviews, setActivityPreviews] = useState<string[]>([])

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
    files: File[],
    setFiles: React.Dispatch<React.SetStateAction<File[]>>,
    previews: string[],
    setPreviews: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (draggedIdx === null || draggedType !== type || draggedIdx === targetIdx) return

    const nextFiles = [...files]
    const [draggedFile] = nextFiles.splice(draggedIdx, 1)
    nextFiles.splice(targetIdx, 0, draggedFile)
    setFiles(nextFiles)

    const nextPreviews = [...previews]
    const [draggedPreview] = nextPreviews.splice(draggedIdx, 1)
    nextPreviews.splice(targetIdx, 0, draggedPreview)
    setPreviews(nextPreviews)

    setDraggedIdx(null)
    setDraggedType(null)
  }

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    if (!newFiles.length) return
    const remaining = 5 - receiptFiles.length
    const toAdd = newFiles.slice(0, remaining)
    setReceiptFiles(prev => [...prev, ...toAdd])
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => setReceiptPreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleRemoveReceipt = (idx: number) => {
    setReceiptFiles(prev => prev.filter((_, i) => i !== idx))
    setReceiptPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    if (!newFiles.length) return
    const remaining = 5 - evidenceFiles.length
    const toAdd = newFiles.slice(0, remaining)
    setEvidenceFiles(prev => [...prev, ...toAdd])
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => setEvidencePreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleRemoveEvidence = (idx: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== idx))
    setEvidencePreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleActivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    if (!newFiles.length) return
    const remaining = 5 - activityFiles.length
    const toAdd = newFiles.slice(0, remaining)
    setActivityFiles(prev => [...prev, ...toAdd])
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => setActivityPreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleRemoveActivity = (idx: number) => {
    setActivityFiles(prev => prev.filter((_, i) => i !== idx))
    setActivityPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.append('participant_id', participantId)
    
    try {
      // 로컬 파일 압축 후 주입
      const [compressedReceipts, compressedEvidences, compressedActivities] = await Promise.all([
        Promise.all(receiptFiles.map(file => compressImage(file))),
        Promise.all(evidenceFiles.map(file => compressImage(file))),
        Promise.all(activityFiles.map(file => compressImage(file)))
      ])

      compressedReceipts.forEach((file, i) => formData.set(`receipt_${i}`, file))
      compressedEvidences.forEach((file, i) => formData.set(`evidence_${i}`, file))
      compressedActivities.forEach((file, i) => formData.set(`activity_${i}`, file))

      const result = await createTransaction(formData)
      if (result.success) {
        router.push(`/supporter/${participantId}/transactions`)
      } else {
        setError(result.error || '저장 중 오류가 발생했습니다.')
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  // 매핑용 카테고리 (관리자 실무 기준)
  const categories = [
    '식비', '간식/음료', '교통비', '여가활동', '물품구입', '의료/건강', '기타'
  ]

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm ring-1 ring-zinc-200 max-w-2xl mx-auto space-y-6">
      
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium ring-1 ring-red-100">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date */}
        <div className="space-y-2">
          <label htmlFor="date" className="text-sm font-bold text-zinc-500 ml-1">활동/결제 일자 *</label>
          <input 
            type="date" 
            id="date" 
            name="date" 
            required 
            defaultValue={new Date().toISOString().split('T')[0]}
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all" 
          />
        </div>

        {/* Funding Source */}
        <div className="space-y-2">
          <label htmlFor="funding_source_id" className="text-sm font-bold text-zinc-500 ml-1">결제 수단 (재원) *</label>
          <select 
            id="funding_source_id" 
            name="funding_source_id" 
            required
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
          >
            <option value="">선택해주세요</option>
            {fundingSources.map(fs => (
              <option key={fs.id} value={fs.id}>{fs.name}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <label htmlFor="amount" className="text-sm font-bold text-zinc-500 ml-1">결제 금액 *</label>
          <input 
            type="number" 
            id="amount" 
            name="amount" 
            min="0"
            required 
            placeholder="예: 15000"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all" 
          />
        </div>

        {/* Type (Expense/Income) */}
        <div className="space-y-2">
          <label htmlFor="is_expense" className="text-sm font-bold text-zinc-500 ml-1">구분 *</label>
          <select 
            id="is_expense" 
            name="is_expense" 
            required
            defaultValue="true"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
          >
            <option value="true">지출 (잔액 차감)</option>
            <option value="false">수입 (잔액 증가)</option>
          </select>
        </div>

        {/* Description */}
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="description" className="text-sm font-bold text-zinc-500 ml-1">활동명 (품목명) *</label>
          <input 
            type="text" 
            id="description" 
            name="description" 
            required 
            placeholder="예: 이마트 간식 구매"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all" 
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label htmlFor="category" className="text-sm font-bold text-zinc-500 ml-1">분류 (카테고리) *</label>
          <select 
            id="category" 
            name="category" 
            required
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
          >
            <option value="">선택해주세요</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-bold text-zinc-500 ml-1">등록 상태 *</label>
          <select 
            id="status" 
            name="status" 
            required
            defaultValue="pending"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
          >
            <option value="pending">임시저장 (잔액 미변경)</option>
            <option value="confirmed">최종 확정 (잔액 즉시 차감)</option>
          </select>
        </div>

        {/* Memo */}
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="memo" className="text-sm font-bold text-zinc-500 ml-1">추가 메모 (선택)</label>
          <textarea 
            id="memo" 
            name="memo" 
            rows={3}
            placeholder="영수증 번호나 특이사항을 적어주세요"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all" 
          />
        </div>

        {/* 1. 영수증 사진 (최대 20장) */}
        <div className="space-y-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-500 ml-1">🧾 영수증 사진 <span className="text-zinc-400 font-medium">(선택, 최대 20장)</span></label>
            {receiptFiles.length > 0 && receiptFiles.length < 20 && (
              <label className="text-xs font-bold text-blue-600 cursor-pointer">
                + 추가
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleReceiptChange} />
              </label>
            )}
          </div>
          {receiptPreviews.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {receiptPreviews.map((src, i) => (
                <div 
                  key={i} 
                  draggable 
                  onDragStart={() => handleDragStart('receipt', i)}
                  onDragOver={(e) => handleDragOver(e, 'receipt')}
                  onDrop={() => handleDrop('receipt', i, receiptFiles, setReceiptFiles, receiptPreviews, setReceiptPreviews)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 ring-1 ring-zinc-200 cursor-move hover:ring-2 hover:ring-zinc-400 active:opacity-50 transition-all"
                >
                  <img src={src} alt={`영수증 ${i + 1}`} className="w-full h-full object-contain bg-zinc-50" />
                  <button
                    type="button"
                    onClick={() => handleRemoveReceipt(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center hover:bg-red-600"
                  >✕</button>
                </div>
              ))}
              {receiptFiles.length < 20 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-zinc-400 transition-colors">
                  <span className="text-xl">📸</span>
                  <span className="text-xs text-zinc-400">추가</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleReceiptChange} />
                </label>
              )}
            </div>
          ) : (
            <label className="flex items-center justify-center gap-3 p-5 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 cursor-pointer hover:border-zinc-300 transition-colors">
              <span className="text-2xl">🧾</span>
              <span className="text-sm font-bold text-zinc-500">영수증 사진 첨부 (이미지, 최대 20장)</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleReceiptChange} />
            </label>
          )}
        </div>

        {/* 2. 증빙서류 (최대 5장) */}
        <div className="space-y-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-500 ml-1">📋 증빙서류 <span className="text-zinc-400 font-medium">(선택, 최대 5장)</span></label>
            {evidenceFiles.length > 0 && evidenceFiles.length < 5 && (
              <label className="text-xs font-bold text-blue-600 cursor-pointer">
                + 추가
                <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleEvidenceChange} />
              </label>
            )}
          </div>
          {evidencePreviews.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {evidencePreviews.map((src, i) => (
                <div 
                  key={i} 
                  draggable 
                  onDragStart={() => handleDragStart('evidence', i)}
                  onDragOver={(e) => handleDragOver(e, 'evidence')}
                  onDrop={() => handleDrop('evidence', i, evidenceFiles, setEvidenceFiles, evidencePreviews, setEvidencePreviews)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 ring-1 ring-zinc-200 cursor-move hover:ring-2 hover:ring-zinc-400 active:opacity-50 transition-all"
                >
                  <img src={src} alt={`증빙 ${i + 1}`} className="w-full h-full object-contain bg-zinc-50" />
                  <button
                    type="button"
                    onClick={() => handleRemoveEvidence(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center hover:bg-red-600"
                  >✕</button>
                </div>
              ))}
              {evidenceFiles.length < 5 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-zinc-400 transition-colors">
                  <span className="text-xl">📎</span>
                  <span className="text-xs text-zinc-400">추가</span>
                  <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleEvidenceChange} />
                </label>
              )}
            </div>
          ) : (
            <label className="flex items-center justify-center gap-3 p-5 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 cursor-pointer hover:border-zinc-300 transition-colors">
              <span className="text-2xl">📋</span>
              <span className="text-sm font-bold text-zinc-500">증빙서류 첨부 (이미지/PDF, 최대 5장)</span>
              <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleEvidenceChange} />
            </label>
          )}
        </div>

        {/* 3. 활동사진 (최대 5장) */}
        <div className="space-y-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-500 ml-1">📸 활동 사진 <span className="text-zinc-400 font-medium">(선택, 최대 5장)</span></label>
            {activityFiles.length > 0 && activityFiles.length < 5 && (
              <label className="text-xs font-bold text-blue-600 cursor-pointer">
                + 추가
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleActivityChange} />
              </label>
            )}
          </div>
          {activityPreviews.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {activityPreviews.map((src, i) => (
                <div 
                  key={i} 
                  draggable 
                  onDragStart={() => handleDragStart('activity', i)}
                  onDragOver={(e) => handleDragOver(e, 'activity')}
                  onDrop={() => handleDrop('activity', i, activityFiles, setActivityFiles, activityPreviews, setActivityPreviews)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 ring-1 ring-zinc-200 cursor-move hover:ring-2 hover:ring-zinc-400 active:opacity-50 transition-all"
                >
                  <img src={src} alt={`활동 ${i + 1}`} className="w-full h-full object-contain bg-zinc-50" />
                  <button
                    type="button"
                    onClick={() => handleRemoveActivity(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center hover:bg-red-600"
                  >✕</button>
                </div>
              ))}
              {activityFiles.length < 5 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-zinc-400 transition-colors">
                  <span className="text-xl">📸</span>
                  <span className="text-xs text-zinc-400">추가</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleActivityChange} />
                </label>
              )}
            </div>
          ) : (
            <label className="flex items-center justify-center gap-3 p-5 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 cursor-pointer hover:border-zinc-300 transition-colors">
              <span className="text-2xl">📸</span>
              <span className="text-sm font-bold text-zinc-500">활동 사진 첨부 (이미지, 최대 5장)</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleActivityChange} />
            </label>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
        <button 
          type="button" 
          onClick={() => router.back()}
          className="px-6 py-3 border-2 border-zinc-200 text-zinc-600 rounded-xl font-bold hover:bg-zinc-50 transition-all"
          disabled={loading}
        >
          취소
        </button>
        <button 
          type="submit" 
          className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:bg-zinc-300"
          disabled={loading}
        >
          {loading ? '저장 중...' : '기록 저장'}
        </button>
      </div>

    </form>
  )
}
