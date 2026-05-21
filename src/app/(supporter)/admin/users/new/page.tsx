import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'
import { isAdminRole } from '@/utils/user-role'
import StaffRegistrationClient from './StaffRegistrationClient'

export const dynamic = 'force-dynamic'

export default async function NewStaffUserPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const authProfile = await getAuthenticatedUserProfileRole()
  if (!authProfile || !isAdminRole(authProfile.role)) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-zinc-200 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="text-zinc-400 hover:text-zinc-650 transition-colors font-bold">←</Link>
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-800">관리자 등록</h1>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">
              로그인할 이메일을 미리 등록합니다
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:p-6">
        <div className="rounded-3xl border border-zinc-200/80 p-5 bg-white text-xs font-semibold leading-relaxed text-zinc-500 shadow-[0_4px_20px_rgba(0,0,0,0.015)] flex items-start gap-2.5">
          <span className="text-base leading-none">💡</span>
          <span>등록된 이메일로 Google 로그인하면 관리자 권한이 적용됩니다.</span>
        </div>

        <StaffRegistrationClient />
      </main>
    </div>
  )
}
