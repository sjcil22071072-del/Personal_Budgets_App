"use client";

import { useEffect, useState } from "react";

export const ACTIVITY_CATEGORY_GROUPS = [
  {
    major: "신체적 건강",
    items: ["생활체육", "재활치료", "건강기능식품", "의약품", "비급여 의료비", "의료용 소모품", "기타"],
  },
  {
    major: "정신적 건강",
    items: ["검사, 진단 및 상담", "기타"],
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
      "기타",
    ],
  },
  {
    major: "보육 및 교육",
    items: ["지원 물품", "보육 및 교육 서비스", "기타"],
  },
  {
    major: "문화여가",
    items: ["문화관람 여가활동", "여행", "평생교육", "기타 물품서비스", "기타"],
  },
  {
    major: "일자리",
    items: ["전환교육", "직업교육", "기타"],
  },
  {
    major: "주거",
    items: ["주거환경 개선", "기타"],
  },
  {
    major: "바우처 유연화",
    items: ["발달재활", "기타"],
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
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");

  useEffect(() => {
    if (!value) {
      setIsCustomMode(false);
      setCustomText("");
      return;
    }
    const parts = value.split(" - ");
    if (parts.length === 2) {
      const [major, minor] = parts;
      const group = ACTIVITY_CATEGORY_GROUPS.find((g) => g.major === major);
      if (group) {
        setSelectedMajor(major);
        const isPredefined = group.items.includes(minor as any) && minor !== "기타";
        if (!isPredefined) {
          setIsCustomMode(true);
          setCustomText(minor === "기타" ? "" : minor);
        } else {
          setIsCustomMode(false);
          setCustomText("");
        }
      }
    } else {
      const group = ACTIVITY_CATEGORY_GROUPS.find((g) => g.major === value);
      if (group) {
        setSelectedMajor(value);
        setIsCustomMode(false);
        setCustomText("");
      }
    }
  }, [value]);

  const currentGroup =
    ACTIVITY_CATEGORY_GROUPS.find((group) => group.major === selectedMajor) ??
    ACTIVITY_CATEGORY_GROUPS[0];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    setIsCustomMode(false);
                    setCustomText("");
                    onChange("");
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
              const active = isCustomMode ? item === "기타" : optionValue === value;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    if (item === "기타") {
                      setIsCustomMode(true);
                      setCustomText("");
                      onChange(`${currentGroup.major} - `);
                    } else {
                      setIsCustomMode(false);
                      setCustomText("");
                      onChange(optionValue);
                    }
                  }}
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

      {isCustomMode && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200 animate-fade-in-up">
          <label className="block text-xs font-black text-zinc-500 mb-2">
            상세 분류 직접 입력
          </label>
          <input
            type="text"
            placeholder="상세 내용을 입력해 주세요 (예: 간식 구입, 보조배터리)"
            value={customText}
            onChange={(e) => {
              const text = e.target.value;
              setCustomText(text);
              onChange(`${selectedMajor} - ${text}`);
            }}
            className="w-full p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm font-bold transition-all text-zinc-900"
            required
          />
        </div>
      )}
    </div>
  );
}
