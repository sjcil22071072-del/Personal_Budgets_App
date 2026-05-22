import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
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

  const { data: allProfiles } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: participants } = await admin
    .from('participants')
    .select('id, name, email, created_at')
    .order('created_at', { ascending: false })

  const normalizeEmail = (email: string | null | undefined) =>
    email?.trim().toLowerCase() ?? ''

  const profileIds = new Set((allProfiles || []).map((profile) => profile.id))
  const profileEmails = new Set(
    (allProfiles || [])
      .map((profile) => normalizeEmail(profile.email))
      .filter(Boolean),
  )
  const users = [
    ...((allProfiles || []).map((profile) => ({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      created_at: profile.created_at,
      source: 'profile' as const,
    }))),
    ...((participants || [])
      .filter((participant) => {
        const email = normalizeEmail(participant.email)
        return !profileIds.has(participant.id) && (!email || !profileEmails.has(email))
      })
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        email: participant.email,
        role: 'participant' as const,
        created_at: participant.created_at,
        source: 'participant' as const,
      }))),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <AdminSettingsClient
      currentUserId={user.id}
      currentUserEmail={user.email || ''}
      profiles={users}
    />
  )
}
