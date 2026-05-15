import { createClient, createAdminClient } from '@/utils/supabase/server'

/**
 * RLS 때문에 profiles 행이 비는 환경을 피하기 위해,
 * 세션의 user.id로 역할만 서비스 롤(admin) 클라이언트로 조회합니다.
 * (게이트 용도 — 본인 프로필의 role 필드만 필요할 때)
 */
export async function getAuthenticatedUserProfileRole(): Promise<{
  userId: string
  role: string
  name: string | null
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .maybeSingle()
  const role = typeof row?.role === 'string' ? row.role : ''
  const name = typeof row?.name === 'string' && row.name.trim() !== '' ? row.name : null
  return { userId: user.id, role, name }
}
