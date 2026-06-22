'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  src: string
  alt?: string
  onClose: () => void
  showRotate?: boolean
  initialRotation?: number
  onRotateChange?: (rotation: number) => void
}

export default function ImageLightbox({ src, alt, onClose, showRotate = true, initialRotation = 0, onRotateChange }: Props) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(initialRotation)
  const [isDragging, setIsDragging] = useState(false)
  const [isInitial, setIsInitial] = useState(true)
  const dragStart = useRef({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

  const handleImageLoad = () => {
    if (imgRef.current && imgRef.current.naturalWidth > 0) {
      setNaturalSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight
      })
    }
  }

  useEffect(() => {
    let checkTimeout: any
    
    const checkSize = () => {
      if (imgRef.current && imgRef.current.complete) {
        if (imgRef.current.naturalWidth > 0) {
          setNaturalSize({
            width: imgRef.current.naturalWidth,
            height: imgRef.current.naturalHeight
          })
        } else {
          checkTimeout = setTimeout(checkSize, 50)
        }
      }
    }

    checkSize()
    return () => {
      if (checkTimeout) clearTimeout(checkTimeout)
    }
  }, [src])

  useEffect(() => {
    setViewportSize({
      width: window.innerWidth,
      height: window.innerHeight
    })
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitial(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 0.1
    let nextZoom = zoom + (e.deltaY < 0 ? zoomFactor : -zoomFactor)
    nextZoom = Math.min(Math.max(1, nextZoom), 5)
    setZoom(nextZoom)
    if (nextZoom === 1) {
      setPan({ x: 0, y: 0 })
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom <= 1 || e.touches.length !== 1) return
    setIsDragging(true)
    const touch = e.touches[0]
    dragStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    setPan({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y
    })
  }

  const handleClose = useCallback(() => {
    if (onRotateChange) {
      onRotateChange(rotation)
    }
    onClose()
  }, [onClose, onRotateChange, rotation])

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setRotation(0)
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 5))
  }

  const handleZoomOut = () => {
    setZoom(prev => {
      const next = Math.max(prev - 0.25, 1)
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }

  const handleRotate = () => {
    setIsInitial(false)
    setRotation(prev => (prev + 90) % 360)
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleClose])

  const isRotated = rotation === 90 || rotation === 270
  
  let imgStyle: React.CSSProperties = {}

  if (naturalSize.width > 0 && naturalSize.height > 0 && viewportSize.width > 0 && viewportSize.height > 0) {
    const maxW = viewportSize.width * 0.9
    const maxH = viewportSize.height * 0.7

    // Calculate unrotated layout box size
    const scale_normal = Math.min(maxW / naturalSize.width, maxH / naturalSize.height, 1)
    const W_layout = naturalSize.width * scale_normal
    const H_layout = naturalSize.height * scale_normal

    if (isRotated) {
      // Calculate rotation scale to fit rotated box (H_layout x W_layout) inside (maxW x maxH)
      const scaleX = maxW / H_layout
      const scaleY = maxH / W_layout
      const scale = Math.min(scaleX, scaleY, 1)

      imgStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${W_layout}px`,
        height: `${H_layout}px`,
        transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom * scale})`,
        transition: (isDragging || isInitial) ? 'none' : 'transform 0.15s ease-out',
        objectFit: 'contain',
        maxWidth: 'none',
        maxHeight: 'none',
        display: 'block'
      }
    } else {
      imgStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${W_layout}px`,
        height: `${H_layout}px`,
        transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
        transition: (isDragging || isInitial) ? 'none' : 'transform 0.15s ease-out',
        objectFit: 'contain',
        maxWidth: 'none',
        maxHeight: 'none',
        display: 'block'
      }
    }
  } else {
    // Before image loaded
    imgStyle = {
      maxWidth: '90vw',
      maxHeight: '70vh',
      opacity: 0,
      objectFit: 'contain',
      display: 'block'
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] bg-black/90 flex flex-col items-center justify-center select-none touch-none overflow-hidden"
      onClick={handleClose}
      onWheel={handleWheel}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl font-bold transition-colors z-[9010] shadow-lg border border-white/10"
        aria-label="닫기"
      >
        ✕
      </button>

      {/* 이미지 컨테이너 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? '사진'}
          style={imgStyle}
          onLoad={handleImageLoad}
          className={`rounded-xl shadow-2xl pointer-events-auto transition-transform ${
            zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          onClick={e => e.stopPropagation()}
        />
      </div>

      {/* 하단 글래스모피즘 컨트롤러 */}
      <div
        className="absolute bottom-8 bg-black/70 backdrop-blur-lg text-white rounded-full px-6 py-3.5 flex items-center gap-5 border border-white/10 shadow-2xl z-[9010] animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 1}
          className="text-sm font-black text-zinc-300 hover:text-white disabled:text-zinc-650 transition-colors flex items-center gap-1"
          title="축소"
        >
          ➖
        </button>
        <span className="text-xs font-bold text-zinc-400 min-w-[45px] text-center">
          {Math.round(zoom * 100)}% (v2)
        </span>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 5}
          className="text-sm font-black text-zinc-300 hover:text-white disabled:text-zinc-650 transition-colors flex items-center gap-1"
          title="확대"
        >
          ➕
        </button>
        <div className="w-px h-4 bg-white/20" />
        {showRotate && (
          <>
            <button
              onClick={handleRotate}
              className="text-sm font-black text-zinc-300 hover:text-white transition-colors flex items-center gap-1"
              title="회전"
            >
              🔄 회전
            </button>
            <div className="w-px h-4 bg-white/20" />
          </>
        )}
        <button
          onClick={handleReset}
          className="text-sm font-black text-zinc-300 hover:text-white transition-colors flex items-center gap-1"
          title="초기화"
        >
          ♻️ 초기화
        </button>
      </div>
    </div>,
    document.body
  )
}
