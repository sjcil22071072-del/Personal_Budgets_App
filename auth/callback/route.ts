import { NextResponse } from 'next/server'
import { createClient } from '../../supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error.message)
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=AuthFailed`
      )
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/`)
}