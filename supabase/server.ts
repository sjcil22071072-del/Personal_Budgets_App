import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const DEMO_ADMIN_ID = '5ebc14ce-2910-420d-9d15-cca025ec0e8c'
const DEMO_PARTICIPANT_ID = '11e95b8b-6806-496d-9f36-88bd04e814b3'

export async function createClient() {
  const cookieStore = await cookies()

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoRole = cookieStore.get('demo_role')?.value || 'admin'
    const demoUserId =
      demoRole === 'participant' ? DEMO_PARTICIPANT_ID : DEMO_ADMIN_ID

    const demoUser = {
      id: demoUserId,
      email: demoRole === 'admin' ? 'admin@demo.com' : 'participant@demo.com',
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
    }

    const adminClient = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminClient.auth.getUser = async () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { user: demoUser as any },
      error: null,
    })

    return adminClient
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}