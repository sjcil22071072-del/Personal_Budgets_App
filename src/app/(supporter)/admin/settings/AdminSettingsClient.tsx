'use client'

import { useState, useTransition } from 'react'
import { updateUserRole } from '@/app/actions/admin'
import Link from 'next/link'
import AdminHelpButton from '@/components/help/AdminHelpButton'
import type { UserRole } from '@/types/database'
import type { OrgEvalSetting } from '@/types/eval-templates'
import EvalTemplateSettings from '@/components/admin/EvalTemplateSettings'

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
  evalSetting: OrgEvalSetting
}

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin', label: '관리자', desc: '전체 시스템 관리 권한' },
  { value: 'supporter', label: '지원자', desc: '당사자 지원 및 회계 관리' },
  { value: 'participant', label: '당사자', desc: '개인 예산 관리' },
]

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-50 text-red-600 ring-red-200',
  supporter: 'bg-blue-50 text-blue-600 ring-blue-200',
  participant: 'bg-green-50 text-green-600 ring-green-200',
}

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  supporter: '지원자',
  participant: '당사자',
}

export default function AdminSettingsClient({
  currentUserId,
  currentUserEmail,
  profiles,
  evalSetting,
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
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20 animate-fade-in-up">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/admin/participants" className="text-muted-foreground hover:text-foreground transition-colors">←</Link>
          <h1 className="text-xl font-bold tracking-tight">시스템 설정</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-red-50 rounded-full text-[10px] font-bold text-red-500 ring-1 ring-red-200">관리자</div>
          <AdminHelpButton pageKey="settings" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <section className="warm-banner">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-black">A</div>
            <div>
              <p className="text-sm font-bold text-foreground">현재 관리자</p>
              <p className="text-xs text-muted-foreground">{currentUserEmail}</p>
            </div>
          </div>
        </section>

        {message && (
          <div className={`p-4 rounded-2xl text-sm font-medium text-center animate-fade-in-up ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">역할 안내</h2>
          <div className="grid grid-cols-3 gap-3">
            {ROLE_OPTIONS.map((role) => (
              <div key={role.value} className="p-4 rounded-2xl bg-card ring-1 ring-border text-center">
                <p className="text-sm font-bold">{role.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{role.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">
              사용자 목록 ({profiles.length}명)
            </h2>
          </div>

          {profiles.length === 0 ? (
            <div className="p-8 rounded-2xl bg-muted text-center">
              <p className="text-muted-foreground font-medium">등록된 사용자가 없습니다.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black text-zinc-500 uppercase tracking-wider">사용자</th>
                    <th className="px-4 py-3 text-left text-xs font-black text-zinc-500 uppercase tracking-wider">등록일</th>
                    <th className="px-4 py-3 text-left text-xs font-black text-zinc-500 uppercase tracking-wider">역할</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {profiles.map((profile) => {
                    const isCurrentUser = profile.id === currentUserId
                    const isParticipantRecord = profile.source === 'participant'
                    const initial = (profile.name || profile.email || '?')[0]

                    return (
                      <tr
                        key={`${profile.source}-${profile.id}`}
                        className={`transition-colors hover:bg-zinc-50 ${isCurrentUser ? 'bg-blue-50/30' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-zinc-900 text-sm truncate">
                                  {profile.name || '이름 없음'}
                                </span>
                                {isCurrentUser && (
                                  <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold">나</span>
                                )}
                                {isParticipantRecord && (
                                  <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">등록 당사자</span>
                                )}
                              </div>
                              {profile.email && (
                                <p className="text-xs text-zinc-400 truncate">{profile.email}</p>
                              )}
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
                            <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold ring-1 ${ROLE_COLORS[profile.role]}`}>
                              {ROLE_LABELS[profile.role] || profile.role}
                            </span>
                          ) : (
                            <select
                              value={profile.role}
                              onChange={(e) => handleRoleChange(profile.id, e.target.value as UserRole)}
                              disabled={isPending}
                              className="px-3 py-1 rounded-lg text-xs font-bold ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:opacity-50 cursor-pointer hover:ring-zinc-300 bg-white"
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

        <div className="h-px bg-zinc-200" />

        <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
          <div>
            <p className="text-sm font-bold text-blue-800">평가 양식은 각 평가 작성 시에도 변경할 수 있습니다</p>
            <p className="text-xs text-blue-600 mt-1 leading-relaxed">
              아래에서 설정하는 양식은 새 평가 작성 화면의 기본값으로 적용됩니다.
            </p>
          </div>
        </div>

        <EvalTemplateSettings initialSetting={evalSetting} />
      </main>
    </div>
  )
}
