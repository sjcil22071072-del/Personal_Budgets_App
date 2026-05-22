"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createTransaction } from "@/app/actions/transaction";
import { EasyTerm } from "@/components/ui/EasyTerm";
import ActivityCategoryPicker, {
  getActivityMajor,
} from "@/components/transactions/ActivityCategoryPicker";

interface FundingSource {
  id: string;
  name: string;
}

export default function ReceiptUploadForm({
  participantId,
  fundingSources,
}: {
  participantId: string;
  fundingSources: FundingSource[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // 영수증 사진 상태 (최대 5장)
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [receiptPreviews, setReceiptPreviews] = useState<string[]>([]);

  // 증빙서류 상태 (최대 5장)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);

  // 활동 사진 상태 (최대 5장)
  const [activityFiles, setActivityFiles] = useState<File[]>([]);
  const [activityPreviews, setActivityPreviews] = useState<string[]>([]);

  // 폼 필드 상태
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (!newFiles.length) return;
    const remaining = 5 - receiptFiles.length;
    const toAdd = newFiles.slice(0, remaining);
    setReceiptFiles((prev) => [...prev, ...toAdd]);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemoveReceipt = (idx: number) => {
    setReceiptFiles((prev) => prev.filter((_, i) => i !== idx));
    setReceiptPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (!newFiles.length) return;
    const remaining = 5 - evidenceFiles.length;
    const toAdd = newFiles.slice(0, remaining);
    setEvidenceFiles((prev) => [...prev, ...toAdd]);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidencePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemoveEvidence = (idx: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== idx));
    setEvidencePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleActivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (!newFiles.length) return;
    const remaining = 5 - activityFiles.length;
    const toAdd = newFiles.slice(0, remaining);
    setActivityFiles((prev) => [...prev, ...toAdd]);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setActivityPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemoveActivity = (idx: number) => {
    setActivityFiles((prev) => prev.filter((_, i) => i !== idx));
    setActivityPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // 카테고리 유효성 검사 (대분류와 중분류 모두 선택 여부)
    const parts = description.split(" - ");
    if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
      setToast({
        type: "error",
        message: "대분류와 중분류를 모두 선택하거나 직접 입력해 주세요.",
      });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("participant_id", participantId);
      formData.set("date", date);
      formData.set("description", description);
      formData.set("category", getActivityMajor(description));
      formData.set("amount", amount);

      // 파일들 주입
      receiptFiles.forEach((file, i) => formData.set(`receipt_${i}`, file));
      evidenceFiles.forEach((file, i) => formData.set(`evidence_${i}`, file));
      activityFiles.forEach((file, i) => formData.set(`activity_${i}`, file));

      const result = await createTransaction(formData);
      if (result.success) {
        setShowFeedback(true);
      }
    } catch (error) {
      console.error(error);
      setToast({
        type: "error",
        message: "저장이 안 됐어요. 다시 눌러주세요.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* 1. 영수증 사진 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-500 ml-1">
            🧾 <EasyTerm formal="영수증 사진" easy="물건 산 종이 사진" />{" "}
            <span className="text-zinc-300 font-medium">(선택, 최대 5장)</span>
          </label>
          {receiptFiles.length < 5 && (
            <label className="text-xs font-bold text-blue-600 cursor-pointer">
              + 추가
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleReceiptChange}
              />
            </label>
          )}
        </div>
        {receiptPreviews.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {receiptPreviews.map((src, i) => (
              <div
                key={i}
                className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-100"
              >
                <img
                  src={src}
                  alt={`영수증 ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveReceipt(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
            {receiptFiles.length < 5 && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-zinc-400 transition-colors">
                <span className="text-2xl">📸</span>
                <span className="text-xs text-zinc-400 font-bold">추가</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleReceiptChange}
                />
              </label>
            )}
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 cursor-pointer hover:border-zinc-300 transition-colors active:scale-[0.98]">
            <span className="text-2xl">🧾</span>
            <span className="text-sm font-bold text-zinc-500">
              영수증 사진 선택 (최대 5장)
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleReceiptChange}
            />
          </label>
        )}
      </div>

      {/* 2. 증빙서류 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-500 ml-1">
            📋 증빙서류{" "}
            <span className="text-zinc-300 font-medium">(선택, 최대 5장)</span>
          </label>
          {evidenceFiles.length < 5 && (
            <label className="text-xs font-bold text-blue-600 cursor-pointer">
              + 추가
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={handleEvidenceChange}
              />
            </label>
          )}
        </div>
        {evidencePreviews.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {evidencePreviews.map((src, i) => (
              <div
                key={i}
                className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-100"
              >
                <img
                  src={src}
                  alt={`증빙 ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveEvidence(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
            {evidenceFiles.length < 5 && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-zinc-400 transition-colors">
                <span className="text-2xl">📎</span>
                <span className="text-xs text-zinc-400 font-bold">추가</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleEvidenceChange}
                />
              </label>
            )}
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 cursor-pointer hover:border-zinc-300 transition-colors active:scale-[0.98]">
            <span className="text-2xl">📋</span>
            <span className="text-sm font-bold text-zinc-500">
              증빙서류 선택 (최대 5장)
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleEvidenceChange}
            />
          </label>
        )}
      </div>

      {/* 3. 활동 사진 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-500 ml-1">
            📸 <EasyTerm formal="활동 사진" easy="오늘 한 일 사진" />{" "}
            <span className="text-zinc-300 font-medium">(선택, 최대 5장)</span>
          </label>
          {activityFiles.length < 5 && (
            <label className="text-xs font-bold text-blue-600 cursor-pointer">
              + 추가
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleActivityChange}
              />
            </label>
          )}
        </div>
        {activityPreviews.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {activityPreviews.map((src, i) => (
              <div
                key={i}
                className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-100"
              >
                <img
                  src={src}
                  alt={`활동 ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveActivity(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
            {activityFiles.length < 5 && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-zinc-400 transition-colors">
                <span className="text-2xl">📸</span>
                <span className="text-xs text-zinc-400 font-bold">추가</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleActivityChange}
                />
              </label>
            )}
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 cursor-pointer hover:border-zinc-300 transition-colors active:scale-[0.98]">
            <span className="text-2xl">📷</span>
            <span className="text-sm font-bold text-zinc-500">
              활동 사진 선택 (최대 5장)
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleActivityChange}
            />
          </label>
        )}
      </div>

      {/* 활동 내용 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">
          📝 무엇을 했나요?
        </label>
        <input type="hidden" name="description" value={description} required />
        <ActivityCategoryPicker
          value={description}
          onChange={setDescription}
        />
      </div>

      {/* 금액 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">
          💰 얼마인가요?
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full p-4 pr-12 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-2xl font-black text-right transition-all"
            required
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">
            원
          </span>
        </div>
      </div>

      {/* 재원 선택 */}
      {fundingSources.length <= 1 ? (
        <input
          type="hidden"
          name="funding_source_id"
          value={fundingSources[0]?.id ?? ""}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-zinc-500 ml-1">
            💳 <EasyTerm formal="결제 수단" easy="어떤 돈을 썼나요" />?
          </label>
          <select
            name="funding_source_id"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold appearance-none"
            required
          >
            {fundingSources.map((fs) => (
              <option key={fs.id} value={fs.id}>
                {fs.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 날짜 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">
          📅 언제인가요?
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
        />
      </div>

      {toast && toast.type === "error" && (
        <div className="p-4 rounded-2xl text-sm font-bold animate-fade-in-up bg-red-50 text-red-700 ring-1 ring-red-200">
          <div className="flex justify-between items-center">
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-lg ml-2"
              aria-label="알림 닫기"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-5 rounded-3xl bg-green-600 text-white text-xl font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all mt-4"
      >
        {loading ? "등록 중..." : "활동 기록하기"}
      </button>

      {/* 성공 오버레이 */}
      {showFeedback &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center gap-4 animate-fade-in-up">
              <span className="text-5xl">✅</span>
              <p className="text-xl font-black text-zinc-900">
                활동을 기록했어요!
              </p>
              <button
                onClick={() => {
                  setShowFeedback(false);
                  router.push("/");
                  router.refresh();
                }}
                className="w-full py-4 rounded-2xl bg-green-600 text-white font-black text-base active:scale-[0.98] transition-all"
              >
                확인
              </button>
            </div>
          </div>,
          document.body,
        )}
    </form>
  );
}
