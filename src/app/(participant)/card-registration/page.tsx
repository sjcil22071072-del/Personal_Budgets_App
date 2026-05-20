import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import NavDropdown from '@/components/layout/NavDropdown'
import CardRegistrationForm from '@/components/card/CardRegistrationForm'

export default async function CardRegistrationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: participant } = await supabase
    .from('participants')
    .select('id')
    .eq('id', user.id)
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
          <p className="font-bold text-zinc-500">아직 당사자 정보가 없어요.<br />지원자 선생님에게 말씀해 주세요!</p>
        </div>
      </div>
    )
  }

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

        <CardRegistrationForm />
      </main>
    </div>
  )
}
