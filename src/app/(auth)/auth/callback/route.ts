import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { assignRoleForFirstUser } from '@/app/actions/admin'

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
    return NextResponse.redirect(
      `${baseUrl}/login?error=AuthFailed`
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    console.error('OAuth Error:', error)

    return NextResponse.redirect(
      `${baseUrl}/login?error=AuthFailed`
    )
  }

  const email = user.email ?? ''

  const superAdminEmail = (
    process.env.SUPER_ADMIN_EMAIL ?? ''
  ).trim()

  const allowedDomains = (
    process.env.ALLOWED_EMAIL_DOMAINS ??
    process.env.ALLOWED_EMAIL_DOMAIN ??
    'nowondaycare.org'
  )
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)

  // 1. 슈퍼 관리자 이메일
  const isSuperAdmin =
    !!superAdminEmail && email === superAdminEmail

  // 2. 허용 도메인
  const isAllowedDomain = allowedDomains.some((d) =>
    email.endsWith('@' + d)
  )

  // 3. 초대 여부 확인
  let isInvited = false

  if (!isSuperAdmin && !isAllowedDomain) {
    const adminClient = createAdminClient()

    const { data: invitation } = await adminClient
      .from('user_invitations')
      .select('id')
      .eq('email', email)
      .is('used_at', null)
      .maybeSingle()

    isInvited = !!invitation
  }

  // 접근 불가
  if (!isSuperAdmin && !isAllowedDomain && !isInvited) {
    await supabase.auth.signOut()

    return NextResponse.redirect(
      `${baseUrl}/login?error=InvalidDomain`
    )
  }

  // 최초 관리자 자동 할당
  try {
    await assignRoleForFirstUser()
  } catch (e) {
    console.error(
      'Failed to assign first admin role:',
      e
    )
  }

  // 프로필 role 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  console.log('PROFILE:', profile)

  // 관리자 여부
  const isAdmin =
    isSuperAdmin ||
    profile?.role === 'admin' ||
    profile?.role === 'superadmin' ||
    profile?.role === 'super_admin'

  // 이동 경로 결정
  const destination =
    next !== '/'
      ? next
      : isAdmin
        ? '/admin'
        : '/'

  return NextResponse.redirect(
    `${baseUrl}${destination}`
  )
}