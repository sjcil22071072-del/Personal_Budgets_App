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

  // 당사자(Participant) 이메일 변경으로 인한 Auth UUID 불일치 복구 로직
  if (email && !isSuperAdmin) {
    const { data: participantReg } = await adminClient
      .from('participants')
      .select('id, name')
      .ilike('email', email)
      .maybeSingle()

    if (participantReg && participantReg.id !== user.id) {
      console.log(`[AuthCallback] Email mismatch detected for ${email}. Participant ID: ${participantReg.id}, Auth ID: ${user.id}`)
      try {
        // 0. profiles 테이블에서 깡통 계정 프로필 먼저 삭제 (외래키 제약조건 우회)
        await adminClient.from('profiles').delete().eq('id', user.id)

        // 1. 현재 로그인 시도한 깡통 Auth 계정(uuid-user2) 삭제
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
        if (deleteError) {
          console.error('[AuthCallback] Failed to delete temporary duplicate user:', deleteError)
        }

        // 2. 기존 당사자 Auth 계정(uuid-user1)의 이메일을 새 이메일로 갱신
        const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
          participantReg.id,
          { email: email, email_confirm: true }
        )

        if (updateAuthError) {
          console.error('[AuthCallback] Failed to update original user email:', updateAuthError)
        } else {
          console.log(`[AuthCallback] Successfully updated original user email to ${email} for user ID: ${participantReg.id}`)
        }

        // 3. 로그아웃 세션 해제 및 로그인 화면으로 리다이렉트 (재시도 유도)
        await supabase.auth.signOut()
        return NextResponse.redirect(`${baseUrl}/login?error=EmailUpdatedRetry`)
      } catch (recoveryErr) {
        console.error('[AuthCallback] Recovery process exception:', recoveryErr)
      }
    }
  }

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
