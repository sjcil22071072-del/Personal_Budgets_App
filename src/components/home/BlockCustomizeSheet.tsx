'use client'

import { useEffect, useRef } from 'react'
import { useAccessibility } from '@/hooks/useAccessibility'

interface BlockCustomizeSheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function BlockCustomizeSheet({
  isOpen,
  onClose,
}: BlockCustomizeSheetProps) {
  const {
    highContrast,
    setHighContrast,
    darkMode,
    setDarkMode,
    yellowBg,
    setYellowBg,
    easyTerms,
    setEasyTerms,
    fontSize,
    setFontSize,
  } = useAccessibility()
  const sheetTouchStartY = useRef(0)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:max-w-[600px] lg:w-full ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="화면 설정"
      >
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab"
          onTouchStart={e => { sheetTouchStartY.current = e.touches[0].clientY }}
          onTouchMove={e => {
            const delta = e.touches[0].clientY - sheetTouchStartY.current
            if (delta > 50) onClose()
          }}
        >
          <div className="w-10 h-1 rounded-full bg-zinc-200" />
        </div>

        <div className="flex items-center justify-between px-6 pt-3 pb-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-lg font-black text-zinc-900 leading-tight">화면 설정</h2>
            <p className="text-xs text-zinc-400 mt-0.5">글씨 크기와 보기 방식을 바꿀 수 있어요.</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-black text-sm active:scale-95 transition-transform"
          >
            닫기
          </button>
        </div>

        <div
          className="px-6 pb-10 pt-4 max-h-[72vh] overflow-y-auto"
          style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          <div className="mb-6">
            <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">화면 설정</p>

            <div className="bg-white rounded-2xl ring-1 ring-zinc-100 p-3.5 mb-3 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-700">글씨 크기</span>
                <span className="text-xs text-zinc-400">화면의 글씨 크기를 조절해요</span>
              </div>
              <div className="flex bg-zinc-100 rounded-xl p-1 shrink-0">
                {(['normal', 'large', 'huge'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    aria-label={`글씨 크기: ${size === 'normal' ? '보통' : size === 'large' ? '크게' : '아주 크게'}`}
                    className={`w-10 h-8 flex items-center justify-center rounded-lg font-bold transition-all ${
                      fontSize === size ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <span className={size === 'normal' ? 'text-sm' : size === 'large' ? 'text-lg' : 'text-xl'}>가</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-0 bg-white rounded-2xl ring-1 ring-zinc-100 overflow-hidden">
              {[
                { key: 'highContrast', label: '글씨가 더 잘 보여요', desc: '글씨와 배경의 대비를 높여요', value: highContrast, set: setHighContrast, color: 'bg-zinc-900' },
                { key: 'darkMode', label: '다크 모드', desc: '눈부심을 줄여요', value: darkMode, set: setDarkMode, color: 'bg-indigo-600' },
                { key: 'yellowBg', label: '노란 배경', desc: '읽기 편하게 노란 배경으로 바꿔요', value: yellowBg, set: setYellowBg, color: 'bg-yellow-400' },
                { key: 'easyTerms', label: '쉬운 말 모드', desc: '어려운 말을 쉽게 바꿔요', value: easyTerms, set: setEasyTerms, color: 'bg-blue-600' },
              ].map(({ key, label, desc, value, set, color }, idx, arr) => (
                <div
                  key={key}
                  className={`flex items-center justify-between px-4 py-3.5 ${idx < arr.length - 1 ? 'border-b border-zinc-100' : ''}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-700">{label}</span>
                    <span className="text-xs text-zinc-400">{desc}</span>
                  </div>
                  <button
                    onClick={() => set(!value)}
                    className={`relative w-12 h-7 rounded-full transition-all duration-300 ${value ? color : 'bg-zinc-200'}`}
                    role="switch"
                    aria-checked={value}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${value ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
