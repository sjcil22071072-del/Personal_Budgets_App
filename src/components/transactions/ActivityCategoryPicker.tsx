"use client";

import { useEffect, useState } from "react";

export const ACTIVITY_CATEGORY_GROUPS = [
  {
    major: "신체적 건강",
    items: ["생활체육", "재활치료", "건강기능식품", "의약품", "비급여 의료비", "의료용 소모품"],
  },
  {
    major: "정신적 건강",
    items: ["검사, 진단 및 상담"],
  },
  {
    major: "일상생활",
    items: [
      "지역사회 참여 활동",
      "장애인 보조기기",
      "장애인 콜택시",
      "일상생활 용품 구입",
      "대중교통비 및 유류비",
      "공공영역 돌봄 서비스",
      "기타 일상생활 지원 서비스",
    ],
  },
  {
    major: "보육 및 교육",
    items: ["지원 물품", "보육 및 교육 서비스"],
  },
  {
    major: "문화여가",
    items: ["문화관람 여가활동", "여행", "평생교육", "기타 물품서비스"],
  },
  {
    major: "일자리",
    items: ["전환교육", "직업교육"],
  },
  {
    major: "주거",
    items: ["주거환경 개선"],
  },
  {
    major: "바우처 유연화",
    items: ["발달재활"],
  },
] as const;

export function getActivityMajor(value: string) {
  return value.split(" - ")[0] || "";
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function ActivityCategoryPicker({ value, onChange, className = "" }: Props) {
  const majorFromValue = getActivityMajor(value);
  const valueMajor = ACTIVITY_CATEGORY_GROUPS.some((group) => group.major === majorFromValue)
    ? majorFromValue
    : ACTIVITY_CATEGORY_GROUPS[0].major;
  const [selectedMajor, setSelectedMajor] = useState(valueMajor);

  useEffect(() => {
    if (value) setSelectedMajor(valueMajor);
  }, [value, valueMajor]);

  const currentGroup =
    ACTIVITY_CATEGORY_GROUPS.find((group) => group.major === selectedMajor) ??
    ACTIVITY_CATEGORY_GROUPS[0];

  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`}>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <div className="border-b border-zinc-200 px-4 py-3 text-xs font-black text-zinc-500">
          대분류
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {ACTIVITY_CATEGORY_GROUPS.map((group) => {
            const active = group.major === selectedMajor;
            return (
              <button
                key={group.major}
                type="button"
                onClick={() => {
                  setSelectedMajor(group.major);
                  if (group.major !== selectedMajor) onChange("");
                }}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors ${
                  active
                    ? "bg-violet-100 text-violet-900"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {group.major}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <div className="border-b border-zinc-200 px-4 py-3 text-xs font-black text-zinc-500">
          중분류
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {currentGroup.items.map((item) => {
            const optionValue = `${currentGroup.major} - ${item}`;
            const active = optionValue === value;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onChange(optionValue)}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors ${
                  active
                    ? "bg-violet-100 text-violet-900"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
