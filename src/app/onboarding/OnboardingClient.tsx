'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import SelfCheckFeedback from '@/components/ui/SelfCheckFeedback'

interface Props {
  userId: string
  userEmail: string
  userName: string
  userAvatar: string
}

type Step = 'profile' | 'complete'

export default function OnboardingClient({ userId, userEmail, userName, userAvatar }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('profile')
  const [name, setName] = useState(userName)
  const [bio, setBio] = useState('')
  const [avatarPreview] = useState(userAvatar)
  const [budgetType, setBudgetType] = useState<'single' | 'multiple'>('single')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleComplete = async () => {
    if (!name.trim()) {
      setError('이름을 입력해 주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'participant',
          name: name.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarPreview || null,
          onboarding_completed: true,
        })
        .eq('id', userId)

      if (profileError) throw profileError

      const { error: partError } = await supabase
        .from('participants')
        .upsert({
          id: userId,
          funding_source_count: budgetType === 'multiple' ? 2 : 1,
          assigned_supporter_id: null,
        })

      if (partError) throw partError

      setStep('complete')
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {step === 'profile' && (
          <div className="rounded-[2rem] bg-white p-8 shadow-xl ring-1 ring-zinc-200">
            <div className="mb-8 text-center">
              <span className="mb-4 block text-5xl">시작</span>
              <h1 className="mb-2 text-2xl font-black text-zinc-900">반가워요!</h1>
              <p className="font-medium text-zinc-500">당사자 계정 정보를 설정합니다.</p>
              <p className="mt-1 text-xs font-bold text-zinc-400">{userEmail}</p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 ring-1 ring-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-4xl ring-4 ring-zinc-200">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="프로필" className="h-full w-full object-cover" />
                  ) : (
                    <span>{(name || '?')[0]}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="ml-1 text-sm font-bold text-zinc-500">이름 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력해 주세요."
                  className="w-full rounded-2xl bg-zinc-50 p-4 text-lg font-bold outline-none ring-1 ring-zinc-200 transition-all focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="ml-1 text-sm font-bold text-zinc-500">예산 종류</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBudgetType('single')}
                    className={`rounded-2xl p-4 text-center ring-2 transition-all ${
                      budgetType === 'single'
                        ? 'bg-primary/5 font-black text-primary ring-primary'
                        : 'text-zinc-500 ring-zinc-200 hover:ring-zinc-300'
                    }`}
                  >
                    <span className="text-sm font-bold">자원 하나</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBudgetType('multiple')}
                    className={`rounded-2xl p-4 text-center ring-2 transition-all ${
                      budgetType === 'multiple'
                        ? 'bg-primary/5 font-black text-primary ring-primary'
                        : 'text-zinc-500 ring-zinc-200 hover:ring-zinc-300'
                    }`}
                  >
                    <span className="text-sm font-bold">두 개 이상</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="ml-1 text-sm font-bold text-zinc-500">나를 표현하는 한 마디 (선택)</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="예: 여행을 좋아해요!"
                  className="w-full rounded-2xl bg-zinc-50 p-4 text-base font-medium outline-none ring-1 ring-zinc-200 transition-all focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={handleComplete}
                disabled={loading || !name.trim()}
                className="mt-2 w-full rounded-3xl bg-zinc-900 py-5 text-xl font-black text-white shadow-xl transition-all active:scale-95 disabled:bg-zinc-300"
              >
                {loading ? '설정 중...' : '시작하기'}
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="flex flex-col items-center gap-6 rounded-[2.5rem] bg-white p-8 shadow-xl ring-1 ring-zinc-200">
            <h2 className="text-center text-2xl font-black text-zinc-900">
              준비가 모두 끝났어요!
            </h2>
            <SelfCheckFeedback
              question="시작하기 설정이 쉬웠나요?"
              context="onboarding"
              onComplete={() => {
                router.push('/')
                router.refresh()
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
