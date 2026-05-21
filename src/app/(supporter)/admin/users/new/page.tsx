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
      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-zinc-200 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <Link href="/admin/settings" className="text-zinc-400 transition-colors hover:text-zinc-600">
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">관리자 등록</h1>
          <p className="text-xs font-medium text-zinc-500">
            로그인할 이메일을 미리 등록합니다.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:p-6">
        <div className="rounded-2xl bg-blue-50 p-4 text-sm leading-relaxed text-blue-700 ring-1 ring-blue-100">
          등록된 이메일로 Google 로그인하면 관리자 권한이 적용됩니다.
        </div>

        <StaffRegistrationClient />
      </main>
    </div>
  )
}
