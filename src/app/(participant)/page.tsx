/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import HomeDashboard from "@/components/home/HomeDashboard";
import { UIPreferences, DEFAULT_PREFERENCES } from "@/types/ui-preferences";
import { getSignedImageUrls } from "@/app/actions/storage";
import { getMonthlyPlanProgress } from "@/app/actions/monthlyPlan";

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

  if (role === "supporter") {
    redirect("/supporter");
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

  const participant = participantData.data;
  const participantId = participant?.id ?? user.id;

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
              지원자 선생님에게 말씀해 주세요.
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

  const effectivePrefs = uiPreferences ?? DEFAULT_PREFERENCES;

  // 3개 독립 쿼리 병렬 실행
  const sixMonthsAgo = new Date(year, month - 5, 1).toISOString().split("T")[0];

  const [recentTxData, dailyTxData, { data: allMonthTxs }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("participant_id", participantId)
      .order("date", { ascending: false })
      .limit(3),

    supabase
      .from("transactions")
      .select(
        "id, date, amount, activity_name, status, receipt_image_url, activity_image_url",
      )
      .eq("participant_id", participantId)
      .gte("date", firstDayOfMonth)
      .lte("date", lastDayOfMonth)
      .order("date", { ascending: true }),

    supabase
      .from("transactions")
      .select("id, amount, date, activity_name, category")
      .eq("participant_id", participantId)
      .gte("date", sixMonthsAgo)
      .lte("date", lastDayOfMonth)
      .order("date", { ascending: true }),
  ]);

  const rawRecent = recentTxData.data || [];
  const rawDaily = dailyTxData.data || [];

  // 영수증·활동사진 signed URL 변환
  const allForSigning = [
    ...rawRecent.map((t: any) => ({
      id: t.id,
      receiptUrl: t.receipt_image_url ?? null,
      activityUrl: t.activity_image_url ?? null,
    })),
    ...rawDaily.map((t: any) => ({
      id: t.id,
      receiptUrl: t.receipt_image_url ?? null,
      activityUrl: t.activity_image_url ?? null,
    })),
  ];

  const signedUrlMap = await getSignedImageUrls(allForSigning);

  recentTransactions = rawRecent.map((t: any) => ({
    ...t,
    receipt_image_url: signedUrlMap[t.id]?.receipt ?? t.receipt_image_url,
    activity_image_url: signedUrlMap[t.id]?.activity ?? t.activity_image_url,
  }));

  dailyTransactions = rawDaily.map((t: any) => ({
    ...t,
    receipt_image_url: signedUrlMap[t.id]?.receipt ?? t.receipt_image_url,
    activity_image_url: signedUrlMap[t.id]?.activity ?? t.activity_image_url,
  }));

  // 최근 6개월 월별 지출 집계
  const totalMonthlyBudget =
    (participant.funding_sources || []).reduce(
      (acc: number, fs: any) => acc + Number(fs.monthly_budget),
      0,
    ) ||
    participant.monthly_budget_default ||
    0;

  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

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
      budget: totalMonthlyBudget,
      transactions: monthTxs.map((t: any) => ({
        id: t.id,
        activity_name: t.activity_name,
        amount: Number(t.amount),
        date: t.date,
        category: t.category ?? null,
      })),
    });
  }

  // 이번 달 월별 계획 진행률
  const currentMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const rawMonthlyPlanProgress = await getMonthlyPlanProgress(
    participantId,
    currentMonth,
  );

  // 월별 계획 이미지 signed URL 처리
  const monthlyPlanProgress = await Promise.all(
    rawMonthlyPlanProgress.map(async (p) => {
      if (!p.easy_image_url) return p;

      const { data } = await adminClient.storage
        .from("activity-photos")
        .createSignedUrl(p.easy_image_url, 86400);

      return {
        ...p,
        easy_image_url: data?.signedUrl ?? p.easy_image_url,
      };
    }),
  );

  // 지원자 편지 블록이 활성화된 경우에만 최근 발행된 평가 조회
  let latestEvaluation: {
    month: string;
    easy_summary: string | null;
    next_step: string | null;
  } | null = null;

  if (effectivePrefs.enabled_blocks.includes("evaluation_letter")) {
    const { data: evalData } = await supabase
      .from("evaluations")
      .select("month, easy_summary, next_step")
      .eq("participant_id", participantId)
      .not("published_at", "is", null)
      .order("month", { ascending: false })
      .limit(1)
      .single();

    latestEvaluation = evalData;
  }

  return (
    <HomeDashboard
      participant={participant}
      participantId={participantId}
      fundingSources={participant.funding_sources || []}
      recentTransactions={recentTransactions || []}
      remainingDays={remainingDays}
      totalDaysInMonth={totalDaysInMonth}
      userName={profile?.name || "사용자"}
      dailyTransactions={dailyTransactions || []}
      monthlyTrend={monthlyTrend}
      uiPreferences={uiPreferences}
      latestEvaluation={latestEvaluation}
      monthlyPlanProgress={monthlyPlanProgress}
      currentMonth={currentMonth}
    />
  );
}
