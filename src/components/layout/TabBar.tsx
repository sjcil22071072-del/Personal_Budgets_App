"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import type { UserRole } from '@/types/database'

export function TabBar() {
  const pathname = usePathname()
  const { user, supabase } = useAuth()
  const [role, setRole] = useState<UserRole>('participant')

  useEffect(() => {
    if (!user) return

    async function fetchRole() {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single()

      if (profile?.role === 'admin' || profile?.role === 'participant') {
        setRole(profile.role)
      }
    }

    fetchRole()
  }, [user, supabase])

  if (pathname === '/login' || pathname.startsWith('/supporter') || pathname.startsWith('/admin')) {
    return null
  }

  const participantTabs = [
    { name: '홈', href: '/', icon: 'H' },
    { name: '영수증', href: '/receipt', icon: 'R' },
    { name: '더보기', href: '/more', icon: 'M' },
  ]

  const adminTabs = [
    { name: '당사자', href: '/admin/participants', icon: 'P' },
    { name: '내역', href: '/supporter/transactions', icon: 'T' },
    { name: '더보기', href: '/more', icon: 'M' },
  ]

  const tabs = role === 'admin' ? adminTabs : participantTabs

  return (
    <nav aria-label="메인 내비게이션" className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white pb-safe">
      <div className="flex h-16 items-center justify-around px-2 pb-2 pt-2 sm:h-20 sm:pb-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href ||
            (tab.href !== '/' && pathname.startsWith(tab.href))
          return (
            <Link
              key={tab.name}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-[44px] min-w-[64px] flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-primary' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <span className={`text-xl font-black sm:text-2xl ${isActive ? 'scale-110' : ''}`}>{tab.icon}</span>
              <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
