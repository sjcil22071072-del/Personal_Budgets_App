'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/profile'

interface Props {
  profile: {
    id: string
    name: string | null
    role: string
    bio: string | null
    avatar_url: string | null
  }
  userEmail: string
  isAdminEmail: boolean
}

export default function ProfileEditClient({ profile, userEmail, isAdminEmail }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setToast(null)

    try {
      const formData = new FormData(e.currentTarget)
      await updateProfile(formData)
      setToast({ type: 'success', message: '프로필이 저장되었습니다.' })
      router.refresh()
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || '저장에 실패했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  const roleLabel = isAdminEmail || profile.role === 'admin' ? '관리자' : '당사자'
  const roleValue = isAdminEmail ? 'admin' : profile.role === 'admin' ? 'admin' : 'participant'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {toast && (
        <div className={`rounded-2xl p-4 text-sm font-bold ${
          toast.type === 'success'
            ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
            : 'bg-red-50 text-red-700 ring-1 ring-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-4xl ring-4 ring-zinc-200">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="프로필" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-black text-zinc-400">{(profile.name || '?')[0]}</span>
          )}
        </div>
        <p className="text-xs font-bold text-zinc-400">{userEmail}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="ml-1 text-sm font-bold text-zinc-500">이름</label>
        <input
          name="name"
          type="text"
          defaultValue={profile.name || ''}
          className="w-full rounded-2xl bg-white p-4 text-lg font-bold outline-none ring-1 ring-zinc-200 transition-all focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="ml-1 text-sm font-bold text-zinc-500">역할</label>
        <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
          <input type="hidden" name="role" value={roleValue} />
          <span className="font-bold text-zinc-700">{roleLabel}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="ml-1 text-sm font-bold text-zinc-500">나를 표현하는 한 마디</label>
        <input
          name="bio"
          type="text"
          defaultValue={profile.bio || ''}
          placeholder="예: 여행을 좋아해요!"
          className="w-full rounded-2xl bg-white p-4 text-base font-medium outline-none ring-1 ring-zinc-200 transition-all focus:ring-2 focus:ring-primary"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-3xl bg-green-600 py-5 text-lg font-black text-white shadow-xl transition-all active:scale-95 disabled:bg-zinc-300"
      >
        {loading ? '저장 중...' : '프로필 저장'}
      </button>
    </form>
  )
}
