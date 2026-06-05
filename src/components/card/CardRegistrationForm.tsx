'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCardRegistration, updateCardRotation } from '@/app/actions/cardRegistration'
import { compressImage } from '@/utils/image-compression'
import ImageLightbox from '@/components/ui/ImageLightbox'
import { extractStoragePath } from '@/utils/supabase/storage'

type CardSide = 'front' | 'back'

interface CardRegistrationItem {
  id: string
  created_at: string
  image_urls: string[]
  image_rotations?: any
}

export default function CardRegistrationForm({
  registrations,
}: {
  registrations: CardRegistrationItem[]
}) {
  const router = useRouter()
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)
  const [zoomInitialRotation, setZoomInitialRotation] = useState<number>(0)
  const [zoomCardId, setZoomCardId] = useState<string | null>(null)
  const [zoomRotations, setZoomRotations] = useState<Record<string, number>>({})

  const handleRotateChange = async (rotation: number) => {
    if (!zoomImageUrl || !zoomCardId) return
    try {
      const path = extractStoragePath(zoomImageUrl, 'card-photos') || zoomImageUrl
      const nextRotations = { ...zoomRotations, [path]: rotation }
      await updateCardRotation(zoomCardId, nextRotations)
      setZoomRotations(nextRotations)
      setZoomInitialRotation(rotation)
      router.refresh()
    } catch (err) {
      console.error('Failed to save card rotation:', err)
    }
  }

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
      const [compressedFront, compressedBack] = await Promise.all([
        compressImage(frontFile),
        compressImage(backFile),
      ])

      const formData = new FormData()
      formData.append('card_images', compressedFront)
      formData.append('card_images', compressedBack)
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
    <div className="flex flex-col gap-8">
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

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-black text-zinc-900">내가 등록했던 카드</h3>
          <p className="mt-0.5 text-sm font-medium text-zinc-500">등록한 카드 사진을 다시 확인할 수 있어요.</p>
        </div>

        {registrations.length === 0 ? (
          <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-bold text-zinc-400 ring-1 ring-zinc-200 shadow-sm">
            아직 등록한 카드가 없어요.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {registrations.map((item) => (
              <article key={item.id} className="rounded-[2rem] bg-white p-4 ring-1 ring-zinc-200 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-zinc-800">{item.created_at.slice(0, 10)} 등록</p>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
                    {item.image_urls.length}장
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {item.image_urls.map((url, index) => {
                    const path = extractStoragePath(url, 'card-photos') || ''
                    const rotation = (item.image_rotations as Record<string, number>)?.[path] ?? 0
                    return (
                      <button
                        key={`${item.id}-${index}`}
                        type="button"
                        onClick={() => {
                          setZoomImageUrl(url)
                          setZoomInitialRotation(rotation)
                          setZoomCardId(item.id)
                          setZoomRotations((item.image_rotations as any) ?? {})
                        }}
                        className="block aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 text-left transition-transform active:scale-[0.98]"
                      >
                        <img
                          src={url}
                          alt={`등록한 카드 ${index === 0 ? '앞면' : index === 1 ? '뒷면' : `${index + 1}번째 사진`}`}
                          style={{ transform: `rotate(${rotation}deg)` }}
                          className="h-full w-full object-contain bg-zinc-50"
                        />
                      </button>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {zoomImageUrl && (
        <ImageLightbox
          src={zoomImageUrl}
          initialRotation={zoomInitialRotation}
          showRotate={true}
          onRotateChange={handleRotateChange}
          onClose={() => {
            setZoomImageUrl(null)
            setZoomCardId(null)
            setZoomRotations({})
          }}
        />
      )}
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
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <div className="aspect-[4/3] overflow-hidden rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50">
        {preview ? (
          <img src={preview} alt={`${label} 미리보기`} className="h-full w-full object-contain bg-zinc-50" />
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
