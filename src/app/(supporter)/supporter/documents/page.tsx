/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DocumentManagerClient from '@/components/documents/DocumentManagerClient'
import { getAllSisAssessments } from '@/app/actions/sisAssessment'
import AdminHelpButton from '@/components/help/AdminHelpButton'
import { isStaffRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'

export default async function SupporterDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ participant_id?: string }>
}) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const authProfile = await getAuthenticatedUserProfileRole()
  if (!authProfile || !isStaffRole(authProfile.role)) {
    redirect('/')
  }

  // 담당 당사자 목록 조회
  const participantsQuery = adminClient
    .from('participants')
    .select('id, name')
    .eq('assigned_supporter_id', user.id)

  const { data: participants } = await participantsQuery.order('name', { ascending: true })
  const participantIds = (participants || []).map((participant) => participant.id)

  // 기존 등록된 모든 서류 조회
  let documents: any[] = []
  try {
    if (participantIds.length > 0) {
      const { data: docsData } = await adminClient
        .from('file_links')
        .select('*, participant:participants ( name )')
        .in('participant_id', participantIds)
        .order('created_at', { ascending: false })
      documents = docsData || []
    }
  } catch {
    // file_links 테이블이 없거나 쿼리 실패 시 빈 배열
    documents = []
  }

  // SIS-A 평가 목록 조회 (migration 실행 전이면 빈 배열)
  const allSisAssessments = await getAllSisAssessments().catch(() => [])
  const sisAssessments = participantIds.length > 0
    ? allSisAssessments.filter((assessment) => participantIds.includes(assessment.participant_id))
    : []
  const params = await searchParams

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">증빙 및 서류 관리</h1>
          <p className="text-zinc-500 mt-1">당사자별 계획서, 평가서, 참고자료를 업로드하거나 링크를 공유합니다.</p>
        </div>
        <AdminHelpButton pageKey="documents" />
      </header>

      <main className="max-w-6xl flex flex-col gap-8">
        <DocumentManagerClient
          participants={(participants || []) as any}
          initialDocuments={documents as any}
          sisAssessments={sisAssessments as any}
          initialParticipantId={params.participant_id}
        />
      </main>
    </div>
  )
}
