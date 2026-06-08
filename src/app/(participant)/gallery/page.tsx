import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EasyTerm } from '@/components/ui/EasyTerm'
import GalleryClient from './GalleryClient'
import { getSignedImageUrls } from '@/app/actions/storage'
import NavDropdown from '@/components/layout/NavDropdown'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'

// 2026년 5월~10월 고정, 현재 달 기준으로 기본값 설정
function getFixedMonths() {
  const months = []
  for (let m = 5; m <= 10; m++) {
    const value = `2026-${String(m).padStart(2, '0')}`
    const label = `2026년 ${m}월`
    months.push({ value, label })
  }
  return months
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  noStore()
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const userEmail = user.email?.trim().toLowerCase() || null

  // user.id 또는 email로 participants 조회
  let participantData = await adminClient
    .from('participants')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!participantData.data && userEmail) {
    participantData = await adminClient
      .from('participants')
      .select('id')
      .ilike('email', userEmail)
      .maybeSingle()
  }

  const participantId = participantData.data?.id ?? user.id

  const months = getFixedMonths()

  // 현재 달을 5~10월 범위로 클램핑
  const now = new Date()
  const nowValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const validValues = months.map(m => m.value)
  const defaultMonth = validValues.includes(nowValue) ? nowValue : months[months.length - 1].value
  const currentMonth = validValues.includes(params.month || '') ? params.month! : defaultMonth

  // 해당 월의 시작/끝 날짜 계산
  const [year, month] = currentMonth.split('-').map(Number)
  const startDate = `${currentMonth}-01`
  const nextMonthDate = new Date(year, month, 1) // month is 1-based so this gives next month day 1
  const endDate = nextMonthDate.toISOString().split('T')[0]

  const { data: transactions } = await adminClient
    .from('transactions')
    .select('id, activity_name, date, amount, receipt_image_url, activity_image_url, receipt_image_urls, activity_image_urls, category, status')
    .eq('participant_id', participantId)
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date', { ascending: false })

  const rawItems = (transactions || []).filter(
    (t: any) => 
      t.receipt_image_url || 
      t.activity_image_url || 
      (t.receipt_image_urls && t.receipt_image_urls.length > 0) ||
      (t.activity_image_urls && t.activity_image_urls.length > 0)
  )
  const payload = rawItems.map((t: any) => {
    const receiptUrl = (t.receipt_image_urls && t.receipt_image_urls.length > 0)
      ? t.receipt_image_urls[0]
      : (t.receipt_image_url ?? null);
    const activityUrl = (t.activity_image_urls && t.activity_image_urls.length > 0)
      ? t.activity_image_urls[0]
      : (t.activity_image_url ?? null);
    return { id: t.id, receiptUrl, activityUrl };
  })

  const [signedUrls, originalUrls] = await Promise.all([
    getSignedImageUrls(payload, true),
    getSignedImageUrls(payload, false)
  ])

  const items = rawItems.map((t: any) => {
    const receipt = (t.receipt_image_urls && t.receipt_image_urls.length > 0)
      ? t.receipt_image_urls[0]
      : t.receipt_image_url;
    const activity = (t.activity_image_urls && t.activity_image_urls.length > 0)
      ? t.activity_image_urls[0]
      : t.activity_image_url;
    return {
      id: t.id,
      activity_name: t.activity_name,
      date: t.date,
      amount: t.amount,
      receipt_image_url: signedUrls[t.id]?.receipt ?? receipt,
      receipt_original_url: originalUrls[t.id]?.receipt ?? receipt,
      activity_image_url: signedUrls[t.id]?.activity ?? activity,
      activity_original_url: originalUrls[t.id]?.activity ?? activity,
      category: t.category,
      status: t.status,
    };
  })

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-xl">←</Link>
          <h1 className="text-lg font-bold tracking-tight">
            <EasyTerm formal="사진 모아보기" easy="내 사진들 보기" />
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <NavDropdown />
        </div>
      </header>

      <GalleryClient items={items} currentMonth={currentMonth} months={months} />
    </div>
  )
}
