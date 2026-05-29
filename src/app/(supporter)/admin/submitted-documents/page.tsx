/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdminRole } from '@/utils/user-role'
import { getAuthenticatedUserProfileRole } from '@/utils/supabase/profile-gate'
import { extractStoragePath } from '@/utils/supabase/storage'
import SubmittedDocumentsClient from '@/components/admin/SubmittedDocumentsClient'

const SIGNED_URL_EXPIRES = 3600 // 1시간

export default async function SubmittedDocumentsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const authProfile = await getAuthenticatedUserProfileRole()
  if (!authProfile || !isAdminRole(authProfile.role)) {
    redirect('/')
  }

  // 당사자 목록 + 가족관계증명서 + 카드등록 병렬 조회
  const [
    { data: participants },
    { data: familyRegs },
    { data: cardRegs },
  ] = await Promise.all([
    adminClient.from('participants').select('id, name').order('name', { ascending: true }),
    adminClient.from('family_registrations').select('participant_id, image_url, created_at'),
    adminClient.from('card_registrations').select('id, participant_id, image_urls, created_at').order('created_at', { ascending: false }),
  ])

  // 가족관계증명서 이미지 signed URL 생성
  const familyMap = new Map<string, { imageUrl: string | null; createdAt: string | null }>()
  for (const fr of familyRegs ?? []) {
    const pid = (fr as any).participant_id
    let signedUrl: string | null = null
    const rawUrl = (fr as any).image_url
    if (rawUrl) {
      const path = extractStoragePath(rawUrl, 'family-relation-photos')
      if (path) {
        const { data } = await adminClient.storage
          .from('family-relation-photos')
          .createSignedUrl(path, SIGNED_URL_EXPIRES)
        signedUrl = data?.signedUrl ?? null
      }
      if (!signedUrl) signedUrl = rawUrl
    }
    familyMap.set(pid, { imageUrl: signedUrl, createdAt: (fr as any).created_at })
  }

  // 카드 등록 이미지 signed URL 생성 (당사자당 복수 건 지원)
  const cardMap = new Map<string, { id: string; imageUrls: string[]; createdAt: string | null }[]>()
  for (const cr of cardRegs ?? []) {
    const pid = (cr as any).participant_id
    const rawUrls: string[] = (cr as any).image_urls ?? []
    const signedUrls: string[] = []
    for (const rawUrl of rawUrls) {
      const path = extractStoragePath(rawUrl, 'card-photos')
      if (path) {
        const { data } = await adminClient.storage
          .from('card-photos')
          .createSignedUrl(path, SIGNED_URL_EXPIRES)
        signedUrls.push(data?.signedUrl ?? rawUrl)
      } else {
        signedUrls.push(rawUrl)
      }
    }
    const list = cardMap.get(pid) ?? []
    list.push({ id: (cr as any).id, imageUrls: signedUrls, createdAt: (cr as any).created_at })
    cardMap.set(pid, list)
  }

  // 클라이언트에 전달할 데이터 조합
  const initialData = (participants ?? []).map((p: any) => {
    const family = familyMap.get(p.id)
    const cards = cardMap.get(p.id) ?? []
    return {
      id: p.id,
      name: p.name ?? '이름 없음',
      familyRelation: {
        registered: !!family,
        imageUrl: family?.imageUrl ?? null,
        createdAt: family?.createdAt ?? null,
      },
      cardRegistrations: cards.map(c => ({
        id: c.id,
        imageUrls: c.imageUrls,
        createdAt: c.createdAt,
      })),
    }
  })

  const familyCount = initialData.filter(d => d.familyRelation.registered).length
  const cardCount = initialData.filter(d => d.cardRegistrations.length > 0).length

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-zinc-400 transition-colors hover:text-zinc-650 font-bold">←</Link>
          <h1 className="text-xl font-black tracking-tight text-zinc-800">제출 서류 관리</h1>
        </div>
        <div className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold text-red-500 border border-red-100">관리자</div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
        {/* 요약 통계 카드 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white p-5 border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">전체 당사자</span>
            <p className="mt-1 text-3xl font-black text-zinc-800">{initialData.length}<span className="text-xs text-zinc-400 font-bold ml-0.5">명</span></p>
          </div>
          <div className="rounded-3xl bg-white p-5 border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">가족관계증명서</span>
            <p className="mt-1 text-3xl font-black text-green-600">{familyCount}<span className="text-xs text-zinc-400 font-bold ml-0.5">/{initialData.length}</span></p>
          </div>
          <div className="rounded-3xl bg-white p-5 border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">카드 등록</span>
            <p className="mt-1 text-3xl font-black text-green-600">{cardCount}<span className="text-xs text-zinc-400 font-bold ml-0.5">/{initialData.length}</span></p>
          </div>
        </div>

        <SubmittedDocumentsClient initialData={initialData} />
      </main>
    </div>
  )
}
