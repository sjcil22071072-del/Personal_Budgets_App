'use client'

interface Props {
  question?: string
  onComplete?: (response: 'positive' | 'negative') => void
  compact?: boolean
  context?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function SelfCheckFeedback(props: Props) {
  return null
}
