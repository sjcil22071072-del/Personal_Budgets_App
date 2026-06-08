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

  // 당사자(Participant) 이메일 변경으로 인한 Auth UUID 불일치 복구 로직 (데이터 이전 방식)
  if (email && !isSuperAdmin) {
    const { data: participantReg } = await adminClient
      .from('participants')
      .select('*')
      .ilike('email', email)
      .maybeSingle()

    if (participantReg && participantReg.id !== user.id) {
      console.log(`[AuthCallback] Email mismatch. Migrating data from ${participantReg.id} to ${user.id}`)
      try {
        const oldId = participantReg.id
        const newId = user.id

        // 1. 새 ID(newId)를 가진 participants 레코드 복사 생성
        const { error: insertErr } = await adminClient
          .from('participants')
          .insert({
            id: newId,
            name: participantReg.name,
            email: participantReg.email,
            monthly_budget_default: participantReg.monthly_budget_default,
            yearly_budget_default: participantReg.yearly_budget_default,
            budget_start_date: participantReg.budget_start_date,
            budget_end_date: participantReg.budget_end_date,
            funding_source_count: participantReg.funding_source_count,
            alert_threshold: participantReg.alert_threshold,
            assigned_supporter_id: participantReg.assigned_supporter_id,
            ui_preferences: participantReg.ui_preferences,
            created_at: participantReg.created_at
          })

        if (insertErr) {
          throw new Error(`Failed to insert new participant record: ${insertErr.message}`)
        }

        // 2. 자식 테이블들의 participant_id를 newId로 마이그레이션
        // a. funding_sources
        await adminClient.from('funding_sources').update({ participant_id: newId }).eq('participant_id', oldId)
        // b. transactions
        await adminClient.from('transactions').update({ participant_id: newId }).eq('participant_id', oldId)
        // c. card_registrations
        await adminClient.from('card_registrations').update({ participant_id: newId }).eq('participant_id', oldId)
        // d. family_registrations
        await adminClient.from('family_registrations').update({ participant_id: newId }).eq('participant_id', oldId)
        // e. file_links
        await adminClient.from('file_links').update({ participant_id: newId }).eq('participant_id', oldId)

        // 3. 기존 profiles의 oldId 레코드 삭제
        await adminClient.from('profiles').delete().eq('id', oldId)

        // 4. 기존 participants의 oldId 레코드 삭제 (자식 데이터는 이미 다 이전되었으므로 cascade 삭제가 발생해도 무방)
        await adminClient.from('participants').delete().eq('id', oldId)

        // 5. Supabase Auth의 이전 계정(oldId) 삭제
        try {
          await adminClient.auth.admin.deleteUser(oldId)
          console.log(`[AuthCallback] Deleted old auth user: ${oldId}`)
        } catch (authDelErr) {
          console.warn('[AuthCallback] Failed to delete old auth user:', authDelErr)
        }

        console.log(`[AuthCallback] Successfully migrated all data to new user ID: ${newId}`)
      } catch (migrationErr: any) {
        console.error('[AuthCallback] Critical: Data migration failed:', migrationErr)
        return NextResponse.redirect(`${baseUrl}/login?error=MigrationFailed`)
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
