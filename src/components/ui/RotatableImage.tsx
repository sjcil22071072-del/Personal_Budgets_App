'use client'

import { useEffect, useState, useRef } from 'react'
import { extractStoragePath } from '@/utils/supabase/storage'

interface RotatableImageProps {
  src: string
  alt?: string
  rotation: number
  maxHeight?: number
  onClick?: () => void
  onDelete?: () => void
  deleting?: boolean
  bucket?: string
}

export default function RotatableImage({
  src,
  alt,
  rotation,
  maxHeight = 500,
  onClick,
  onDelete,
  deleting,
  bucket
}: RotatableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [containerWidth, setContainerWidth] = useState(0)
  const [displayedSrc, setDisplayedSrc] = useState(src)

  // src가 변경될 때, 동일한 파일(스토리지 경로가 같음)이면 기존 URL(displayedSrc)을 유지하여
  // Signed URL 토큰 변경으로 인한 하얀 화면 깜빡임 및 재다운로드를 원천 차단합니다.
  useEffect(() => {
    if (!bucket) {
      setDisplayedSrc(src)
      return
    }

    const prevPath = extractStoragePath(displayedSrc, bucket)
    const newPath = extractStoragePath(src, bucket)

    if (prevPath !== newPath || !newPath) {
      setDisplayedSrc(src)
    }
  }, [src, bucket, displayedSrc])

  const handleLoad = () => {
    if (imgRef.current) {
      setNaturalSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight
      })
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const parent = container.parentElement || container

    const updateWidth = () => {
      let width = parent.offsetWidth
      // 부모의 offsetWidth가 0인 경우, 조상 엘리먼트를 거슬러 올라가며 0보다 큰 너비를 찾습니다.
      if (width === 0 && container) {
        let current: HTMLElement | null = container
        while (current && width === 0) {
          width = current.offsetWidth
          current = current.parentElement
        }
      }
      // 그래도 0이면 window.innerWidth 또는 기본값(320)을 fallback으로 취합니다.
      if (width === 0) {
        width = typeof window !== 'undefined' ? window.innerWidth : 320
      }
      setContainerWidth(width)
    }

    updateWidth()
    const observer = new ResizeObserver(() => {
      updateWidth()
    })
    observer.observe(parent)

    return () => {
      observer.disconnect()
    }
  }, [])

  // 이미지 로딩 및 naturalWidth가 0보다 커질 때까지 50ms 주기로 재시도하며 관찰하여 naturalSize를 확실하게 세팅합니다.
  // 무한 루프 크래시(예: 로딩 실패 시 CPU 100% 점유로 브라우저가 하얗게 굳어버리는 현상)를 방지하기 위해 최대 100회(5초)로 제한합니다.
  useEffect(() => {
    let checkTimeout: any
    let attempts = 0
    const maxAttempts = 100

    const checkSize = () => {
      if (imgRef.current) {
        if (imgRef.current.complete && imgRef.current.naturalWidth > 0) {
          setNaturalSize({
            width: imgRef.current.naturalWidth,
            height: imgRef.current.naturalHeight
          })
        } else if (attempts < maxAttempts) {
          attempts++
          checkTimeout = setTimeout(checkSize, 50)
        }
      }
    }

    checkSize()

    return () => {
      if (checkTimeout) clearTimeout(checkTimeout)
    }
  }, [displayedSrc])

  const isRotated = rotation === 90 || rotation === 270

  let imgStyle: React.CSSProperties = {}
  let containerStyle: React.CSSProperties = {}

  if (isRotated) {
    if (naturalSize.width > 0 && naturalSize.height > 0 && containerWidth > 0) {
      const parentWidth = containerWidth
      
      // Calculate unrotated layout box size (constrained by maxWidth/maxHeight)
      const scale_normal = Math.min(parentWidth / naturalSize.width, maxHeight / naturalSize.height, 1)
      const W_layout = Math.max(naturalSize.width * scale_normal, 1)
      const H_layout = Math.max(naturalSize.height * scale_normal, 1)

      // Calculate rotation scale to fit rotated box (H_layout x W_layout) inside (parentWidth x maxHeight)
      const scaleX = parentWidth / H_layout
      const scaleY = maxHeight / W_layout
      const rawScale = Math.min(scaleX, scaleY, 1)
      const scale = isNaN(rawScale) ? 1 : rawScale

      imgStyle = {
        position: 'relative',
        width: `${W_layout}px`,
        height: `${H_layout}px`,
        transform: `rotate(${rotation}deg) scale(${scale})`,
        objectFit: 'contain',
        maxWidth: 'none',
        maxHeight: 'none'
      }
      containerStyle.height = `${W_layout * scale}px`
    } else {
      // Before image loaded / measuring container size
      imgStyle = {
        transform: `rotate(${rotation}deg)`,
        maxWidth: '100%',
        maxHeight: `${maxHeight}px`,
        objectFit: 'contain'
      }
      containerStyle.height = `${maxHeight}px`
    }
  } else {
    // Not rotated (0 or 180 deg)
    imgStyle = {
      transform: `rotate(${rotation}deg)`,
      maxWidth: '100%',
      maxHeight: `${maxHeight}px`,
      objectFit: 'contain',
      width: 'auto',
      height: 'auto',
      display: 'block'
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full flex items-center justify-center"
      style={containerStyle}
    >
      <img
        ref={imgRef}
        src={displayedSrc}
        alt={alt}
        onLoad={handleLoad}
        style={imgStyle}
        className="rounded-lg mx-auto block cursor-pointer hover:opacity-90 transition-opacity"
        onClick={onClick}
      />
      {onDelete && (
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 z-10"
        >
          {deleting ? '삭제 중...' : '🗑️ 삭제'}
        </button>
      )}
    </div>
  )
}
