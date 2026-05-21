import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

type Invitation = {
  id: string
  role: 'admin' | 'participant'
  used_at: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXT_PUBLIC_SITE_URL ??
      new URL(request.url).origin

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=AuthFailed`)
  }

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    console.error('OAuth Error:', error)
    return NextResponse.redirect(`${baseUrl}/login?error=AuthFailed`)
  }

  const email = user.email?.trim().toLowerCase() ?? ''
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase()
  const allowedDomains = (
    process.env.ALLOWED_EMAIL_DOMAINS ??
    process.env.ALLOWED_EMAIL_DOMAIN ??
    ''
  )
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)

  const isSuperAdmin = !!superAdminEmail && email === superAdminEmail
  const isAllowedDomain = allowedDomains.some((domain) => email.endsWith(`@${domain}`))

  const { data: invitation } = await adminClient
    .from('user_invitations')
    .select('id, role, used_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!isSuperAdmin && !isAllowedDomain && !invitation) {
    await adminClient.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    return NextResponse.redirect(`${baseUrl}/login?error=InvalidDomain`)
  }

  const typedInvitation = invitation as Invitation | null
  const resolvedRole =
    isSuperAdmin || typedInvitation?.role === 'admin'
      ? 'admin'
      : 'participant'
  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    null

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: user.id,
      email,
      name: displayName,
      full_name: displayName,
      role: resolvedRole,
    }, { onConflict: 'id' })

  if (profileError) {
    console.error('Profile upsert failed:', profileError)
    await supabase.auth.signOut()
    return NextResponse.redirect(`${baseUrl}/login?error=ProfileFailed`)
  }

  if (typedInvitation && !typedInvitation.used_at) {
    await adminClient
      .from('user_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('id', typedInvitation.id)
  }

  const destination =
    next !== '/'
      ? next
      : resolvedRole === 'admin'
        ? '/admin'
        : '/'

  return NextResponse.redirect(`${baseUrl}${destination}`)
}
