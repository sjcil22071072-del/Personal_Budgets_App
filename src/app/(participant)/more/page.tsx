import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MoreMenuClient from '@/components/layout/MoreMenuClient'
import { getSignedImageUrl } from '@/app/actions/storage'
import NavDropdown from '@/components/layout/NavDropdown'
import HelpButton from '@/components/help/HelpButton'
import HelpAutoTrigger from '@/components/help/HelpAutoTrigger'

export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>
}) {
  const { open } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // 1. 당사자 정보(participants) 조회
  const userEmail = user.email?.trim().toLowerCase() || null
  let participantData = await adminClient
    .from('participants')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!participantData.data && userEmail) {
    participantData = await adminClient
      .from('participants')
      .select('*')
      .eq('email', userEmail)
      .maybeSingle()
  }

  const participant = participantData.data

  // 2. profiles 조회 (maybeSingle로 안전하게 처리)
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // 3. 내 서류만 조회: 로그인한 사용자와 연결된 당사자 id가 없으면 빈 목록을 보여줍니다.
  let signedFileLinks: any[] = []
  if (participant?.id) {
    const { data: fileLinks } = await adminClient
      .from('file_links')
      .select('*')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: false })

    signedFileLinks = fileLinks ? await Promise.all(
      fileLinks.map(async (doc) => {
        if (doc.url) {
          const signed = await getSignedImageUrl(doc.url, 'documents')
          return { ...doc, url: signed ?? doc.url }
        }
        return doc
      })
    ) : []
  }

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <HelpAutoTrigger sectionKey="more" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">중랑구청</span>
          </Link>
          <span className="text-zinc-300">·</span>
          <h1 className="text-sm font-black text-zinc-800">⚙ 더보기</h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton sectionKey="more" />
          <NavDropdown />
        </div>
      </header>

      <main className="flex-1 p-4 w-full flex flex-col gap-6">
        {/* 프로필 요약 */}
        <section className="flex items-center gap-4 p-6 rounded-[2rem] bg-white ring-1 ring-zinc-200 shadow-sm">
          <div className="flex flex-col">
            <span className="text-xl font-black text-zinc-900">
              {participant?.name || profile?.name || '사용자'} 님
            </span>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              {profile?.role === 'admin' ? '관리자' : '당사자'}
            </span>
          </div>
        </section>

        {/* 클라이언트 컴포넌트 (설정 및 로그아웃 핸들링) */}
        <MoreMenuClient fileLinks={signedFileLinks} initialOpenSection={open} />
        
        <div className="text-center py-4">
          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.3em]">중랑구청 개인예산</p>
        </div>
      </main>
    </div>
  )
}
