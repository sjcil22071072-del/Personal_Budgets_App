'use client'

import { useEffect, useState, useRef } from 'react'

interface RotatableImageProps {
  src: string
  alt?: string
  rotation: number
  onClick?: () => void
  onDelete?: () => void
  deleting?: boolean
}

export default function RotatableImage({ src, alt, rotation, onClick, onDelete, deleting }: RotatableImageProps) {
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
      const scale_normal = Math.min(parentWidth / naturalSize.width, 500 / naturalSize.height, 1)
      const W_layout = naturalSize.width * scale_normal
      const H_layout = naturalSize.height * scale_normal

      // Calculate rotation scale to fit rotated box (H_layout x W_layout) inside (parentWidth x 500)
      const scaleX = parentWidth / H_layout
      const scaleY = 500 / W_layout
      const scale = Math.min(scaleX, scaleY, 1)

      imgStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${W_layout}px`,
        height: `${H_layout}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
        transition: 'transform 0.2s ease-in-out',
        objectFit: 'contain',
        maxWidth: 'none',
        maxHeight: 'none'
      }
      containerStyle.height = `${W_layout * scale}px`
    } else {
      // Before image loaded
      imgStyle = {
        maxWidth: '100%',
        maxHeight: '500px',
        opacity: 0,
        objectFit: 'contain'
      }
      containerStyle.height = '400px'
    }
  } else {
    // Not rotated (0 or 180 deg)
    imgStyle = {
      transform: `rotate(${rotation}deg)`,
      transition: 'transform 0.2s ease-in-out',
      maxWidth: '100%',
      maxHeight: '500px',
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
