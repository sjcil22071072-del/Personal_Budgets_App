import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { SupporterLayoutClient } from './SupporterLayoutClient'
import { normalizeRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'

export const dynamic = 'force-dynamic'

export default async function SupporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  if (!isDemoMode) {
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {}
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      redirect('/login')
    }

    const authProfile = await getAuthenticatedUserProfileRole()
    if (!authProfile) {
      redirect('/login')
    }
    if (normalizeRole(authProfile.role) === 'participant') {
      redirect('/')
    }
  }

  return <SupporterLayoutClient>{children}</SupporterLayoutClient>
}
