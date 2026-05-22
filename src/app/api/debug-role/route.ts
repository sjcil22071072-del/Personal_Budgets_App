import { createClient, createAdminClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { isStaffRole } from '@/utils/user-role'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인된 세션이 없습니다. (Not logged in)' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({
      authenticatedUser: {
        id: user.id,
        email: user.email,
      },
      profileInDb: profile,
      profileQueryError: profileError,
      isStaff: profile ? isStaffRole(profile.role) : false,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
