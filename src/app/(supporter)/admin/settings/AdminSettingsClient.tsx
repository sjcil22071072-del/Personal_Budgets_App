'use client'

import { useState, useTransition } from 'react'
import { updateUserRole } from '@/app/actions/admin'
import Link from 'next/link'
import type { UserRole } from '@/types/database'

interface Profile {
  id: string
  name: string | null
  email: string | null
  role: UserRole
  created_at: string
  source: 'profile' | 'participant'
}

interface AdminSettingsClientProps {
  currentUserId: string
  currentUserEmail: string
  profiles: Profile[]
}

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin', label: '관리자', desc: '전체 시스템 관리 권한' },
  { value: 'participant', label: '당사자', desc: '개인 예산 관리' },
]

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-50 text-red-600 ring-red-200',
  participant: 'bg-green-50 text-green-600 ring-green-200',
}

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  participant: '당사자',
}

export default function AdminSettingsClient({
  currentUserId,
  currentUserEmail,
  profiles,
}: AdminSettingsClientProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    setMessage(null)
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: '역할이 변경되었습니다.' })
      }
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/participants" className="text-muted-foreground transition-colors hover:text-foreground">←</Link>
          <h1 className="text-xl font-bold tracking-tight">시스템 설정</h1>
        </div>
        <div className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold text-red-500 ring-1 ring-red-200">관리자</div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
        <section className="warm-banner">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-black">A</div>
            <div>
              <p className="text-sm font-bold text-foreground">현재 관리자</p>
              <p className="text-xs text-muted-foreground">{currentUserEmail}</p>
            </div>
          </div>
        </section>

        {message && (
          <div className={`rounded-2xl p-4 text-center text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="ml-1 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">역할 안내</h2>
          <div className="grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((role) => (
              <div key={role.value} className="rounded-2xl bg-card p-4 text-center ring-1 ring-border">
                <p className="text-sm font-bold">{role.label}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{role.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="ml-1 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
              사용자 목록 ({profiles.length}명)
            </h2>
            <Link
              href="/admin/users/new"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-zinc-800"
            >
              관리자 등록
            </Link>
          </div>

          {profiles.length === 0 ? (
            <div className="rounded-2xl bg-muted p-8 text-center">
              <p className="font-medium text-muted-foreground">등록된 사용자가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
              <table className="w-full">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-zinc-500">사용자</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-zinc-500">등록일</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-zinc-500">역할</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {profiles.map((profile) => {
                    const isCurrentUser = profile.id === currentUserId
                    const isParticipantRecord = profile.source === 'participant'
                    const initial = (profile.name || profile.email || '?')[0]

                    return (
                      <tr key={`${profile.source}-${profile.id}`} className={`transition-colors hover:bg-zinc-50 ${isCurrentUser ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-zinc-600">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-bold text-zinc-900">
                                  {profile.name || '이름 없음'}
                                </span>
                                {isCurrentUser && (
                                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-600">나</span>
                                )}
                                {isParticipantRecord && (
                                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-700">등록 당사자</span>
                                )}
                              </div>
                              {profile.email && <p className="truncate text-xs text-zinc-400">{profile.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-zinc-600">
                            {new Date(profile.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isCurrentUser || isParticipantRecord ? (
                            <span className={`inline-flex rounded-lg px-3 py-1 text-xs font-bold ring-1 ${ROLE_COLORS[profile.role]}`}>
                              {ROLE_LABELS[profile.role] || profile.role}
                            </span>
                          ) : (
                            <select
                              value={profile.role}
                              onChange={(e) => handleRoleChange(profile.id, e.target.value as UserRole)}
                              disabled={isPending}
                              className="cursor-pointer rounded-lg bg-white px-3 py-1 text-xs font-bold ring-1 ring-zinc-200 transition-all hover:ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
