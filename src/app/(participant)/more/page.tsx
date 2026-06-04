import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MoreMenuClient from '@/components/layout/MoreMenuClient'
import { getSignedImageUrl } from '@/app/actions/storage'

export default async function MorePage() {
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
      .ilike('email', userEmail)
      .maybeSingle()
  }

  const participant = participantData.data

  // 2. 내 서류만 조회: 로그인한 사용자와 연결된 당사자 id가 없으면 빈 목록을 보여줍니다.
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
    <div className="flex min-h-dvh flex-col bg-zinc-50 text-foreground">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-md">
        <Link href="/" className="text-xl font-bold text-zinc-500 transition-colors hover:text-zinc-800">
          ←
        </Link>
        <h1 className="text-base font-black text-zinc-900">내 서류함</h1>
      </header>

      <main className="flex-1 p-4">
        <MoreMenuClient fileLinks={signedFileLinks} />
      </main>
    </div>
  )
}
