'use client'

import { useState } from 'react'

interface CardRegistration {
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
  const [search, setSearch] = useState('')
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
      <div className="flex items-center gap-2 max-w-md bg-white rounded-2xl ring-1 ring-zinc-200 px-4 py-3 shadow-sm">
        <span className="text-zinc-400">🔍</span>
        <input
          type="text"
          placeholder="당사자 이름으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm font-medium outline-none bg-transparent placeholder-zinc-400 text-zinc-800"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-xs font-black text-zinc-400 hover:text-zinc-600 transition-colors px-1"
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
            <div key={p.id} className="bg-white rounded-3xl border border-zinc-200/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              {/* 당사자 헤더 - 클릭하면 펼침/접힘 */}
              <button
                onClick={() => toggleExpand(p.id)}
                className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-zinc-50 transition-colors"
              >
                <div className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-600 text-base font-black shrink-0">
                  {p.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-zinc-800 text-base">{p.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      hasFamily ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-400'
                    }`}>
                      증명서 {hasFamily ? '✓' : '✕'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      totalCards > 0 ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-400'
                    }`}>
                      카드 {totalCards > 0 ? `${totalCards}건` : '✕'}
                    </span>
                  </div>
                </div>
                <span className={`text-zinc-400 text-sm transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* 펼쳐진 상세 영역 */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-zinc-100 space-y-5 animate-in slide-in-from-top-2 duration-200">

                  {/* 가족관계증명서 */}
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black text-zinc-700">📄 가족관계증명서</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        hasFamily ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {hasFamily ? '제출 완료' : '미등록'}
                      </span>
                    </div>

                    {hasFamily ? (
                      <div className="space-y-2">
                        <div
                          className="group relative w-full max-w-xs h-40 rounded-xl overflow-hidden border border-zinc-200 bg-white cursor-zoom-in"
                          onClick={() => setActiveImage(p.familyRelation.imageUrl)}
                        >
                          <img
                            src={p.familyRelation.imageUrl!}
                            alt={`${p.name} 가족관계증명서`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-black gap-1">
                            <span>🔍</span> 크게 보기
                          </div>
                        </div>
                        <p className="text-[9px] text-zinc-400">제출일: {formatDate(p.familyRelation.createdAt)}</p>
                      </div>
                    ) : (
                      <div className="w-full max-w-xs h-28 rounded-xl border border-dashed border-zinc-300 flex flex-col items-center justify-center text-[10px] text-zinc-400 bg-white gap-1">
                        <span className="text-lg">📄</span>
                        <span>제출된 증명서가 없습니다.</span>
                      </div>
                    )}
                  </div>

                  {/* 등록 카드 목록 */}
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black text-zinc-700">💳 등록 카드 정보</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        totalCards > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {totalCards > 0 ? `${totalCards}건 등록` : '미등록'}
                      </span>
                    </div>

                    {totalCards > 0 ? (
                      <div className="space-y-4">
                        {p.cardRegistrations.map((card, cardIdx) => (
                          <div key={cardIdx} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-zinc-500">카드 #{cardIdx + 1}</span>
                              <span className="text-[9px] text-zinc-400">등록일: {formatDate(card.createdAt)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-w-sm">
                              {card.imageUrls.map((url, imgIdx) => (
                                <div
                                  key={imgIdx}
                                  className="group relative h-32 rounded-xl overflow-hidden border border-zinc-200 bg-white cursor-zoom-in"
                                  onClick={() => setActiveImage(url)}
                                >
                                  <img
                                    src={url}
                                    alt={`${p.name} 카드 #${cardIdx + 1} ${imgIdx === 0 ? '앞면' : '뒷면'}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black gap-0.5">
                                    <span>🔍</span> {imgIdx === 0 ? '앞면' : '뒷면'}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {cardIdx < totalCards - 1 && <div className="border-b border-zinc-200 mt-2" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-full max-w-xs h-28 rounded-xl border border-dashed border-zinc-300 flex flex-col items-center justify-center text-[10px] text-zinc-400 bg-white gap-1">
                        <span className="text-lg">💳</span>
                        <span>등록된 카드가 없습니다.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-zinc-400 font-bold bg-white rounded-3xl border border-dashed border-zinc-300">
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
