'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCardRegistration } from '@/app/actions/cardRegistration'

type CardSide = 'front' | 'back'

export default function CardRegistrationForm() {
  const router = useRouter()
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function setImage(side: CardSide, file: File | null) {
    if (!file) return
    if (side === 'front') setFrontFile(file)
    if (side === 'back') setBackFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      if (side === 'front') setFrontPreview(reader.result as string)
      if (side === 'back') setBackPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!frontFile || !backFile) {
      setMessage({ type: 'error', text: '실물 카드의 앞뒷면을 모두 등록해주세요.' })
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('card_images', frontFile)
      formData.append('card_images', backFile)
      const result = await createCardRegistration(formData)

      if (result.success) {
        setMessage({ type: 'success', text: '카드 사진이 등록되었습니다.' })
        setFrontFile(null)
        setBackFile(null)
        setFrontPreview(null)
        setBackPreview(null)
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error || '카드 등록에 실패했습니다. 다시 시도해주세요.' })
      }
    } catch {
      setMessage({ type: 'error', text: '카드 등록에 실패했습니다. 다시 시도해주세요.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[2rem] bg-white p-5 ring-1 ring-zinc-200 shadow-sm">
        <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-700">
          실물 카드의 앞뒷면을 모두 등록해주세요.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CardImagePicker
            label="카드 앞면"
            preview={frontPreview}
            onChange={(file) => setImage('front', file)}
          />
          <CardImagePicker
            label="카드 뒷면"
            preview={backPreview}
            onChange={(file) => setImage('back', file)}
          />
        </div>

        {message && (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-bold ${
            message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="button"
          disabled={submitting || !frontFile || !backFile}
          onClick={handleSubmit}
          className="mt-5 w-full rounded-2xl bg-zinc-900 py-4 text-base font-black text-white transition-all active:scale-[0.98] disabled:bg-zinc-300"
        >
          {submitting ? '등록하는 중...' : '카드 등록하기'}
        </button>
      </div>
    </div>
  )
}

function CardImagePicker({
  label,
  preview,
  onChange,
}: {
  label: string
  preview: string | null
  onChange: (file: File | null) => void
}) {
  return (
    <label className="block cursor-pointer">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <div className="aspect-[4/3] overflow-hidden rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50">
        {preview ? (
          <img src={preview} alt={`${label} 미리보기`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
            <span className="text-4xl">💳</span>
            <span className="text-sm font-black text-zinc-600">{label} 등록</span>
          </div>
        )}
      </div>
    </label>
  )
}
