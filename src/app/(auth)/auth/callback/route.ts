import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

type AdminRegistration = {
  id: string
  role: 'admin' | 'participant'
  used_at: string | null
}

type ParticipantRegistration = {
  id: string
  name: string | null
}

type ExistingProfile = {
  id: string
  role: 'admin' | 'participant' | 'superadmin' | 'super_admin'
  name: string | null
  email: string | null
  created_at: string | null
}

function isLikelySeedAccount(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? ''

  return (
    normalized.includes('dummy') ||
    normalized.includes('demo') ||
    normalized.includes('test') ||
    normalized.includes('sample') ||
    normalized.includes('example') ||
    normalized.includes('더미') ||
    normalized.includes('테스트')
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin

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
  const isSuperAdmin = !!superAdminEmail && email === superAdminEmail

  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, role, name, email, created_at')
    .eq('id', user.id)
    .maybeSingle()

  const { data: adminRegistration } = await adminClient
    .from('user_invitations')
    .select('id, role, used_at')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: participantRegistration } = await adminClient
    .from('participants')
    .select('id, name')
    .ilike('email', email)
    .maybeSingle()

  const typedExistingProfile = existingProfile as ExistingProfile | null
  const typedAdminRegistration = adminRegistration as AdminRegistration | null
  const typedParticipantRegistration = participantRegistration as ParticipantRegistration | null
  const isRegisteredUser = !!typedAdminRegistration || !!typedParticipantRegistration
  const profileCreatedAt = typedExistingProfile?.created_at
    ? new Date(typedExistingProfile.created_at).getTime()
    : 0
  const isFreshAutoProfile =
    !!typedExistingProfile &&
    Date.now() - profileCreatedAt < 5 * 60 * 1000 &&
    !isRegisteredUser
  const isExistingAssignedUser = !!typedExistingProfile && !isFreshAutoProfile

  const shouldRecoverAdminFromAuthUser =
    !!typedExistingProfile &&
    !typedAdminRegistration &&
    !typedParticipantRegistration &&
    !!email &&
    !isLikelySeedAccount(email) &&
    !isLikelySeedAccount(typedExistingProfile.name) &&
    !isLikelySeedAccount(user.user_metadata?.full_name) &&
    !isLikelySeedAccount(user.user_metadata?.name)

  if (!isSuperAdmin && !isRegisteredUser && !isExistingAssignedUser && !shouldRecoverAdminFromAuthUser) {
    await adminClient.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    return NextResponse.redirect(`${baseUrl}/login?error=InvalidDomain`)
  }

  const resolvedRole =
    isSuperAdmin || shouldRecoverAdminFromAuthUser || typedAdminRegistration?.role === 'admin'
      ? 'admin'
      : typedExistingProfile?.role ?? 'participant'
  const displayName =
    typedParticipantRegistration?.name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    null

  const profilePayload = {
    id: user.id,
    email,
    name: displayName,
    full_name: displayName,
    role: resolvedRole,
  }

  const { error: profileError } = typedExistingProfile
    ? await adminClient
        .from('profiles')
        .update({
          email,
          name: displayName,
          full_name: displayName,
          role: resolvedRole,
        })
        .eq('id', user.id)
    : await adminClient.from('profiles').upsert(profilePayload, { onConflict: 'id' })

  if (profileError) {
    console.error('Profile upsert failed:', profileError)
    await supabase.auth.signOut()
    return NextResponse.redirect(`${baseUrl}/login?error=ProfileFailed`)
  }

  if (typedAdminRegistration && !typedAdminRegistration.used_at) {
    await adminClient
      .from('user_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('id', typedAdminRegistration.id)
  }

  const destination = next !== '/' ? next : resolvedRole === 'admin' ? '/admin' : '/'

  return NextResponse.redirect(`${baseUrl}${destination}`)
}
