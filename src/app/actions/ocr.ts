'use server'

import { withTiming } from '@/utils/api-logger'

/** 클라이언트 FileReader data URL 또는 순수 base64(구버전 호환) */
function toOpenAiImageUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed.startsWith('data:')) return trimmed
  return `data:image/jpeg;base64,${trimmed}`
}

function parseAmount(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const digits = v.replace(/[^\d]/g, '')
    if (!digits) return null
    const n = parseInt(digits, 10)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m = raw.match(/(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/)
  if (m) {
    const y = m[1]
    const mo = m[2].padStart(2, '0')
    const d = m[3].padStart(2, '0')
    return `${y}-${mo}-${d}`
  }
  return null
}

function normalizeReceiptFields(raw: Record<string, unknown>): {
  date: string | null
  amount: number | null
  store: string
  address: string | null
} {
  const dateRaw = pickString(raw.date, raw['날짜'])
  const date = normalizeDate(dateRaw)

  const store = pickString(raw.store, raw.merchant, raw['상호명'], raw['가맹점명'], raw['매장명'])

  const address = pickString(raw.address, raw['주소']) || null

  const amount =
    parseAmount(raw.amount) ??
    parseAmount(raw.total) ??
    parseAmount(raw['합계']) ??
    parseAmount(raw['금액']) ??
    parseAmount(raw['총액'])

  return { date, amount, store, address }
}

export async function analyzeReceipt(imageDataUrlOrBase64: string) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다.')
    return { success: false, error: '서버에 AI 키가 없어 영수증 자동 읽기를 할 수 없어요.' }
  }

  const imageUrl = toOpenAiImageUrl(imageDataUrlOrBase64)

  try {
    const response = await withTiming('OpenAI OCR', () =>
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content:
                "너는 영수증 분석 전문가야. 이미지에서 '날짜(YYYY-MM-DD)', '합계 금액(숫자만)', '상호명', '주소'를 찾아 반드시 JSON 형식으로만 답변해줘. 키는 date, amount, store, address 만 사용해. 주소가 없으면 address는 null. amount는 원 단위 정수 숫자만.",
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '이 영수증에서 날짜, 금액, 상호명, 주소를 추출해줘.',
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl, detail: 'high' },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 500,
        }),
      })
    )

    const data = await response.json()

    if (!response.ok) {
      const msg =
        typeof data?.error?.message === 'string'
          ? data.error.message
          : `OpenAI HTTP ${response.status}`
      console.error('OpenAI OCR HTTP error:', response.status, data)
      return { success: false, error: msg }
    }

    if (data.error) {
      const msg = typeof data.error.message === 'string' ? data.error.message : 'OpenAI 오류'
      return { success: false, error: msg }
    }

    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      console.error('OpenAI OCR empty content:', data)
      return { success: false, error: '영수증 읽기 결과가 비어 있어요. 사진을 더 밝게 찍어 주세요.' }
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(content) as Record<string, unknown>
    } catch {
      console.error('OpenAI OCR JSON parse failed:', content.slice(0, 200))
      return { success: false, error: '영수증 읽기 형식이 잘못됐어요. 다시 시도해 주세요.' }
    }

    const normalized = normalizeReceiptFields(parsed)

    return {
      success: true,
      data: {
        date: normalized.date,
        amount: normalized.amount,
        store: normalized.store,
        address: normalized.address,
      },
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '영수증 분석 중 오류가 났어요.'
    console.error('OCR 분석 오류:', error)
    return { success: false, error: message }
  }
}
