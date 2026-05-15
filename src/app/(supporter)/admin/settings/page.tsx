import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getEvalTemplateSetting } from '@/app/actions/evalTemplates'
import AdminSettingsClient from './AdminSettingsClient'
import { isAdminRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const authProfile = await getAuthenticatedUserProfileRole()

  if (!authProfile || !isAdminRole(authProfile.role)) {
    redirect('/')
  }

  const admin = createAdminClient()
  // 전체 사용자 목록 조회 (관리자 전용 — RLS 회피)
  const { data: allProfiles } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // 현재 평가 양식 설정
  const evalSetting = await getEvalTemplateSetting()

  return (
    <AdminSettingsClient
      currentUserId={user.id}
      currentUserEmail={user.email || ''}
      profiles={allProfiles || []}
      evalSetting={evalSetting}
    />
  )
}
