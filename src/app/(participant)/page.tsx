/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import HomeDashboard from "@/components/home/HomeDashboard";
import { UIPreferences } from "@/types/ui-preferences";
import { getSignedImageUrls } from "@/app/actions/storage";
import { ensureMonthlyBudgetRollover } from "@/app/actions/budgetRollover";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function calculateDisplayFundingSources(participant: any) {
  const fundingSources = participant.funding_sources || [];
  return fundingSources.map((fs: any) => {
    return {
      ...fs,
      current_month_balance: Number(fs.current_month_balance || 0),
      current_year_balance: Number(fs.current_year_balance || 0),
    };
  });
}

export default async function Home() {
  const supabase = await createClient();

  const authData = await supabase.auth.getUser();
  const user = authData.data.user;

  if (!user) {
    redirect("/login");
  }

  const adminClient = createAdminClient();

  // 사용자 프로필 및 역할 조회
  // RLS/응답 래핑 이슈 방지를 위해 adminClient로 조회
  const profileData = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profile = (profileData.data as any)?.data ?? profileData.data;

  const role = String(profile?.role ?? "")
    .trim()
    .toLowerCase();

  if (role === "admin" || role === "superadmin" || role === "super_admin") {
    redirect("/admin");
  }

  // 당사자 예산 정보 조회
  const profileEmail =
    typeof profile?.email === "string" && profile.email.trim()
      ? profile.email.trim().toLowerCase()
      : null;
  const authEmail = user.email?.trim().toLowerCase() || null;
  const participantEmail = profileEmail || authEmail;

  let participantData = await adminClient
    .from("participants")
    .select("*, funding_sources(*)")
    .eq("id", user.id)
    .maybeSingle();

  if (!participantData.data && participantEmail) {
    participantData = await adminClient
      .from("participants")
      .select("*, funding_sources(*)")
      .eq("email", participantEmail)
      .maybeSingle();
  }

  let participant = participantData.data;
  const participantId = participant?.id ?? user.id;

  if (participant) {
    const rollover = await ensureMonthlyBudgetRollover(participant.id, true);
    if (rollover.updated > 0) {
      const refreshedParticipantData = await adminClient
        .from("participants")
        .select("*, funding_sources(*)")
        .eq("id", participant.id)
        .maybeSingle();
      participant = refreshedParticipantData.data ?? participant;
    }
  }

  // 날짜 계산
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = totalDaysInMonth - now.getDate() + 1;

  // 데이터가 없는 경우
  if (!participant) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <h1 className="text-xl font-bold tracking-tight">중랑구청</h1>
        </header>

        <main className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-6 max-w-sm mx-auto">
          <span className="text-8xl">👋</span>

          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">반가워요!</h2>
            <p className="text-zinc-500 font-medium leading-relaxed">
              아직 예산 정보가 없어요.
              <br />
              관리자에게 말씀해 주세요.
            </p>
          </div>

          <button className="mt-4 px-8 py-3 bg-zinc-100 text-zinc-500 rounded-xl font-bold pointer-events-none">
            준비하고 있어요
          </button>
        </main>
      </div>
    );
  }

  // 최근 사용 내역 조회
  let recentTransactions: any[] = [];
  let dailyTransactions: any[] = [];
  const monthlyTrend: any[] = [];

  const firstDayOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDayOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${String(
    totalDaysInMonth,
  ).padStart(2, "0")}`;

  // ui_preferences 파싱
  const rawPrefs = participant.ui_preferences as any;
  const uiPreferences: UIPreferences | null = rawPrefs?.enabled_blocks
    ? { enabled_blocks: rawPrefs.enabled_blocks }
    : null;

  // 4개 독립 쿼리 병렬 실행
  const [recentTxData, dailyTxData, { data: allMonthTxs }, rejectedTxData] = await Promise.all([
    adminClient
      .from("transactions")
      .select("*")
      .eq("participant_id", participantId)
      .order("date", { ascending: false })
      .limit(3),

    adminClient
      .from("transactions")
      .select(
        "id, date, amount, activity_name, status, memo, receipt_image_url, activity_image_url, receipt_image_urls, activity_image_urls",
      )
      .eq("participant_id", participantId)
      .gte("date", firstDayOfMonth)
      .lte("date", lastDayOfMonth)
      .order("date", { ascending: true }),

    adminClient
      .from("transactions")
      .select("id, amount, date, activity_name, category, funding_source_id")
      .eq("participant_id", participantId)
      .gte("date", "2026-05-01")
      .lte("date", "2026-10-31")
      .order("date", { ascending: true }),

    adminClient
      .from("transactions")
      .select("id")
      .eq("participant_id", participantId)
      .eq("status", "rejected"),
  ]);

  const rawRecent = recentTxData.data || [];
  const rawDaily = dailyTxData.data || [];
  const displayFundingSources = calculateDisplayFundingSources(participant);
  participant = { ...participant, funding_sources: displayFundingSources };

  // 영수증·활동사진 signed URL 변환
  const allForSigning = [
    ...rawRecent.map((t: any) => {
      const receiptUrl = (t.receipt_image_urls && t.receipt_image_urls.length > 0)
        ? t.receipt_image_urls[0]
        : (t.receipt_image_url ?? null);
      const activityUrl = (t.activity_image_urls && t.activity_image_urls.length > 0)
        ? t.activity_image_urls[0]
        : (t.activity_image_url ?? null);
      return { id: t.id, receiptUrl, activityUrl };
    }),
    ...rawDaily.map((t: any) => {
      const receiptUrl = (t.receipt_image_urls && t.receipt_image_urls.length > 0)
        ? t.receipt_image_urls[0]
        : (t.receipt_image_url ?? null);
      const activityUrl = (t.activity_image_urls && t.activity_image_urls.length > 0)
        ? t.activity_image_urls[0]
        : (t.activity_image_url ?? null);
      return { id: t.id, receiptUrl, activityUrl };
    }),
  ];

  const signedUrlMap = await getSignedImageUrls(allForSigning);

  recentTransactions = rawRecent.map((t: any) => {
    const receipt = (t.receipt_image_urls && t.receipt_image_urls.length > 0)
      ? t.receipt_image_urls[0]
      : t.receipt_image_url;
    const activity = (t.activity_image_urls && t.activity_image_urls.length > 0)
      ? t.activity_image_urls[0]
      : t.activity_image_url;
    return {
      ...t,
      receipt_image_url: signedUrlMap[t.id]?.receipt ?? receipt,
      activity_image_url: signedUrlMap[t.id]?.activity ?? activity,
    };
  });

  dailyTransactions = rawDaily.map((t: any) => {
    const receipt = (t.receipt_image_urls && t.receipt_image_urls.length > 0)
      ? t.receipt_image_urls[0]
      : t.receipt_image_url;
    const activity = (t.activity_image_urls && t.activity_image_urls.length > 0)
      ? t.activity_image_urls[0]
      : t.activity_image_url;
    return {
      ...t,
      receipt_image_url: signedUrlMap[t.id]?.receipt ?? receipt,
      activity_image_url: signedUrlMap[t.id]?.activity ?? activity,
    };
  });

  for (let mIdx = 5; mIdx <= 10; mIdx++) {
    const m = `2026-${String(mIdx).padStart(2, "0")}`;
    const targetMonthStart = new Date(2026, mIdx - 1, 1);

    const activeFsInMonth = (participant.funding_sources || []).filter((fs: any) => {
      if (fs.start_date) {
        const start = new Date(fs.start_date);
        const startMonthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        if (startMonthStart > targetMonthStart) return false;
      }
      if (fs.end_date) {
        const end = new Date(fs.end_date);
        const endMonthStart = new Date(end.getFullYear(), end.getMonth(), 1);
        if (endMonthStart < targetMonthStart) return false;
      }
      return true;
    });

    const totalMonthlyBudgetInMonth =
      activeFsInMonth.reduce(
        (acc: number, fs: any) => acc + Number(fs.monthly_budget),
        0,
      ) ||
      participant.monthly_budget_default ||
      0;

    const monthTxs = (allMonthTxs || []).filter((t: any) =>
      t.date.startsWith(m),
    );

    const totalSpent = monthTxs.reduce(
      (sum: number, t: any) => sum + Number(t.amount),
      0,
    );

    monthlyTrend.push({
      month: m,
      totalSpent,
      budget: totalMonthlyBudgetInMonth,
      transactions: monthTxs.map((t: any) => ({
        id: t.id,
        activity_name: t.activity_name,
        amount: Number(t.amount),
        date: t.date,
        category: t.category ?? null,
      })),
    });
  }
  const rejectedTransactionIds = (rejectedTxData.data || []).map((t: any) => t.id);

  return (
    <HomeDashboard
      participant={participant}
      participantId={participantId}
      fundingSources={displayFundingSources}
      recentTransactions={recentTransactions || []}
      remainingDays={remainingDays}
      totalDaysInMonth={totalDaysInMonth}
      userName={profile?.name || "사용자"}
      dailyTransactions={dailyTransactions || []}
      monthlyTrend={monthlyTrend}
      uiPreferences={uiPreferences}
      rejectedTransactionIds={rejectedTransactionIds}
    />
  );
}
