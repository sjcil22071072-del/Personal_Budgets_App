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
  const [isImgLoaded, setIsImgLoaded] = useState(false)

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
      setIsImgLoaded(true)
      setNaturalSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight
      })
    }
  }

  // 컴포넌트 마운트 및 displayedSrc 변경 시점에 이미 캐싱된 이미지 상태 체크
  useEffect(() => {
    if (imgRef.current) {
      if (imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        setIsImgLoaded(true)
        setNaturalSize({
          width: imgRef.current.naturalWidth,
          height: imgRef.current.naturalHeight
        })
      } else {
        setIsImgLoaded(false)
      }
    }
  }, [displayedSrc])

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

  const isRotated = rotation === 90 || rotation === 270

  let imgStyle: React.CSSProperties = {}
  let containerStyle: React.CSSProperties = {}

  if (isRotated) {
    if (!isImgLoaded || naturalSize.width === 0) {
      // 로딩 중인 회전 이미지: Layout Shift를 방지하기 위해 maxHeight를 차지하고, 
      // 이미지를 완전히 가리지 않고 연하게 보여주어(opacity: 0.6) 브라우저 점진적 로딩을 활용합니다.
      imgStyle = {
        width: '100%',
        height: '100%',
        transform: `rotate(${rotation}deg)`,
        objectFit: 'contain',
        maxHeight: `${maxHeight}px`,
        opacity: 0.6,
        transition: 'opacity 0.2s ease-out',
        backgroundColor: 'transparent'
      }
      containerStyle = {
        height: `${maxHeight}px`,
        opacity: 1,
        backgroundColor: 'transparent',
        overflow: 'hidden'
      }
    } else {
      // 로딩 완료된 회전 이미지
      const parentWidth = containerWidth || 320
      
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
        maxHeight: 'none',
        opacity: 1,
        transition: 'opacity 0.2s ease-out',
        backgroundColor: 'transparent'
      }
      containerStyle = {
        height: `${W_layout * scale}px`,
        opacity: 1,
        transition: 'opacity 0.2s ease-out, height 0.2s ease-out',
        backgroundColor: 'transparent'
      }
    }
  } else {
    // 일반 이미지 (0도, 180도 등) - 크기 측정 대기 없이 즉시 투명도 1로 렌더링하여 로딩 지연 원천 배제
    imgStyle = {
      transform: `rotate(${rotation}deg)`,
      maxWidth: '100%',
      maxHeight: `${maxHeight}px`,
      objectFit: 'contain',
      width: 'auto',
      height: 'auto',
      display: 'block',
      opacity: 1,
      transition: 'opacity 0.2s ease-out',
      backgroundColor: 'transparent'
    }
    containerStyle = {
      height: 'auto',
      opacity: 1,
      transition: 'opacity 0.2s ease-out',
      backgroundColor: 'transparent'
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full flex items-center justify-center overflow-hidden rounded-lg"
      style={{
        ...containerStyle,
        // Webkit/Safari 등에서 overflow: hidden + border-radius + transform 조합 시 모서리가 뚫리는 현상 방지
        isolation: 'isolate',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        // 강제 마스킹을 적용해 둥근 모서리 바깥으로 삐져나온 흰색 귀퉁이를 완전히 잘라냅니다.
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
      }}
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
