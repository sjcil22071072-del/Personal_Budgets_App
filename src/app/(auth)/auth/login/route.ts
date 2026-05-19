import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXT_PUBLIC_SITE_URL ??
      new URL(request.url).origin

  const supabase = await createClient()

  // Starting a new login should not silently reuse the current app session.
  await supabase.auth.signOut()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (error || !data.url) {
    console.error('OAuth start error:', error)
    return NextResponse.redirect(`${baseUrl}/login?error=AuthStartFailed`)
  }

  return NextResponse.redirect(data.url)
}
