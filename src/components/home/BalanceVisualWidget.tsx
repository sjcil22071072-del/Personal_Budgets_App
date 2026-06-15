"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/utils/budget-visuals";
import { compressImage } from "@/utils/image-compression";
import { createTransaction } from "@/app/actions/transaction";
import { createCardRegistration } from "@/app/actions/cardRegistration";
import { EasyTerm } from "@/components/ui/EasyTerm";
import { speak } from "@/utils/tts";
import ActivityCategoryPicker, {
  getActivityMajor,
} from "@/components/transactions/ActivityCategoryPicker";

type WidgetStyle = "pie" | "water" | "text";
type UploadMode = "receipt" | "activity" | "card";

const THEME = {
  green: {
    fill: "#22c55e",
    stroke: "#16a34a",
    light: "#dcfce7",
    text: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  blue: {
    fill: "#3b82f6",
    stroke: "#2563eb",
    light: "#dbeafe",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  yellow: {
    fill: "#ca8a04",
    stroke: "#a16207",
    light: "#fef9c3",
    text: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-100",
  },
  indigo: {
    fill: "#6366f1",
    stroke: "#4f46e5",
    light: "#e0e7ff",
    text: "text-indigo-700",
    bg: "bg-zinc-50",
    border: "border-zinc-100",
  },
  orange: {
    fill: "#f97316",
    stroke: "#ea580c",
    light: "#ffedd5",
    text: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-100",
  },
  red: {
    fill: "#ef4444",
    stroke: "#dc2626",
    light: "#fee2e2",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-100",
  },
  zinc: {
    fill: "#71717a",
    stroke: "#52525b",
    light: "#f4f4f5",
    text: "text-zinc-700",
    bg: "bg-zinc-50",
    border: "border-zinc-100",
  },
} as const;

type ThemeKey = keyof typeof THEME;

/* ── 시뮬레이션 접기/프리셋 섹션 ── */
const SIM_PRESETS = [10000, 30000, 50000];

function SimulationSection({
  simAmount,
  setSimAmount,
  simValue,
  simBalance,
  isSimOver,
}: {
  simAmount: string;
  setSimAmount: (v: string) => void;
  simValue: number;
  simBalance: number;
  isSimOver: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="px-5 pb-4 pt-1">
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/60
            text-sm font-bold text-zinc-500 hover:bg-zinc-100 hover:border-zinc-300 transition-all
            flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          🛍️ 이만큼 사면 얼마 남을까?
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pb-5 pt-2 flex flex-col gap-3">
      {/* 프리셋 버튼 */}
      <div className="flex gap-2">
        {SIM_PRESETS.map((amount) => {
          const isActive = simValue === amount;
          return (
            <button
              key={amount}
              onClick={() => setSimAmount(isActive ? "" : String(amount))}
              className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 border ${
                isActive 
                  ? "bg-zinc-800 text-white border-zinc-800 shadow-sm" 
                  : "bg-zinc-50 text-zinc-650 hover:bg-zinc-100 hover:border-zinc-300 border-zinc-200"
              }`}
            >
              {formatCurrency(amount)}원
            </button>
          );
        })}
      </div>

      {/* 직접 입력 */}
      <details className="text-xs">
        <summary className="text-zinc-400 hover:text-zinc-600 cursor-pointer font-bold select-none ml-1">
          다른 금액 직접 적기
        </summary>
        <div className="mt-2 flex items-center gap-3 px-4 py-3 rounded-2xl border border-zinc-200/80 bg-zinc-50">
          <span className="text-base shrink-0">🛍️</span>
          <input
            type="number"
            inputMode="numeric"
            step={1000}
            value={simAmount}
            onChange={(e) => setSimAmount(e.target.value)}
            placeholder="금액을 써요"
            className="flex-1 bg-transparent outline-none text-sm font-bold text-zinc-700 placeholder:text-zinc-300 min-w-0"
          />
          <span className="text-sm font-bold text-zinc-400 shrink-0">원</span>
        </div>
      </details>

      {/* 결과 표시 */}
      {simValue > 0 && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between border ${isSimOver ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-200/60"}`}
        >
          <span className="text-xs text-zinc-400 font-bold">
            <EasyTerm formal="구매 후 잔액" easy="사고 남는 돈" />
          </span>
          <span
            className={`text-sm font-black ${isSimOver ? "text-red-500" : "text-zinc-800"}`}
          >
            {isSimOver ? "돈이 부족해요 ❌" : `${formatCurrency(simBalance)}원`}
          </span>
        </div>
      )}

      {/* 닫기 */}
      <button
        onClick={() => {
          setOpen(false);
          setSimAmount("");
        }}
        className="w-full py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-xs font-bold text-zinc-550 border border-zinc-200/30 transition-colors active:scale-[0.98]"
      >
        닫기
      </button>
    </div>
  );
}

interface Props {
  currentBalance: number;
  totalBudget: number;
  percentage: number;
  themeColor: string;
  icon: string;
  statusMessage: string;
  remainingDays: number;
  participantId?: string;
  fundingSources?: { id: string; name: string }[];
}

// ── 피자 그래프 ────────────────────────────────────────────────
function PizzaChart({
  percentage,
  displayBalance,
  pendingPct = 0,
}: {
  percentage: number;
  displayBalance: number;
  pendingPct?: number;
}) {
  const circumference = 2 * Math.PI * 25;
  const offset =
    circumference - circumference * Math.max(0, Math.min(1, percentage / 100));

  const pendingClamped = Math.max(0, Math.min(100 - percentage, pendingPct));
  const pendingArcLen = circumference * (pendingClamped / 100);
  const pendingDashOffset =
    pendingArcLen + circumference * (1 - percentage / 100);

  const balanceText = formatCurrency(displayBalance);
  const longText = balanceText.length >= 7;

  return (
    <div className="flex items-center justify-center py-5">
      <div className="relative w-40 h-40 lg:w-52 lg:h-52">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full -rotate-90 drop-shadow-md"
        >
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="#e5e7eb"
            stroke="#d1d5db"
            strokeWidth="1.5"
          />
          <circle cx="50" cy="50" r="42" fill="#f3f4f6" />
          <mask id="pizza-bvw">
            <circle
              cx="50"
              cy="50"
              r="25"
              fill="none"
              stroke="white"
              strokeWidth="50"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.7s ease-out" }}
            />
          </mask>
          <g mask="url(#pizza-bvw)">
            <circle cx="50" cy="50" r="44" fill="#d97706" />
            <circle cx="50" cy="50" r="38" fill="#facc15" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.5"
            />
            <circle cx="30" cy="35" r="4.5" fill="#ef4444" />
            <circle cx="70" cy="30" r="5" fill="#ef4444" />
            <circle cx="50" cy="20" r="4.5" fill="#ef4444" />
            <circle cx="55" cy="70" r="5" fill="#ef4444" />
            <circle cx="35" cy="65" r="4" fill="#ef4444" />
            <circle cx="75" cy="55" r="4.5" fill="#ef4444" />
            <circle cx="50" cy="50" r="4" fill="#ef4444" />
            <path d="M 40 40 Q 42 38 45 40 Q 42 42 40 40" fill="#22c55e" />
            <path d="M 60 60 Q 62 58 65 60 Q 62 62 60 60" fill="#22c55e" />
            <path d="M 30 50 Q 32 48 35 50 Q 32 52 30 50" fill="#22c55e" />
          </g>
          {pendingClamped > 0 && (
            <circle
              cx="50"
              cy="50"
              r="25"
              fill="none"
              stroke="#fb923c"
              strokeWidth="50"
              strokeDasharray={`${pendingArcLen} ${circumference}`}
              strokeDashoffset={pendingDashOffset}
              opacity="0.45"
              style={{ transition: "stroke-dashoffset 0.7s ease-out" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-2xl shadow-md border border-white/80 text-center max-w-[85%]">
            <span className="text-[10px] font-bold text-zinc-500 block leading-tight">
              <EasyTerm formal="잔액" easy="남은 돈" />
            </span>
            <span
              className={`${longText ? "text-base" : "text-xl"} font-black text-zinc-900 leading-tight block`}
            >
              {balanceText}
            </span>
            <span className="text-[10px] font-bold text-zinc-600 block leading-tight">
              원
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 물컵 그래프 ───────────────────────────────────────────────
function WaterViz({
  percentage,
  currentBalance,
  pendingPct = 0,
}: {
  percentage: number;
  currentBalance: number;
  pendingPct?: number;
}) {
  const isLow = percentage < 25;
  const waterColor = isLow ? "#f87171" : "#3b82f6";
  const waveBg = isLow ? "bg-red-400" : "bg-blue-400";
  const cupBorder = isLow ? "border-red-200" : "border-blue-200";
  const fillH = Math.max(5, percentage);
  const pendingClamped = Math.max(0, Math.min(pendingPct, 100 - fillH));

  const balanceText = formatCurrency(currentBalance);
  const longText = balanceText.length >= 7;

  return (
    <div className="flex flex-col items-center justify-center w-full py-4 pb-5 gap-3">
      <div
        className={`relative w-28 h-40 lg:w-36 lg:h-52 rounded-b-[2rem] border-4 border-t-0 ${cupBorder} bg-blue-50/30 overflow-hidden shadow-inner`}
      >
        <div
          className="absolute bottom-0 w-full transition-all duration-700 ease-out"
          style={{ height: `${fillH}%`, backgroundColor: waterColor }}
        >
          <div
            className={`absolute top-0 left-0 right-0 h-4 ${waveBg} opacity-50 -translate-y-1/2 rounded-[50%]`}
          />
          <div className="absolute top-0 left-3 right-3 h-2 bg-white/30 -translate-y-1/2 rounded-[50%]" />
        </div>
        {pendingClamped > 0 && (
          <div
            className="absolute left-0 right-0 border-t-2 border-b-2 border-dashed border-orange-400/70 bg-orange-200/30 transition-all duration-700 ease-out"
            style={{ bottom: `${fillH}%`, height: `${pendingClamped}%` }}
          />
        )}
        <div className="absolute bottom-1/4 left-0 w-3 h-px bg-blue-200/80" />
        <div className="absolute bottom-2/4 left-0 w-5 h-px bg-blue-200/80" />
        <div className="absolute bottom-3/4 left-0 w-3 h-px bg-blue-200/80" />
        <div
          className={`absolute -right-3 top-6 h-12 w-4 border-4 ${cupBorder} rounded-r-full`}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-2">
          <div className="bg-white/90 backdrop-blur-sm px-2 py-1.5 rounded-xl shadow-sm text-center">
            <span
              className={`${longText ? "text-sm" : "text-base"} font-black text-zinc-900 leading-none block`}
            >
              {balanceText}
            </span>
            <span className="text-[9px] font-bold text-zinc-500 block leading-tight">
              원
            </span>
          </div>
        </div>
      </div>
      <div className="text-center">
        <span className="text-xs font-medium text-zinc-500">
          남은 물 (예산)
        </span>
        <p
          className={`text-xl font-black mt-0.5 ${isLow ? "text-red-600" : "text-blue-600"}`}
        >
          {formatCurrency(currentBalance)}원
        </p>
      </div>
    </div>
  );
}

// ── 숫자/텍스트 표시 모드 ────────────────────────────────────────
function TextViz({
  percentage,
  currentBalance,
}: {
  percentage: number;
  currentBalance: number;
}) {
  const isLow = percentage < 30;
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 gap-2">
      <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.2em]">
        남은 예산
      </p>
      <p
        className={`text-8xl font-black leading-none hc-amount ${isLow ? "text-red-600" : "text-zinc-900"}`}
      >
        {percentage}
        <EasyTerm formal="%" easy="퍼센트" />
      </p>
      <p
        className={`text-3xl font-bold mt-2 hc-amount ${isLow ? "text-red-500" : "text-zinc-500"}`}
      >
        {formatCurrency(currentBalance)}원
      </p>
      {isLow && (
        <p className="text-sm font-bold text-red-500 mt-1">돈이 얼마 없어요</p>
      )}
    </div>
  );
}

// ── 메인 위젯 ─────────────────────────────────────────────────────
export default function BalanceVisualWidget({
  currentBalance,
  totalBudget,
  percentage,
  themeColor,
  icon,
  statusMessage,
  remainingDays,
  participantId,
  fundingSources = [],
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<WidgetStyle>("pie");

  const [pendingDeduction, setPendingDeduction] = useState(0);
  useEffect(() => {
    setPendingDeduction(0);
  }, [currentBalance]);

  const [simAmount, setSimAmount] = useState("");

  const targetBalance = Math.max(0, currentBalance - pendingDeduction);
  const [displayBalance, setDisplayBalance] = useState(targetBalance);
  const displayRef = useRef(targetBalance);

  useEffect(() => {
    displayRef.current = targetBalance;
    setDisplayBalance(targetBalance);
  }, [targetBalance]);

  useEffect(() => {
    const start = displayRef.current;
    const end = targetBalance;
    if (start === end) return;
    const duration = 500;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      displayRef.current = current;
      setDisplayBalance(current);
      if (progress < 1) rafId = requestAnimationFrame(animate);
    }

    let rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [targetBalance]);

  const displayPct =
    totalBudget > 0
      ? Math.round((displayBalance / totalBudget) * 100)
      : percentage;

  const simValue = parseFloat(simAmount.replace(/,/g, "")) || 0;
  const activePct =
    simValue > 0
      ? Math.max(
          0,
          Math.round(((displayBalance - simValue) / totalBudget) * 100),
        )
      : displayPct;
  const simBalance = Math.max(0, displayBalance - simValue);
  const isSimOver = simValue > 0 && simValue > displayBalance;

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const activityInputRef = useRef<HTMLInputElement>(null);
  const secondFileRef = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadAmount, setUploadAmount] = useState("");
  const [uploadDate, setUploadDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [secondPreview, setSecondPreview] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("balance-widget-style") as string | null;
    const s = raw === "pouch" ? "pie" : (raw as WidgetStyle | null);
    if (s && ["pie", "water", "text"].includes(s)) setStyle(s);
  }, []);

  const changeStyle = (s: WidgetStyle) => {
    setStyle(s);
    localStorage.setItem("balance-widget-style", s);
  };

  const handleInlineUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: Extract<UploadMode, "receipt" | "activity">,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadMode(mode);
    setUploadDescription("");
    setUploadAmount("");
    setUploadDate(new Date().toISOString().split("T")[0]);
    setUploadToast(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const closeUploadSheet = () => {
    setUploadMode(null);
    setUploadPreview(null);
    setUploadFile(null);
    setUploadDescription("");
    setUploadAmount("");
    setUploadToast(null);
    setSecondFile(null);
    setSecondPreview(null);
  };

  const handleSecondFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSecondFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSecondPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePrimaryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };



  const handleInlineSubmit = async () => {
    if (!participantId || !uploadFile) return;
    if (uploadMode === "card" && !secondFile) {
      setUploadToast("실물 카드의 앞뒷면을 모두 등록해주세요.");
      return;
    }
    if (uploadMode !== "card") {
      const parts = uploadDescription.split(" - ");
      if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
        setUploadToast("대분류와 중분류를 모두 선택하거나 직접 입력해 주세요.");
        return;
      }
    }
    setUploadSubmitting(true);
    const amountNum = parseFloat(uploadAmount) || 0;
    if (uploadMode !== "card" && amountNum > 0)
      setPendingDeduction((prev) => prev + amountNum);
    try {
      const mainCompressed = await compressImage(uploadFile);
      const secondCompressed = secondFile
        ? await compressImage(secondFile)
        : null;

      if (uploadMode === "card") {
        if (!secondCompressed) {
          setUploadToast("실물 카드의 앞뒷면을 모두 등록해주세요.");
          return;
        }
        const formData = new FormData();
        formData.append("card_images", mainCompressed);
        formData.append("card_images", secondCompressed);
        const result = await createCardRegistration(formData);
        if (result.success) {
          // ✅ 수정: 모달 먼저 닫고 refresh
          closeUploadSheet();
          router.refresh();
        } else {
          setUploadToast(
            result.error || "카드 등록에 실패했습니다. 다시 시도해주세요.",
          );
        }
        return;
      }

      const formData = new FormData();
      formData.set("participant_id", participantId);
      formData.set("date", uploadDate);
      formData.set("description", uploadDescription);
      formData.set("category", getActivityMajor(uploadDescription));
      formData.set("amount", uploadAmount);
      if (fundingSources.length > 0) {
        formData.set("funding_source_id", fundingSources[0].id);
      }
      if (uploadMode === "receipt") {
        formData.set("receipt", mainCompressed);
        if (secondCompressed) formData.set("activity_image", secondCompressed);
      } else {
        formData.set("activity_image", mainCompressed);
        if (secondCompressed) formData.set("receipt", secondCompressed);
      }
      const result = await createTransaction(formData);
      if (result.success) {
        // ✅ 수정: toast 제거, 모달 먼저 닫고 refresh
        closeUploadSheet();
        router.refresh();
      } else {
        if (amountNum > 0)
          setPendingDeduction((prev) => Math.max(0, prev - amountNum));
        setUploadToast(`기록이 안 되었어요. 다시 눌러 주세요. (${result.error || "서버 오류"})`);
      }
    } catch (err: any) {
      console.error("handleInlineSubmit 오류:", err);
      if (amountNum > 0)
        setPendingDeduction((prev) => Math.max(0, prev - amountNum));
      setUploadToast(`기록이 안 되었어요. 다시 눌러 주세요. (${err?.message || "알 수 없는 오류"})`);
    } finally {
      setUploadSubmitting(false);
    }
  };

  const c = THEME[themeColor as ThemeKey] ?? THEME.zinc;

  const STYLE_OPTIONS = [
    {
      key: "pie" as WidgetStyle,
      label: "🍕",
      title: "피자 그래프",
      short: "피자",
    },
    {
      key: "water" as WidgetStyle,
      label: "🥤",
      title: "물컵 그래프",
      short: "물컵",
    },
    {
      key: "text" as WidgetStyle,
      label: "🔢",
      title: "숫자 표시",
      short: "숫자",
    },
  ];

  return (
    <section className="rounded-3xl bg-white border border-zinc-200/80 shadow-[0_4px_25px_rgba(0,0,0,0.02)] overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-5 pt-5 pb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">
            <EasyTerm formal="잔액 요약" easy="남은 돈" />
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p
              className={`text-3xl font-black transition-all duration-500 leading-tight hc-amount ${c.text}`}
            >
              {formatCurrency(displayBalance)}
              <span className="text-xl">원</span>
            </p>
            <button
              onClick={() =>
                speak(
                  `남은 돈은 ${formatCurrency(displayBalance)}원입니다. 예산의 ${displayPct}퍼센트가 남아있습니다. ${remainingDays}일 남았습니다.`,
                )
              }
              className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-sm active:scale-95 transition-all shrink-0"
              aria-label="잔액 음성으로 듣기"
              title="음성으로 듣기"
            >
              🔊
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
              📅 {remainingDays}일 남음
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
              💰 {displayPct}
              <EasyTerm formal="%" easy="퍼센트" /> 남음
            </span>
            {pendingDeduction > 0 && (
              <span className="text-orange-500 text-xs font-bold">
                ⏳ 반영 중
              </span>
            )}
          </div>
        </div>

        {/* 차트 스타일 전환 */}
        <div className="shrink-0 ml-2 mt-0.5 relative">
          <select
            value={style}
            onChange={(e) => changeStyle(e.target.value as WidgetStyle)}
            className="appearance-none bg-zinc-100 hover:bg-zinc-200 border-none text-zinc-700 text-xs font-bold rounded-xl pl-3 pr-8 py-2 focus:outline-none transition-colors cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2371717a%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.6rem top 50%",
              backgroundSize: "0.6rem auto",
            }}
            aria-label="잔액 요약 위젯 보기 방식 설정"
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label} {opt.short}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 게이지 바 */}
      <div className="px-5 pb-2">
        <div
          className="h-2.5 w-full rounded-full overflow-hidden relative"
          style={{ background: `${c.fill}22` }}
          role="progressbar"
          aria-valuenow={activePct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-all duration-700 absolute inset-y-0 left-0"
            style={{ width: `${displayPct}%`, background: `${c.fill}55` }}
          />
          <div
            className="h-full rounded-full transition-all duration-700 absolute inset-y-0 left-0"
            style={{
              width: `${activePct}%`,
              background: isSimOver ? "#ef4444" : c.fill,
            }}
          />
        </div>
      </div>

      {/* 시각화 영역 */}
      <div className="dm-chart-bg" style={{ background: c.light }}>
        {style === "pie" && (
          <PizzaChart
            percentage={activePct}
            displayBalance={simValue > 0 ? simBalance : displayBalance}
            pendingPct={
              simValue > 0
                ? 0
                : totalBudget > 0
                  ? Math.round((pendingDeduction / totalBudget) * 100)
                  : 0
            }
          />
        )}
        {style === "water" && (
          <WaterViz
            percentage={activePct}
            currentBalance={simValue > 0 ? simBalance : displayBalance}
            pendingPct={
              simValue > 0
                ? 0
                : totalBudget > 0
                  ? Math.round((pendingDeduction / totalBudget) * 100)
                  : 0
            }
          />
        )}
        {style === "text" && (
          <TextViz
            percentage={activePct}
            currentBalance={simValue > 0 ? simBalance : displayBalance}
          />
        )}
      </div>

      {/* 금액 시뮬레이션 */}
      <SimulationSection
        simAmount={simAmount}
        setSimAmount={setSimAmount}
        simValue={simValue}
        simBalance={simBalance}
        isSimOver={isSimOver}
      />

      {/* 상태 메시지 */}
      <div
        className={`px-5 py-3 flex items-center gap-3 ${c.bg} border-t ${c.border}`}
      >
        <span className="text-2xl shrink-0">{icon}</span>
        <p className="text-sm font-bold text-zinc-700 leading-snug break-keep">
          {statusMessage}
        </p>
      </div>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={receiptInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleInlineUpload(e, "receipt")}
      />
      <input
        ref={activityInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleInlineUpload(e, "activity")}
      />

      {/* 업로드 모달 */}
      {mounted &&
        createPortal(
          <>
            {uploadMode && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                  onClick={closeUploadSheet}
                  aria-hidden="true"
                />
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[500px] max-h-[90dvh] overflow-y-auto animate-fade-in-up">
                    <div className="px-5 pb-8 pt-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-zinc-900">
                          {uploadMode === "card"
                            ? "💳 카드 등록하기"
                            : uploadMode === "receipt"
                              ? "🧾 영수증 기록하기"
                              : "📸 활동 기록"}
                        </h2>
                        <button
                          onClick={closeUploadSheet}
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-base font-black transition-colors"
                        >
                          ✕
                        </button>
                      </div>

                      {uploadMode === "card" && (
                        <div className="mb-4">
                          <p className="mb-3 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-700">
                            실물 카드의 앞뒷면을 모두 등록해주세요.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="block cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePrimaryFile}
                              />
                              <div className="aspect-square rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 overflow-hidden flex items-center justify-center text-sm font-black text-zinc-500">
                                {uploadPreview ? (
                                  <img
                                    src={uploadPreview}
                                    alt="카드 앞면"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>카드 앞면 등록</span>
                                )}
                              </div>
                            </label>
                            <label className="block cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleSecondFile}
                              />
                              <div className="aspect-square rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 overflow-hidden flex items-center justify-center text-sm font-black text-zinc-500">
                                {secondPreview ? (
                                  <img
                                    src={secondPreview}
                                    alt="카드 뒷면"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>카드 뒷면 등록</span>
                                )}
                              </div>
                            </label>
                          </div>
                        </div>
                      )}

                      {uploadMode !== "card" && (
                        <>
                          {uploadPreview && (
                            <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 ring-1 ring-zinc-200">
                              <img
                                src={uploadPreview}
                                alt="미리보기"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div className="mb-4">
                            {secondPreview ? (
                              <div className="relative aspect-square rounded-2xl overflow-hidden ring-1 ring-zinc-200">
                                <img
                                  src={secondPreview}
                                  alt="추가 사진"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={() => {
                                    setSecondFile(null);
                                    setSecondPreview(null);
                                  }}
                                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
                                >
                                  ✕
                                </button>
                                <span className="absolute bottom-2 left-2 text-[10px] font-black text-white bg-black/40 px-2 py-0.5 rounded-full">
                                  {uploadMode === "receipt"
                                    ? "활동사진"
                                    : "영수증"}
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => secondFileRef.current?.click()}
                                className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-400 text-sm font-bold hover:border-zinc-400 hover:text-zinc-600 transition-all flex items-center justify-center gap-2"
                              >
                                <span>
                                  {uploadMode === "receipt" ? "📸" : "🧾"}
                                </span>
                                <span>
                                  {uploadMode === "receipt"
                                    ? "활동사진도 추가하기 (선택)"
                                    : "영수증도 추가하기 (선택)"}
                                </span>
                              </button>
                            )}
                            <input
                              ref={secondFileRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleSecondFile}
                            />
                          </div>

                          <div className="flex flex-col gap-3">
                            <ActivityCategoryPicker
                              value={uploadDescription}
                              onChange={setUploadDescription}
                            />
                            <div className="relative">
                              <input
                                type="number"
                                inputMode="numeric"
                                step={1000}
                                value={uploadAmount}
                                onChange={(e) =>
                                  setUploadAmount(e.target.value)
                                }
                                placeholder="0"
                                className="w-full p-4 pr-12 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-xl font-black text-right transition-all"
                                required
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">
                                원
                              </span>
                            </div>
                            <input
                              type="date"
                              value={uploadDate}
                              onChange={(e) => setUploadDate(e.target.value)}
                              className="w-full p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-bold transition-all"
                            />
                          </div>
                        </>
                      )}

                      {uploadToast && (
                        <div
                          className={`mt-3 p-3 rounded-xl text-sm font-bold animate-fade-in-up ${uploadToast.includes("안") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                        >
                          {uploadToast}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={
                          uploadSubmitting ||
                          (uploadMode === "card"
                            ? !uploadFile || !secondFile
                            : !uploadDescription || !uploadAmount)
                        }
                        onClick={handleInlineSubmit}
                        className="w-full mt-4 py-4 rounded-2xl bg-green-600 text-white font-black text-base active:scale-[0.98] transition-all disabled:bg-zinc-300"
                      >
                        {uploadSubmitting
                          ? "기록하는 중..."
                          : uploadMode === "card"
                            ? "카드 등록하기"
                            : "활동 기록하기"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>,
          document.body,
        )}
    </section>
  );
}
