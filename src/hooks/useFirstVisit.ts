'use client'

import { useState, useEffect, useCallback } from 'react'

const PREFIX = 'help_visited_'

export function useFirstVisit(sectionKey: string): [boolean, () => void] {
  const [isFirstVisit, setIsFirstVisit] = useState(false)

  useEffect(() => {
    try {
      const visited = localStorage.getItem(PREFIX + sectionKey)
      if (!visited) setIsFirstVisit(true)
    } catch {}
  }, [sectionKey])

  const markVisited = useCallback(() => {
    try {
      localStorage.setItem(PREFIX + sectionKey, 'true')
    } catch {}
    setIsFirstVisit(false)
  }, [sectionKey])

  return [isFirstVisit, markVisited]
}
