'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { saveAdminMemo } from '@/app/actions/admin-memo'

interface Props {
  initialMemo: string
}

export default function AdminMemoWidget({ initialMemo }: Props) {
  const [memo, setMemo] = useState(initialMemo)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialMemo)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.selectionStart = textareaRef.current.value.length
    }
  }, [editing])

  function handleEdit() {
    setDraft(memo)
    setEditing(true)
  }

  function handleCancel() {
    setEditing(false)
    setDraft(memo)
  }

  function handleSave() {
    startTransition(async () => {
      await saveAdminMemo(draft)
      setMemo(draft)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') handleCancel()
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave()
  }

  return (
    <section className="relative p-5 rounded-3xl bg-amber-50 border border-amber-200/80 shadow-[0_4px_20px_rgba(251,191,36,0.06)] transition-all">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📋</span>
        <h2 className="text-sm font-black text-amber-900 tracking-tight">관리자 공유 메모</h2>
        <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-200/70 text-amber-800">관리자 전용</span>
        {saved && (
          <span className="ml-auto text-[10px] font-black text-emerald-600 animate-pulse">✓ 저장됨</span>
        )}
        {!editing && !saved && (
          <button
            onClick={handleEdit}
            className="ml-auto text-[10px] font-black text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg hover:bg-amber-200/50 transition-all"
          >
            ✏️ 수정
          </button>
        )}
      </div>

      {/* 내용 */}
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={5}
            placeholder="관리자끼리 공유할 메모를 입력하세요..."
            className="w-full text-sm text-zinc-800 bg-white border border-amber-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-zinc-400 leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-700/60 font-medium">Ctrl+Enter로 저장, Esc로 취소</span>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={handleEdit}
          className="min-h-[60px] cursor-pointer group"
        >
          {memo ? (
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap group-hover:text-zinc-900 transition-colors">
              {memo}
            </p>
          ) : (
            <p className="text-sm text-amber-600/60 italic leading-relaxed group-hover:text-amber-600 transition-colors">
              클릭하여 관리자 공유 메모를 작성하세요...
            </p>
          )}
        </div>
      )}
    </section>
  )
}
