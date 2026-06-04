'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCardRegistration, createCardRegistration } from '@/app/actions/cardRegistration'
import { deleteFamilyRegistration, saveFamilyRegistration } from '@/app/actions/familyRegistration'
import { compressImage } from '@/utils/image-compression'

interface CardRegistration {
  id: string
  imageUrls: string[]
  createdAt: string | null
}

interface ParticipantDoc {
  id: string
  name: string
  familyRelation: {
    registered: boolean
    imageUrl: string | null
    createdAt: string | null
  }
  cardRegistrations: CardRegistration[]
}

interface SubmittedDocumentsClientProps {
  initialData: ParticipantDoc[]
}

export default function SubmittedDocumentsClient({ initialData }: SubmittedDocumentsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [selectedCardFiles, setSelectedCardFiles] = useState<{
    [participantId: string]: {
      front: File | null;
      frontPreview: string | null;
      back: File | null;
      backPreview: string | null;
    }
  }>({})

  const handleCardFileChange = (participantId: string, side: 'front' | 'back', file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setSelectedCardFiles(prev => {
        const current = prev[participantId] || { front: null, frontPreview: null, back: null, backPreview: null }
        return {
          ...prev,
          [participantId]: {
            ...current,
            [side]: file,
            [`${side}Preview`]: reader.result as string
          }
        }
      })
    }
    reader.readAsDataURL(file)
  }

  const handleUploadCard = async (participantId: string) => {
    const data = selectedCardFiles[participantId]
    if (!data || !data.front || !data.back) {
      alert('카드 앞면과 뒷면 사진을 모두 등록해주세요.')
      return
    }

    setUploadingId(participantId + '_card')
    try {
      const [compressedFront, compressedBack] = await Promise.all([
        compressImage(data.front),
        compressImage(data.back)
      ])

      const formData = new FormData()
      formData.append('participant_id', participantId)
      formData.append('card_images', compressedFront)
      formData.append('card_images', compressedBack)

      const res = await createCardRegistration(formData)
      if (res.success) {
        alert('카드가 성공적으로 등록되었습니다.')
        setSelectedCardFiles(prev => {
          const next = { ...prev }
          delete next[participantId]
          return next
        })
        router.refresh()
      } else {
        alert(res.error || '등록 중 오류가 발생했습니다.')
      }
    } catch (err: any) {
      console.error(err)
      alert(err?.message || '등록 중 오류가 발생했습니다.')
    } finally {
      setUploadingId(null)
    }
  }

  const handleCancelCardUpload = (participantId: string) => {
    setSelectedCardFiles(prev => {
      const next = { ...prev }
      delete next[participantId]
      return next
    })
  }

  const handleUploadFamily = async (participantId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingId(participantId + '_family')
    try {
      const compressedFile = await compressImage(file)

      const formData = new FormData()
      formData.append('participant_id', participantId)
      formData.append('family_relation_photo', compressedFile)

      const res = await saveFamilyRegistration(formData)
      if (res.success) {
        alert('가족관계증명서가 성공적으로 등록되었습니다.')
        router.refresh()
      } else {
        alert(res.error || '등록 중 오류가 발생했습니다.')
      }
    } catch (err: any) {
      console.error(err)
      alert(err?.message || '등록 중 오류가 발생했습니다.')
    } finally {
      setUploadingId(null)
      e.target.value = ''
    }
  }

  const handleDeleteCard = async (cardId: string) => {
    if (!window.confirm('이 카드 정보를 완전히 삭제하시겠습니까? 등록된 카드 사진 파일도 함께 삭제됩니다.')) {
      return
    }
    setDeletingId(cardId)
    try {
      const res = await deleteCardRegistration(cardId)
      if (res.success) {
        alert('카드 정보가 성공적으로 삭제되었습니다.')
        router.refresh()
      } else {
        alert(res.error || '삭제 중 오류가 발생했습니다.')
      }
    } catch (err: any) {
      console.error(err)
      alert(err?.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteFamily = async (participantId: string) => {
    if (!window.confirm('이 가족관계증명서 정보를 완전히 삭제하시겠습니까? 등록된 증명서 사진 파일도 함께 삭제됩니다.')) {
      return
    }
    setDeletingId(participantId)
    try {
      const res = await deleteFamilyRegistration(participantId)
      if (res.success) {
        alert('가족관계증명서가 성공적으로 삭제되었습니다.')
        router.refresh()
      } else {
        alert(res.error || '삭제 중 오류가 발생했습니다.')
      }
    } catch (err: any) {
      console.error(err)
      alert(err?.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = initialData.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="space-y-6">
      {/* 검색 바 */}
      <div className="flex items-center gap-2 max-w-md bg-white rounded-3xl border border-zinc-200/80 px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.015)] transition-all focus-within:border-zinc-300">
        <span className="text-zinc-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="당사자 이름으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm font-semibold outline-none bg-transparent placeholder-zinc-400 text-zinc-800"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors px-1"
          >
            초기화
          </button>
        )}
      </div>

      {/* 당사자 목록 */}
      <div className="flex flex-col gap-4">
        {filtered.map(p => {
          const hasFamily = p.familyRelation.registered && p.familyRelation.imageUrl
          const totalCards = p.cardRegistrations.length
          const isExpanded = expandedId === p.id

          return (
            <div key={p.id} className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)] hover:border-zinc-300 hover:shadow-[0_6px_24px_rgba(0,0,0,0.025)] transition-all duration-300 overflow-hidden">
              {/* 당사자 헤더 - 클릭하면 펼침/접힘 */}
              <button
                onClick={() => toggleExpand(p.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50/60 transition-colors sm:px-6"
              >
                <div className={`h-12 w-1.5 shrink-0 rounded-full ${hasFamily || totalCards > 0 ? 'bg-emerald-400' : 'bg-zinc-200'}`} />
                <div className="flex-1 min-w-0">
                  <h3 className="truncate font-black text-zinc-850 text-base">{p.name}</h3>
                  <div className="flex flex-wrap items-center gap-2.5 mt-2">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      hasFamily ? 'bg-green-50 text-green-700 border-green-100/80' : 'bg-zinc-50 text-zinc-500 border-zinc-200/70'
                    }`}>
                      증명서 {hasFamily ? '✓' : '✕'}
                    </span>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      totalCards > 0 ? 'bg-green-50 text-green-700 border-green-100/80' : 'bg-zinc-50 text-zinc-500 border-zinc-200/70'
                    }`}>
                      카드 {totalCards > 0 ? `${totalCards}건` : '✕'}
                    </span>
                  </div>
                </div>
                <span className={`text-zinc-400 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* 펼쳐진 상세 영역 */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-zinc-100/80 space-y-5 animate-in slide-in-from-top-2 duration-200">

                  {/* 가족관계증명서 */}
                  <div className="p-5 rounded-2xl bg-zinc-50/40 border border-zinc-200/50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black text-zinc-700">📄 가족관계증명서</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          hasFamily ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-650 border-red-100'
                        }`}>
                          {hasFamily ? '제출 완료' : '미등록'}
                        </span>
                        {hasFamily && (
                          <button
                            onClick={() => handleDeleteFamily(p.id)}
                            disabled={deletingId !== null}
                            className="text-[9px] text-red-500 hover:text-red-700 disabled:text-zinc-300 font-bold border border-red-100 disabled:border-zinc-100 hover:bg-red-50/60 disabled:bg-transparent rounded px-1.5 py-0.5 transition-colors"
                          >
                            {deletingId === p.id ? '삭제 중...' : '삭제'}
                          </button>
                        )}
                      </div>
                    </div>

                    {hasFamily ? (
                      <div className="space-y-3">
                        <div
                          className="group relative w-full max-w-xs h-40 rounded-2xl overflow-hidden border border-zinc-200/80 bg-white cursor-zoom-in shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                          onClick={() => setActiveImage(p.familyRelation.imageUrl)}
                        >
                          <img
                            src={p.familyRelation.imageUrl!}
                            alt={`${p.name} 가족관계증명서`}
                            className="w-full h-full object-contain bg-zinc-50 group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-black gap-1">
                            <span>🔍</span> 크게 보기
                          </div>
                        </div>
                        <p className="text-[9px] text-zinc-400 font-medium">제출일: {formatDate(p.familyRelation.createdAt)}</p>
                      </div>
                    ) : (
                      <div className="w-full max-w-xs h-28 rounded-2xl border border-dashed border-zinc-200 flex flex-col items-center justify-center text-[10px] text-zinc-400 bg-white gap-1">
                        <span className="text-lg">📄</span>
                        <span className="font-semibold text-zinc-400">제출된 증명서가 없습니다.</span>
                      </div>
                    )}

                    <div className="mt-3.5">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-[11px] font-bold rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer shadow-sm">
                        <span>📤</span>
                        <span>{uploadingId === p.id + '_family' ? '등록 중...' : hasFamily ? '증명서 교체' : '직접 등록'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleUploadFamily(p.id, e)}
                          disabled={uploadingId !== null}
                        />
                      </label>
                    </div>
                  </div>

                  {/* 등록 카드 목록 */}
                  <div className="p-5 rounded-2xl bg-zinc-50/40 border border-zinc-200/50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black text-zinc-700">💳 등록 카드 정보</span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        totalCards > 0 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-650 border-red-100'
                      }`}>
                        {totalCards > 0 ? `${totalCards}건 등록` : '미등록'}
                      </span>
                    </div>

                    {totalCards > 0 ? (
                      <div className="space-y-4">
                        {p.cardRegistrations.map((card, cardIdx) => (
                          <div key={card.id || cardIdx} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-zinc-500">카드 #{cardIdx + 1}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-zinc-400 font-medium">등록일: {formatDate(card.createdAt)}</span>
                                <button
                                  onClick={() => handleDeleteCard(card.id)}
                                  disabled={deletingId !== null}
                                  className="text-[9px] text-red-500 hover:text-red-700 disabled:text-zinc-300 font-bold border border-red-100 disabled:border-zinc-100 hover:bg-red-50/60 disabled:bg-transparent rounded px-1.5 py-0.5 transition-colors"
                                >
                                  {deletingId === card.id ? '삭제 중...' : '삭제'}
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5 max-w-sm">
                              {card.imageUrls.map((url, imgIdx) => (
                                <div
                                  key={imgIdx}
                                  className="group relative h-32 rounded-2xl overflow-hidden border border-zinc-200/80 bg-white cursor-zoom-in shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                                  onClick={() => setActiveImage(url)}
                                >
                                  <img
                                    src={url}
                                    alt={`${p.name} 카드 #${cardIdx + 1} ${imgIdx === 0 ? '앞면' : '뒷면'}`}
                                    className="w-full h-full object-contain bg-zinc-50 group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black gap-0.5">
                                    <span>🔍</span> {imgIdx === 0 ? '앞면' : '뒷면'}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {cardIdx < totalCards - 1 && <div className="border-b border-zinc-200/60 mt-3" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-full max-w-xs h-28 rounded-2xl border border-dashed border-zinc-200 flex flex-col items-center justify-center text-[10px] text-zinc-400 bg-white gap-1">
                        <span className="text-lg">💳</span>
                        <span className="font-semibold text-zinc-400">등록된 카드가 없습니다.</span>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-zinc-200/60">
                      <h4 className="text-[11px] font-black text-zinc-700 mb-3">💳 카드 직접 등록</h4>
                      
                      <div className="grid grid-cols-2 gap-3 max-w-sm">
                        {/* 앞면 선택 */}
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleCardFileChange(p.id, 'front', e.target.files?.[0] ?? null)}
                            disabled={uploadingId !== null}
                          />
                          <div className="aspect-[4/3] rounded-xl border border-dashed border-zinc-205 bg-white flex flex-col items-center justify-center text-[10px] text-zinc-450 gap-1 hover:bg-zinc-50 transition-colors overflow-hidden relative">
                            {selectedCardFiles[p.id]?.frontPreview ? (
                              <img
                                src={selectedCardFiles[p.id].frontPreview!}
                                alt="앞면 미리보기"
                                className="w-full h-full object-contain bg-zinc-50"
                              />
                            ) : (
                              <>
                                <span className="text-sm">📸</span>
                                <span className="font-bold">카드 앞면 등록</span>
                              </>
                            )}
                          </div>
                        </label>

                        {/* 뒷면 선택 */}
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleCardFileChange(p.id, 'back', e.target.files?.[0] ?? null)}
                            disabled={uploadingId !== null}
                          />
                          <div className="aspect-[4/3] rounded-xl border border-dashed border-zinc-205 bg-white flex flex-col items-center justify-center text-[10px] text-zinc-450 gap-1 hover:bg-zinc-50 transition-colors overflow-hidden relative">
                            {selectedCardFiles[p.id]?.backPreview ? (
                              <img
                                src={selectedCardFiles[p.id].backPreview!}
                                alt="뒷면 미리보기"
                                className="w-full h-full object-contain bg-zinc-50"
                              />
                            ) : (
                              <>
                                <span className="text-sm">📸</span>
                                <span className="font-bold">카드 뒷면 등록</span>
                              </>
                            )}
                          </div>
                        </label>
                      </div>

                      {/* 등록 및 취소 버튼 */}
                      {(selectedCardFiles[p.id]?.front || selectedCardFiles[p.id]?.back) && (
                        <div className="flex items-center gap-2 mt-3.5 max-w-sm">
                          <button
                            onClick={() => handleUploadCard(p.id)}
                            disabled={uploadingId !== null || !selectedCardFiles[p.id]?.front || !selectedCardFiles[p.id]?.back}
                            className="flex-1 py-2 bg-zinc-900 text-white text-[11px] font-bold rounded-xl hover:bg-zinc-800 transition-colors disabled:bg-zinc-200 disabled:text-zinc-400 shadow-sm"
                          >
                            {uploadingId === p.id + '_card' ? '등록 중...' : '카드 등록 완료'}
                          </button>
                          <button
                            onClick={() => handleCancelCardUpload(p.id)}
                            className="px-3 py-2 bg-zinc-100 text-zinc-500 text-[11px] font-bold rounded-xl hover:bg-zinc-200 transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      )}
                      
                      {/* 등록을 시작하지 않았을 때 안내 */}
                      {!(selectedCardFiles[p.id]?.front || selectedCardFiles[p.id]?.back) && (
                        <div className="mt-3">
                          <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                            * 위의 빈 카드 상자(앞면/뒷면)를 각각 클릭하여 실물 카드의 양면 사진을 선택한 후 등록할 수 있습니다.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-zinc-450 font-bold bg-white rounded-3xl border border-dashed border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
            검색 결과와 일치하는 당사자가 없습니다.
          </div>
        )}
      </div>

      {/* 라이트박스 이미지 확대 모달 */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out transition-opacity duration-300"
          onClick={() => setActiveImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={activeImage}
              alt="제출 문서 원본 확대"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
            />
            <button
              onClick={() => setActiveImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-lg font-bold border border-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
