'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveFamilyRegistration, FamilyRegistration } from '@/app/actions/familyRegistration'

export default function FamilyRegistrationForm({
  initialRegistration,
}: {
  initialRegistration: FamilyRegistration | null
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleFileChange(selectedFile: File | null) {
    if (!selectedFile) return
    setFile(selectedFile)

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setMessage({ type: 'error', text: '가족관계증명서 사진을 선택해 주세요.' })
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('family_relation_photo', file)
      const result = await saveFamilyRegistration(formData)

      if (result.success) {
        setMessage({ type: 'success', text: isEditing ? '가족관계증명서가 수정되었습니다.' : '가족관계증명서가 성공적으로 등록되었습니다.' })
        setFile(null)
        setPreview(null)
        setIsEditing(false)
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error || '저장에 실패했습니다. 다시 시도해주세요.' })
      }
    } catch {
      setMessage({ type: 'error', text: '저장에 실패했습니다. 다시 시도해주세요.' })
    } finally {
      setSubmitting(false)
    }
  }

  const hasRegistration = !!initialRegistration && !isEditing

  return (
    <div className="flex flex-col gap-6">
      {/* 등록 및 수정 폼 */}
      {!hasRegistration ? (
        <form onSubmit={handleSubmit} className="rounded-[2rem] bg-white p-5 ring-1 ring-zinc-200 shadow-sm space-y-4">
          <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-700">
            {isEditing ? '수정할 가족관계증명서 사진을 새로 선택해주세요.' : '본인의 가족관계증명서 사진을 등록해주세요.'}
          </p>

          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <div className="aspect-[4/3] overflow-hidden rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center">
              {preview ? (
                <img src={preview} alt="증명서 미리보기" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-zinc-400">
                  <span className="text-4xl">📄</span>
                  <span className="text-sm font-black text-zinc-600">증명서 사진 등록</span>
                </div>
              )}
            </div>
          </label>

          {message && (
            <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${
              message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  setFile(null)
                  setPreview(null)
                  setMessage(null)
                }}
                className="flex-1 rounded-2xl border-2 border-zinc-200 py-4 text-base font-black text-zinc-600 transition-all hover:bg-zinc-50 active:scale-[0.98]"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || !file}
              className="flex-2 w-full rounded-2xl bg-zinc-900 py-4 text-base font-black text-white transition-all active:scale-[0.98] disabled:bg-zinc-300"
            >
              {submitting ? '저장 중...' : isEditing ? '증명서 수정하기' : '가족관계증명서 등록하기'}
            </button>
          </div>
        </form>
      ) : null}

      {/* 등록 정보 확인 및 수정 진입 버튼 */}
      {initialRegistration ? (
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-base font-black text-zinc-900">등록된 가족관계증명서</h3>
            <p className="mt-0.5 text-sm font-medium text-zinc-500">등록한 가족관계증명서를 확인하고 수정할 수 있습니다.</p>
          </div>

          <article className="rounded-[2rem] bg-white p-5 ring-1 ring-zinc-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3">
              <div>
                <p className="text-sm font-black text-zinc-800">등록 정보</p>
                <p className="text-xs text-zinc-400 mt-0.5">등록일: {new Date(initialRegistration.created_at).toLocaleDateString()}</p>
              </div>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true)
                    setMessage(null)
                  }}
                  className="rounded-xl bg-zinc-100 hover:bg-zinc-200 px-4 py-2 text-xs font-black text-zinc-700 transition-all active:scale-95"
                >
                  ✏️ 증명서 수정
                </button>
              )}
            </div>

            <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 relative group">
              <a
                href={initialRegistration.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-full"
              >
                <img
                  src={initialRegistration.image_url}
                  alt="가족관계증명서"
                  className="h-full w-full object-cover group-hover:opacity-90 transition-opacity"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-bold gap-1">
                  🔍 크게 보기
                </div>
              </a>
            </div>
          </article>
        </section>
      ) : (
        !isEditing && !file && (
          <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-bold text-zinc-400 ring-1 ring-zinc-200 shadow-sm">
            아직 등록된 가족관계증명서가 없습니다. 위의 등록 창에서 가족관계증명서를 등록해 주세요.
          </div>
        )
      )}
    </div>
  )
}
