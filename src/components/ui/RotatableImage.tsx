'use client'

import { useEffect, useState, useRef } from 'react'

interface RotatableImageProps {
  src: string
  alt?: string
  rotation: number
  maxHeight?: number
  onClick?: () => void
  onDelete?: () => void
  deleting?: boolean
}

export default function RotatableImage({
  src,
  alt,
  rotation,
  maxHeight = 500,
  onClick,
  onDelete,
  deleting
}: RotatableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [containerWidth, setContainerWidth] = useState(0)

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
      setContainerWidth(parent.offsetWidth)
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
  }, [src])

  const isRotated = rotation === 90 || rotation === 270

  let imgStyle: React.CSSProperties = {}
  let containerStyle: React.CSSProperties = {}

  if (isRotated) {
    if (naturalSize.width > 0 && naturalSize.height > 0 && containerWidth > 0) {
      const parentWidth = containerWidth
      
      // Calculate unrotated layout box size (constrained by maxWidth/maxHeight)
      const scale_normal = Math.min(parentWidth / naturalSize.width, maxHeight / naturalSize.height, 1)
      const W_layout = naturalSize.width * scale_normal
      const H_layout = naturalSize.height * scale_normal

      // Calculate rotation scale to fit rotated box (H_layout x W_layout) inside (parentWidth x maxHeight)
      const scaleX = parentWidth / H_layout
      const scaleY = maxHeight / W_layout
      const scale = Math.min(scaleX, scaleY, 1)

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
      // 로딩 및 측정 전에도 사진을 투명화(opacity: 0)하지 않고 즉시 회전시켜 렌더링함으로써 하얀 화면 및 휙 도는 모션 원천 차단
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
        src={src}
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
