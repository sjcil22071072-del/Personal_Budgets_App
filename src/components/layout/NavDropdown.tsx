/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type NavItem = {
  href: string
  icon: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: '🏠', label: '홈' },
  { href: '/receipt', icon: '🧾', label: '활동 기록하기' },
  { href: '/card-registration', icon: '💳', label: '카드 등록하기' },
  { href: '/family-registration', icon: '📄', label: '가족관계증명서' },
  { href: '/calendar', icon: '📅', label: '달력' },
  { href: '/gallery', icon: '🖼️', label: '사진 모아보기' },
]

export default function NavDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setIsOpen(false)
    router.push('/login')
    router.refresh()
  }

  const drawer = mounted && isOpen ? createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40"
        style={{ zIndex: 99998 }}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <div
        className="fixed top-0 right-0 bottom-0 w-64 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        style={{ zIndex: 99999 }}
        role="dialog"
        aria-label="페이지 이동 메뉴"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <span className="text-sm font-black text-zinc-400 uppercase tracking-widest">메뉴</span>
          <button
            onClick={() => setIsOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-colors"
            aria-label="메뉴 닫기"
          >
            <span className="text-zinc-600 text-sm font-black leading-none">×</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors ${
                  isActive ? 'bg-zinc-50' : ''
                }`}
              >
                <span className="text-2xl w-8 text-center">{item.icon}</span>
                <span
                  className={`text-sm font-bold flex-1 ${
                    isActive ? 'text-zinc-900' : 'text-zinc-600'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-zinc-100 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl bg-red-50 px-4 py-4 text-left font-black text-red-600 transition-colors hover:bg-red-100 active:scale-[0.98]"
          >
            <span className="text-2xl w-8 text-center">↩</span>
            <span className="text-sm">로그아웃</span>
          </button>
        </div>
      </div>
    </>,
    document.body
  ) : null

  return (
    <>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-all active:scale-95"
        aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="text-zinc-600 text-base font-black leading-none select-none">
          {isOpen ? '×' : '☰'}
        </span>
      </button>

      {drawer}
    </>
  )
}
