import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient, createClient } from '@/utils/supabase/server'
import NavDropdown from '@/components/layout/NavDropdown'
import CardRegistrationForm from '@/components/card/CardRegistrationForm'
import { extractStoragePath } from '@/utils/supabase/storage'

const CARD_PHOTO_SIGNED_URL_EXPIRES = 60 * 15

export default async function CardRegistrationPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // user.id 또는 email로 participants 조회
  const { data: participant } = await adminClient
    .from('participants')
    .select('id')
    .or(`id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle()

  if (!participant) {
    return (
      <div className="flex min-h-dvh flex-col bg-background p-4 text-foreground">
        <header className="mb-6 flex h-14 items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-800">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">중랑구청</span>
          </Link>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="text-6xl">💳</span>
          <p className="font-bold text-zinc-500">아직 당사자 정보가 없어요.<br />관리자에게 말씀해 주세요!</p>
        </div>
      </div>
    )
  }

  const { data: cardData } = await adminClient
    .from('card_registrations')
    .select('id, participant_id, image_urls, created_at')
    .eq('participant_id', participant.id)
    .order('created_at', { ascending: false })

  const cardRegistrations = await Promise.all((cardData || []).map(async (item) => {
    const imageUrls = (item.image_urls || []) as string[]
    const signedUrls = await Promise.all(imageUrls.map(async (url: string) => {
      const path = extractStoragePath(url, 'card-photos')
      if (!path) return null
      const { data } = await adminClient.storage
        .from('card-photos')
        .createSignedUrl(path, CARD_PHOTO_SIGNED_URL_EXPIRES)
      return data?.signedUrl ?? null
    }))

    return {
      id: item.id,
      created_at: item.created_at,
      image_urls: signedUrls.filter((url): url is string => Boolean(url)),
    }
  }))

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-10 text-foreground">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-zinc-200 bg-background/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-800">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">중랑구청</span>
          </Link>
          <span className="text-zinc-300">·</span>
          <h1 className="text-sm font-black text-zinc-800">💳 카드 등록하기</h1>
        </div>
        <NavDropdown />
      </header>

      <main className="w-full flex-1 p-4">
        <div className="mb-6">
          <h2 className="text-base font-bold text-zinc-800">카드 등록하기</h2>
          <p className="mt-0.5 text-sm font-medium text-zinc-500">카드 사진만 따로 등록할 수 있어요.</p>
        </div>

        <CardRegistrationForm registrations={cardRegistrations} />
      </main>
    </div>
  )
}