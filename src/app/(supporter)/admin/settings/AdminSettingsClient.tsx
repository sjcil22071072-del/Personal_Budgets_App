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

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-50 text-red-500 border-red-100',
  participant: 'bg-green-50 text-green-600 border-green-100',
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
  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-zinc-400 hover:text-zinc-650 transition-colors font-bold">←</Link>
          <h1 className="text-xl font-black tracking-tight text-zinc-800">시스템 설정</h1>
        </div>
        <div className="rounded-full bg-zinc-900 border border-zinc-900 px-3 py-1 text-[10px] font-bold text-white shadow-sm">관리자 모드</div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
        <section className="p-5 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white text-base font-black">A</div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">현재 관리자</p>
              <p className="text-sm font-black text-zinc-800 mt-0.5">{currentUserEmail}</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between ml-1">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
              사용자 목록 ({profiles.length}명)
            </h2>
            <Link
              href="/admin/users/new"
              className="rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-zinc-800 active:scale-95 shadow-sm"
            >
              + 새 관리자 등록
            </Link>
          </div>

          {profiles.length === 0 ? (
            <div className="rounded-3xl bg-zinc-50 border border-zinc-200/80 p-8 text-center">
              <p className="font-bold text-zinc-400 text-xs">등록된 사용자가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl bg-white border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50/50">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-400">사용자</th>
                      <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-400">등록일</th>
                      <th className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-400">역할</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {profiles.map((profile) => {
                      const isCurrentUser = profile.id === currentUserId
                      const isParticipantRecord = profile.source === 'participant'
                      const initial = (profile.name || profile.email || '?')[0]

                      return (
                        <tr key={`${profile.source}-${profile.id}`} className={`transition-colors hover:bg-zinc-50/40 ${isCurrentUser ? 'bg-zinc-50/60' : ''}`}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-150 border border-zinc-200 text-xs font-black text-zinc-650">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="truncate text-sm font-bold text-zinc-800">
                                    {profile.name || '이름 없음'}
                                  </span>
                                  {isCurrentUser && (
                                    <span className="shrink-0 rounded-full bg-zinc-900 border border-zinc-900 px-2 py-0.5 text-[8px] font-bold text-white scale-90">나</span>
                                  )}
                                </div>
                                {profile.email && <p className="truncate text-xs text-zinc-400 font-medium mt-0.5">{profile.email}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-xs text-zinc-500 font-bold">
                              {new Date(profile.created_at).toLocaleDateString('ko-KR')}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${ROLE_COLORS[profile.role]}`}>
                              {ROLE_LABELS[profile.role] || profile.role}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
