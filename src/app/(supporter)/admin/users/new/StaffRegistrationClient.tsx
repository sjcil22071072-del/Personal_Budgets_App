'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerStaffUser, type StaffRole } from '@/app/actions/admin'

export default function StaffRegistrationClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('supporter')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const result = await registerStaffUser({ name, email, role, note })

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      setMessage({
        type: 'success',
        text:
          result.mode === 'updated'
            ? '이미 가입한 사용자의 역할을 변경했습니다.'
            : '등록했습니다. 해당 이메일로 로그인하면 선택한 역할이 적용됩니다.',
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

      <fieldset className="flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
        <legend className="px-1 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
          역할
        </legend>

        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'supporter' as const, label: '지원자', desc: '담당 당사자 관리와 평가 작성' },
            { value: 'admin' as const, label: '관리자', desc: '전체 설정과 사용자 관리' },
          ].map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                role === option.value
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="sr-only"
              />
              <span className="block text-sm font-black">{option.label}</span>
              <span className={`mt-1 block text-xs ${role === option.value ? 'text-zinc-200' : 'text-zinc-500'}`}>
                {option.desc}
              </span>
            </label>
          ))}
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
          placeholder="소속, 담당팀 등 선택 입력"
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
          {isPending ? '등록 중...' : '등록하기'}
        </button>
      </div>
    </form>
  )
}
