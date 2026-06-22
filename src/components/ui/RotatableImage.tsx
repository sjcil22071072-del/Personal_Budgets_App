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

    if (imgRef.current?.complete) {
      handleLoad()
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  // In case the image was already cached and onLoad doesn't fire
  useEffect(() => {
    if (imgRef.current?.complete) {
      handleLoad()
    }
  }, [displayedSrc])

  const isRotated = rotation === 90 || rotation === 270

  let imgStyle: React.CSSProperties = {}
  let containerStyle: React.CSSProperties = {}

  if (isRotated) {
    if (naturalSize.width > 0 && naturalSize.height > 0 && containerWidth > 0) {
      const parentWidth = containerWidth
      
      // 회전된 상태의 겉보기 종횡비 (H / W)
      const aspect = naturalSize.height / naturalSize.width
      // 컨테이너 제한 종횡비
      const R = maxHeight / parentWidth

      let W_target = 0
      let H_target = 0

      if (aspect >= R) {
        // 세로가 꽉 차는 레이아웃
        H_target = maxHeight
        W_target = maxHeight / aspect
      } else {
        // 가로가 꽉 차는 레이아웃
        W_target = parentWidth
        H_target = parentWidth * aspect
      }

      // 90/270도 회전되어 출력되므로, 실제 img 태그의 가로세로(회전 전 크기)는 겉보기 가로세로를 뒤집어 적용
      imgStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${H_target}px`,
        height: `${W_target}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        objectFit: 'contain',
        maxWidth: 'none',
        maxHeight: 'none'
      }
      containerStyle.height = `${H_target}px`
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
      className="relative w-full flex items-center justify-center overflow-hidden"
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
