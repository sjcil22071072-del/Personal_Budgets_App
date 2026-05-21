'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerStaffUser } from '@/app/actions/admin'

export default function StaffRegistrationClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const result = await registerStaffUser({ name, email, role: 'admin', note })

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      setMessage({
        type: 'success',
        text: '관리자로 등록했습니다. 해당 이메일로 로그인하면 관리자 권한이 적용됩니다.',
      })
      setName('')
      setEmail('')
      setNote('')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-bold ${
            message.type === 'success'
              ? 'border-green-100 bg-green-50 text-green-650'
              : 'border-red-100 bg-red-50 text-red-650'
          }`}
        >
          {message.text}
        </div>
      )}

      <fieldset className="flex flex-col gap-4 rounded-3xl bg-white p-6 border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
        <legend className="px-1 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
          계정 정보
        </legend>

        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-xs font-bold text-zinc-450">이름 *</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="홍길동"
            required
            className="w-full px-3.5 py-3 border border-zinc-200 rounded-2xl bg-zinc-50/50 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:bg-white text-sm font-semibold transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-450">이메일 *</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@gmail.com"
            required
            className="w-full px-3.5 py-3 border border-zinc-200 rounded-2xl bg-zinc-50/50 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:bg-white text-sm font-semibold transition-all"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-3xl bg-white p-6 border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
        <legend className="px-1 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
          메모
        </legend>
        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-xs font-bold text-zinc-450">참고사항 (선택)</label>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="소속, 참고사항 등"
            className="w-full px-3.5 py-3 border border-zinc-200 rounded-2xl bg-zinc-50/50 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:bg-white text-sm font-semibold transition-all"
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/admin/settings"
          className="rounded-3xl bg-zinc-100 py-4 text-center text-xs font-bold text-zinc-650 transition-all hover:bg-zinc-200 active:scale-[0.99]"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={isPending || !name.trim() || !email.trim()}
          className="rounded-3xl bg-zinc-900 py-4 text-xs font-bold text-white shadow-md transition-all hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50"
        >
          {isPending ? '등록 중...' : '관리자 등록'}
        </button>
      </div>
    </form>
  )
}
