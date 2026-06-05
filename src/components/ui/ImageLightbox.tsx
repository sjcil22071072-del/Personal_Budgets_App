'use client'

import { useEffect, useState, useRef } from 'react'
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
  const dragStart = useRef({ x: 0, y: 0 })

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

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setRotation(0)
    if (onRotateChange) onRotateChange(0)
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
    setRotation(prev => {
      const next = (prev + 90) % 360
      if (onRotateChange) onRotateChange(next)
      return next
    })
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const transformStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] bg-black/90 flex flex-col items-center justify-center p-4 select-none touch-none overflow-hidden"
      onClick={onClose}
      onWheel={handleWheel}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl font-bold transition-colors z-[9010] shadow-lg border border-white/10"
        aria-label="닫기"
      >
        ✕
      </button>

      {/* 이미지 컨테이너 */}
      <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
        <img
          src={src}
          alt={alt ?? '사진'}
          style={transformStyle}
          className={`max-w-[90vw] max-h-[80dvh] object-contain rounded-xl shadow-2xl pointer-events-auto transition-transform ${
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
          {Math.round(zoom * 100)}%
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
