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
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <fieldset className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
        <legend className="px-1 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
          계정 정보
        </legend>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500">이름 *</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="홍길동"
            required
            className="rounded-xl bg-zinc-50 p-3 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500">이메일 *</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@gmail.com"
            required
            className="rounded-xl bg-zinc-50 p-3 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
          메모
        </label>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="소속, 참고사항 등"
          className="rounded-xl bg-white p-3 text-sm text-zinc-800 ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/admin/settings"
          className="rounded-2xl bg-zinc-100 p-4 text-center text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-200"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={isPending || !name.trim() || !email.trim()}
          className="rounded-2xl bg-zinc-900 p-4 text-sm font-bold text-white shadow-lg transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? '등록 중...' : '관리자 등록'}
        </button>
      </div>
    </form>
  )
}
