/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { formatCurrency, getBudgetVisualInfo } from "@/utils/budget-visuals";
import { speak } from "@/utils/tts";
import Link from "next/link";
import { EasyTerm } from "@/components/ui/EasyTerm";
import BalanceVisualWidget from "./BalanceVisualWidget";
import BudgetTrendChart from "./BudgetTrendChart";
import BlockCustomizeSheet from "./BlockCustomizeSheet";
import WeeklyChartBlock from "./WeeklyChartBlock";
import {
  UIPreferences,
  DEFAULT_PREFERENCES,
  BlockId,
  BLOCK_METADATA,
} from "@/types/ui-preferences";
import NavDropdown from "@/components/layout/NavDropdown";
import HelpButton from "@/components/help/HelpButton";

import EasyModeOnboarding from "./EasyModeOnboarding";
import HelpAutoTrigger from "@/components/help/HelpAutoTrigger";
import ImageLightbox from "@/components/ui/ImageLightbox";

interface FundingSource {
  id: string;
  name: string;
  monthly_budget: number;
  yearly_budget: number;
  current_month_balance: number;
  current_year_balance: number;
  start_date?: string | null;
  end_date?: string | null;
}

interface DailyTransaction {
  date: string;
  amount: number;
  activity_name: string;
  status: "pending" | "confirmed" | "rejected";
  receipt_image_url?: string | null;
  activity_image_url?: string | null;
  memo?: string | null;
}

interface MonthlyTx {
  id: string;
  activity_name: string;
  amount: number;
  date: string;
  category?: string | null;
}

interface MonthlyData {
  month: string;
  totalSpent: number;
  budget: number;
  transactions?: MonthlyTx[];
}

interface HomeDashboardProps {
  participant: any;
  participantId: string;
  fundingSources: FundingSource[];
  recentTransactions: any[];
  remainingDays: number;
  totalDaysInMonth: number;
  userName: string;
  dailyTransactions?: DailyTransaction[];
  monthlyTrend?: MonthlyData[];
  uiPreferences?: UIPreferences | null;
  rejectedTransactionIds?: string[];
}

export default function HomeDashboard({
  participant,
  participantId,
  fundingSources,
  recentTransactions,
  remainingDays,
  totalDaysInMonth,
  userName,
  dailyTransactions = [],
  monthlyTrend = [],
  uiPreferences,
  rejectedTransactionIds = [],
}: HomeDashboardProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [unseenRejectedIds, setUnseenRejectedIds] = useState<string[]>([]);
  const [localPreferences, setLocalPreferences] = useState<UIPreferences>(
    () => {
      const prefs = uiPreferences ?? DEFAULT_PREFERENCES;
      return {
        ...prefs,
        enabled_blocks: (prefs.enabled_blocks || []).filter(
          (id) => id in BLOCK_METADATA,
        ),
      };
    },
  );

  // 미리보기 등 외부에서 uiPreferences prop이 바뀌면 즉시 동기화
  useEffect(() => {
    const prefs = uiPreferences ?? DEFAULT_PREFERENCES;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalPreferences({
      ...prefs,
      enabled_blocks: (prefs.enabled_blocks || []).filter(
        (id) => id in BLOCK_METADATA,
      ),
    });
  }, [uiPreferences]);

  // 거절된 거래 중 아직 확인 안 한 것 필터링
  useEffect(() => {
    const checkUnseen = () => {
      try {
        const raw = localStorage.getItem('seen_rejected_txs')
        const seen: string[] = raw ? JSON.parse(raw) : []
        const unseen = rejectedTransactionIds.filter(id => !seen.includes(id))
        setUnseenRejectedIds(unseen)
      } catch {
        setUnseenRejectedIds(rejectedTransactionIds)
      }
    }
    checkUnseen()
    window.addEventListener('seen_rejected_updated', checkUnseen)
    return () => window.removeEventListener('seen_rejected_updated', checkUnseen)
  }, [rejectedTransactionIds]);

  // 통합 계산 및 노출용 활성 재원 필터링
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const activeFundingSources = fundingSources.filter((fs) => {
    if (fs.start_date) {
      const start = new Date(fs.start_date);
      const startMonthStart = new Date(
        start.getFullYear(),
        start.getMonth(),
        1,
      );
      if (startMonthStart > currentMonthStart) return false;
    }
    if (fs.end_date) {
      const end = new Date(fs.end_date);
      const endMonthStart = new Date(end.getFullYear(), end.getMonth(), 1);
      if (endMonthStart < currentMonthStart) return false;
    }
    return true;
  });

  const totalMonthlyBudget =
    activeFundingSources.reduce(
      (acc, fs) => acc + Number(fs.monthly_budget),
      0,
    ) || participant.monthly_budget_default;
  const totalMonthBalance = activeFundingSources.reduce(
    (acc, fs) => acc + Number(fs.current_month_balance),
    0,
  );
  const totalYearBalance = activeFundingSources.reduce(
    (acc, fs) => acc + Number(fs.current_year_balance),
    0,
  );
  const totalYearlyBudget =
    activeFundingSources.reduce(
      (acc, fs) => acc + Number(fs.yearly_budget),
      0,
    ) || participant.yearly_budget_default;

  const visual = getBudgetVisualInfo(
    totalMonthBalance,
    totalMonthlyBudget,
    remainingDays,
    totalDaysInMonth,
  );

  // ── 블록별 렌더 함수 (enabled_blocks 배열 순서에 따라 호출) ──────
  function renderBlock(blockId: BlockId) {
    switch (blockId) {
      case "source_view":
        if (activeFundingSources.length === 0) return null;
        return (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">
              <EasyTerm formal="재원별 잔액" easy="돈 종류별 남은 돈" />
            </h3>
            {activeFundingSources.map((fs) => {
              const fsPercentage =
                Number(fs.monthly_budget) > 0
                  ? Math.max(
                      0,
                      Math.round(
                        (Number(fs.current_month_balance) /
                          Number(fs.monthly_budget)) *
                          100,
                      ),
                    )
                  : 0;
              const fsVisual = getBudgetVisualInfo(
                Number(fs.current_month_balance),
                Number(fs.monthly_budget),
                remainingDays,
                totalDaysInMonth,
              );
              return (
                <div
                  key={fs.id}
                  className={`p-5 rounded-3xl border transition-all ${
                    fsVisual.status === "critical"
                      ? "bg-red-50/55 border-red-100 shadow-[0_4px_20px_rgba(239,68,68,0.01)]"
                      : fsVisual.status === "warning"
                        ? "bg-orange-50/55 border-orange-100 shadow-[0_4px_20px_rgba(249,115,22,0.01)]"
                        : "bg-white border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        {fs.name}
                      </p>
                      {(fs.start_date || fs.end_date) && (
                        <p className="text-[10px] text-zinc-450 font-bold mt-1">
                          📅 {fs.start_date || "시작일 없음"} ~{" "}
                          {fs.end_date || "종료일 없음"}
                        </p>
                      )}
                      <p
                        className={`text-2xl font-black mt-1 hc-amount ${
                          fsVisual.status === "critical"
                            ? "text-red-600"
                            : fsVisual.status === "warning"
                              ? "text-orange-600"
                              : "text-zinc-900"
                        }`}
                      >
                        {formatCurrency(Number(fs.current_month_balance))}원
                      </p>
                    </div>
                    <p
                      className={`text-lg font-black hc-amount ${
                        fsPercentage <= 20
                          ? "text-red-600"
                          : fsPercentage <= 40
                            ? "text-orange-600"
                            : "text-zinc-900"
                      }`}
                    >
                      {fsPercentage}
                      <EasyTerm formal="%" easy="퍼센트" />
                    </p>
                  </div>
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden hc-gauge">
                    <div
                      className={`h-full rounded-full transition-all hc-gauge-fill ${
                        fsVisual.status === "critical"
                          ? "bg-red-500"
                          : fsVisual.status === "warning"
                            ? "bg-orange-500"
                            : "bg-zinc-900"
                      }`}
                      style={{ width: `${fsPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        );

      case "yearly_balance":
        return (
          <section className="p-6 rounded-3xl bg-white border border-zinc-200/80 flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">
                <EasyTerm formal="올해 전체 잔액" easy="올해 남은 돈" />
              </span>
              <span className="text-2xl font-black text-zinc-800 hc-amount">
                {formatCurrency(totalYearBalance)}원
              </span>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="text-xs text-zinc-400 font-bold">
                <EasyTerm formal="연간 예산" easy="1년 쓸 수 있는 돈" />
              </span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden hc-gauge">
                  <div
                    className="h-full bg-zinc-400 rounded-full hc-gauge-fill"
                    style={{
                      width: `${totalYearlyBudget > 0 ? (totalYearBalance / totalYearlyBudget) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-black text-zinc-500 hc-amount">
                  {totalYearlyBudget > 0
                    ? Math.round((totalYearBalance / totalYearlyBudget) * 100)
                    : 0}
                  <EasyTerm formal="%" easy="퍼센트" />
                </span>
              </div>
            </div>
          </section>
        );

      case "monthly_trend":
        if (monthlyTrend.length === 0) return null;
        return <BudgetTrendChart monthlyData={monthlyTrend} />;

      case "weekly_chart":
        if (dailyTransactions.length === 0) return null;
        return (
          <WeeklyChartBlock
            dailyTransactions={dailyTransactions}
            themeColor={visual.themeColor}
          />
        );
      case "calendar_shortcut":
        return (
          <Link
            href="/calendar"
            className="group flex items-center gap-4 p-5 rounded-3xl bg-white border border-zinc-200/80 hover:border-zinc-350 hover:bg-zinc-50 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.02)] active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-2xl">📅</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-800 text-base">달력 보기</p>
              <p className="text-xs text-zinc-400 font-bold mt-0.5">
                이번 달 활동을 달력에서 확인하세요
              </p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-600 transition-colors text-lg">
              ▸
            </span>
          </Link>
        );

      case "recent_transactions":
        return (
          <section className="flex flex-col gap-3">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">
                  <EasyTerm formal="최근 사용 내역" easy="최근에 쓴 돈" />
                </h3>
                {recentTransactions.length > 0 && (
                  <button
                    onClick={() => {
                      const txText = recentTransactions
                        .slice(0, 3)
                        .map(
                          (tx: any) => {
                            const displayName = tx.category && tx.category.includes(' - ')
                              ? tx.category
                              : (tx.activity_name && tx.activity_name.includes(' - ')
                                  ? tx.activity_name
                                  : tx.category ? `${tx.category} - 기타` : '기타')
                            return `${displayName} ${formatCurrency(tx.amount)}원`
                          }
                        )
                        .join(", ");
                      speak(`최근 사용 내역입니다. ${txText}`);
                    }}
                    className="w-6 h-6 rounded-full bg-zinc-150 hover:bg-zinc-200 flex items-center justify-center text-xs active:scale-95"
                    aria-label="최근 내역 음성으로 듣기"
                  >
                    🔊
                  </button>
                )}
              </div>
              <Link
                href="/calendar"
                className="text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                전체 보기
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-center text-zinc-450 text-sm font-medium">
                아직 쓴 적이 없어요.
              </div>
            ) : (
              recentTransactions.map((tx: any) => (
                <Link
                  key={tx.id}
                  href={`/transactions/${tx.id}`}
                  className="p-4 rounded-2xl bg-white border border-zinc-200/80 flex flex-col gap-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-zinc-300 hover:shadow-md active:scale-[0.99] transition-all"
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-3">
                      {tx.receipt_image_url && tx.status !== 'rejected' ? (
                        <div
                          className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-zinc-200"
                        >
                          <Image
                            src={tx.receipt_image_url}
                            alt="영수증"
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              tx.status === "confirmed" ? "bg-green-500" :
                              tx.status === "rejected" ? "bg-red-500" : "bg-orange-400"
                            }`}
                          />
                          <span className="text-xs font-bold text-zinc-550">
                            {tx.status === "confirmed" ? "✓" :
                             tx.status === "rejected" ? "✕" : "⏳"}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5">
                        <p className="font-black text-zinc-800 text-base">
                          {tx.category && tx.category.includes(' - ')
                            ? tx.category
                            : (tx.activity_name && tx.activity_name.includes(' - ')
                                ? tx.activity_name
                                : tx.category ? `${tx.category} - 기타` : '기타')}
                        </p>
                        <p className="text-xs text-zinc-450">
                          {tx.date}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-zinc-900 text-sm hc-amount">
                        -{formatCurrency(tx.amount)}원
                      </p>
                      <span
                        className={`text-xs font-bold ${
                          tx.status === "confirmed" ? "text-green-600" :
                          tx.status === "rejected" ? "text-red-500" : "text-orange-500"
                        }`}
                      >
                        {tx.status === "confirmed" ? (
                          <EasyTerm formal="확정" easy="확인됨" />
                        ) : tx.status === "rejected" ? (
                          <EasyTerm formal="승인 거절" easy="승인 거절" />
                        ) : (
                          <EasyTerm formal="임시" easy="확인 중" />
                        )}
                      </span>
                    </div>
                  </div>
                  {tx.status === "rejected" && (
                    <div className="w-full bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-red-500 text-xs">❌</span>
                      <p className="text-xs font-bold text-red-700">탭해서 거절 사유 확인하기 →</p>
                    </div>
                  )}
                </Link>
              ))
            )}
          </section>
        );

      case "activity_gallery":
        return (
          <Link
            href="/gallery"
            className="group flex items-center gap-4 p-5 rounded-3xl bg-white border border-zinc-200/80 hover:border-zinc-350 hover:bg-zinc-50 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.02)] active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-2xl">🖼️</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-800 text-base">활동 사진</p>
              <p className="text-xs text-zinc-400 font-bold mt-0.5">
                활동 사진을 모아볼 수 있어요
              </p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-600 transition-colors text-lg">
              ▸
            </span>
          </Link>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col min-h-dvh easy-read-bg text-foreground participant-view pb-10">
      <HelpAutoTrigger sectionKey="home" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-150/80">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-black tracking-tight text-zinc-800 hover:opacity-70 transition-opacity"
        >
          <span className="h-8 w-8 overflow-hidden rounded-xl border border-zinc-200/70 shadow-sm shrink-0">
            <img
              src="https://pbs.twimg.com/profile_images/1588913576349401089/GkEk9byS_400x400.jpg"
              alt="중랑구 로고"
              className="h-full w-full object-cover"
            />
          </span>
          <span>중랑구청</span>
        </Link>
        <div className="flex items-center gap-1">
          {/* 도움말, 궁금한 점, 화면 설정 */}
          <div className="flex items-center bg-zinc-100/80 border border-zinc-200/20 rounded-full p-0.5 gap-0.5">
            <HelpButton
              sectionKey="home"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-zinc-650 hover:bg-white hover:shadow-sm transition-all active:scale-95"
              text={<span className="text-xs font-bold">📖 사용법</span>}
            />
            <div className="w-px h-3 bg-zinc-300" aria-hidden="true" />
            <button
              onClick={() => setIsSheetOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-zinc-650 hover:bg-white hover:shadow-sm transition-all active:scale-95"
              aria-label="화면 설정"
              title="화면 설정"
            >
              <span className="text-xs font-bold">⚙️ 화면 설정</span>
            </button>
          </div>

          <div className="text-xs font-bold px-2.5 py-1.5 bg-primary/10 rounded-full text-primary whitespace-nowrap hidden sm:block ml-1">
            {userName} 님
          </div>
          <NavDropdown />
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* 거절 알림 배너 */}
        {unseenRejectedIds.length > 0 && (
          <Link
            href={`/transactions/${unseenRejectedIds[0]}`}
            className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border-2 border-red-200 hover:bg-red-100 active:scale-[0.99] transition-all shadow-sm animate-fade-in-up"
          >
            <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
              <span className="text-xl">❌</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-red-800 text-sm">
                거절처리된 영수증이 있어요!
              </p>
              <p className="text-xs text-red-500 font-bold mt-0.5">
                {unseenRejectedIds.length}건 미확인 · 탭해서 확인해주세요
              </p>
            </div>
            <span className="text-red-300 text-lg font-bold">▸</span>
          </Link>
        )}

        <section className="p-6 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-2xl">👋</span>
            <h2 className="text-xl font-black text-zinc-800">
              안녕하세요, {userName || "당사자"}님
            </h2>
          </div>
          <p className="text-xs text-zinc-450 font-bold">
            오늘 사용할 수 있는 예산과 최근 활동을 한눈에 확인할 수 있어요.
          </p>
          <p className="text-xs text-zinc-450 font-bold">
            이번 달에 사용한 금액의 증빙자료는 익월 5일까지 제출해요!
          </p>
        </section>

        {/* [필수] 잔액 시각화 위젯 */}
        <div className="stagger-item" style={{ animationDelay: "0s" }}>
          <BalanceVisualWidget
            currentBalance={totalMonthBalance}
            totalBudget={totalMonthlyBudget}
            percentage={visual.percentage}
            themeColor={visual.themeColor}
            icon={visual.icon}
            statusMessage={visual.message}
            remainingDays={remainingDays}
            participantId={participantId}
            fundingSources={fundingSources}
          />
        </div>

        {/* [선택] enabled_blocks 배열 순서대로 렌더링 */}
        {localPreferences.enabled_blocks.map((blockId, idx) => {
          const content = renderBlock(blockId);
          if (!content) return null;
          return (
            <div
              key={blockId}
              className="stagger-item"
              style={{ animationDelay: `${(idx + 1) * 0.08}s` }}
            >
              {content}
            </div>
          );
        })}
      </main>

      {/* 화면 설정 바텀시트 */}
      <BlockCustomizeSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* 첫 사용 시 쉬운 말 모드 선택 온보딩 */}
      <EasyModeOnboarding />
    </div>
  );
}
