/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 일회용 더미 데이터 정리 API
 * 사용 후 즉시 삭제할 것!
 * 
 * GET /api/cleanup-dummy?confirm=yes
 * 
 * 정소연(wildam3242@gmail.com)을 제외한 모든 당사자(participants)를 삭제합니다.
 * participants 테이블에 ON DELETE CASCADE가 설정되어 있으므로
 * funding_sources, transactions, card_registrations, family_registrations 등 연관 데이터도 함께 삭제됩니다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { isAdminRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'

export async function GET(request: NextRequest) {
  const confirm = request.nextUrl.searchParams.get('confirm')
  if (confirm !== 'yes') {
    return NextResponse.json({ error: 'confirm=yes 파라미터를 추가하세요.' }, { status: 400 })
  }

  // 관리자 인증 확인
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }
  const authProfile = await getAuthenticatedUserProfileRole()
  if (!authProfile || !isAdminRole(authProfile.role)) {
    return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
  }

  const adminClient = createAdminClient()

  // 보존할 당사자: wildam3242@gmail.com (정소연)
  // profiles 테이블에서 해당 이메일의 UUID를 찾습니다
  const keepEmail = 'wildam3242@gmail.com'

  // auth.users에서 이메일로 검색 (admin API)
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
  const keepUser = authUsers?.find((u: any) => u.email === keepEmail)
  const keepId = keepUser?.id ?? null

  // 전체 당사자 목록 조회
  const { data: allParticipants, error: listError } = await adminClient
    .from('participants')
    .select('id, name')

  if (listError) {
    return NextResponse.json({ error: `participants 조회 실패: ${listError.message}` }, { status: 500 })
  }

  // 삭제 대상 필터링 (정소연 제외)
  const toDelete = (allParticipants ?? []).filter((p: any) => p.id !== keepId)

  if (toDelete.length === 0) {
    return NextResponse.json({ message: '삭제할 더미 당사자가 없습니다.', kept: keepId })
  }

  const deleteIds = toDelete.map((p: any) => p.id)
  const deleteNames = toDelete.map((p: any) => p.name)

  // CASCADE 삭제
  const { error: deleteError } = await adminClient
    .from('participants')
    .delete()
    .in('id', deleteIds)

  if (deleteError) {
    return NextResponse.json({ error: `삭제 실패: ${deleteError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    message: `${toDelete.length}명의 더미 당사자 삭제 완료`,
    deleted: deleteNames,
    kept: keepId ? `${keepEmail} (${keepUser?.user_metadata?.name ?? '정소연'})` : '보존 대상 없음',
  })
}
