'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'

export interface CsvRow {
  date: string        // YYYY-MM-DD
  description: string // ?�용 (가게명)
  memo: string        // 메모 (?�세?�명)
  amount: number      // ?�수 = 출금(지�?, ?�수 = ?�금(?�입)
  type: '출금' | '?�금' | string
}

export interface MatchResult {
  csvRow: CsvRow
  matchedTxId?: string
  matchedTxName?: string
  isDuplicate: boolean
}

export interface ParseAndMatchResult {
  matched: MatchResult[]
  unmatched: MatchResult[]
  duplicate: MatchResult[]
  parseErrors: string[]
}

// ?�?� ?�제 카카?�뱅??xlsx/csv ?�싱 ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// ?�제 ?�맷 (Row 11???�더):
//   거래?�시 | 구분 | 거래금액 | 거래 ???�액 | 거래구분 | ?�용 | 메모
//
// Row 1: '카카?�뱅??거래?�역' (?�?��?)
// Row 4: ?�명, 계좌번호 ??메�??�보
// Row 11: ?�더 ??
// Row 12~: ?�제 ?�이??

function parseDate(raw: string | number | Date | null | undefined): string | null {
  if (!raw) return null

  // Excel serial number (?�자)
  if (typeof raw === 'number') {
    // xlsx가 ?��? JS Date�?변?�하므�?보통 ?�기 ?��? ?�음
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }

  // JS Date 객체
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10)
  }

  // 문자?? '2026.03.05 10:53:34' ?�는 '2026-03-05'
  const str = String(raw).replace(/\./g, '-')
  const m = str.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(String(raw).replace(/[,\s]/g, ''))
  return isNaN(n) ? null : n
}

/**
 * xlsx ?�이브러리로 바이?�리 ??2D 배열 변??
 * ArrayBuffer | string (csv text) 모두 지??
 */
async function parseWorkbook(buffer: ArrayBuffer): Promise<(unknown[])[]> {
  const XLSX = await import('xlsx')

  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // header: 1 ??�??�을 배열 ?�덱?�로 ?�용 (?�더 ?�동 감�??��? ?�음)
  const rows: (unknown[])[] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,   // ?�짜·?�자 모두 문자?�로 받아 직접 ?�싱
  }) as (unknown[])[]

  return rows
}

/**
 * CSV ?�스?��? 2D 배열�?변??(xlsx ?�이)
 */
function parseCsvText(text: string): (string | null)[][] {
  return text
    .split('\n')
    .map(line => splitCsvLine(line))
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/**
 * 2D 배열?�서 '거래?�시' ?�더 ??찾기
 * 카카?�뱅?? ??11?�째???�더 ?�음
 */
function findHeaderRow(rows: unknown[][]): { headerIdx: number; colMap: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    if (!row) continue
    const headerText = row.map(c => String(c ?? '').trim())
    const dateColIdx = headerText.findIndex(c =>
      c === '거래?�시' || c === '거래?? || c === '?�시'
    )
    if (dateColIdx >= 0) {
      const colMap: Record<string, number> = {}
      headerText.forEach((col, j) => {
        colMap[col] = j
      })
      return { headerIdx: i, colMap }
    }
  }
  return null
}

function extractRows(rows: unknown[][], headerIdx: number, colMap: Record<string, number>): CsvRow[] {
  const result: CsvRow[] = []

  // 카카?�뱅??컬럼 ?�서 ?�인
  // 공식: 거래?�시(0) | 구분(1) | 거래금액(2) | 거래 ???�액(3) | 거래구분(4) | ?�용(5) | 메모(6)
  // colMap?�로 ?�제 ?�덱??찾기
  const iDate    = colMap['거래?�시'] ?? colMap['거래??] ?? colMap['?�시'] ?? 0
  const iType    = colMap['구분'] ?? 1
  const iAmount  = colMap['거래금액'] ?? colMap['출금(??'] ?? 2
  const iContent = colMap['?�용'] ?? 5
  const iMemo    = colMap['메모'] ?? 6

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === null || String(c).trim() === '')) continue

    const rawDate   = row[iDate]
    const rawType   = String(row[iType] ?? '').trim()
    const rawAmount = row[iAmount]
    const rawContent = String(row[iContent] ?? '').trim()
    const rawMemo   = String(row[iMemo] ?? '').trim()

    const date = parseDate(rawDate as string)
    if (!date) continue

    const amountVal = parseAmount(rawAmount)
    if (amountVal === null) continue

    // 거래금액???�수�?출금, ?�수�??�금
    // 구분 컬럼??'출금'?�면 ?�수?�하??지출로 처리
    let finalAmount: number
    if (rawType === '출금') {
      finalAmount = Math.abs(amountVal)   // ?�수 = 지�?
    } else if (rawType === '?�금') {
      finalAmount = -Math.abs(amountVal)  // ?�수 = ?�입
    } else {
      // 구분 ?�이 금액 부?�로 ?�단
      finalAmount = amountVal < 0 ? Math.abs(amountVal) : -Math.abs(amountVal)
    }

    const description = rawContent || rawMemo || '(?�용 ?�음)'
    const memo = rawContent && rawMemo && rawContent !== rawMemo ? rawMemo : ''

    result.push({ date, description, memo, amount: finalAmount, type: rawType })
  }

  return result
}

// ?�?� 메인 ?�서 (XLSX binary ?�는 CSV text) ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
async function parseKakaoBankFile(buffer: ArrayBuffer, fileName: string): Promise<{ rows: CsvRow[]; errors: string[] }> {
  const errors: string[] = []
  let rawRows: unknown[][]

  const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
  const isCsv  = fileName.endsWith('.csv')

  if (isXlsx) {
    rawRows = await parseWorkbook(buffer)
  } else {
    // CSV ??text decode ???�싱
    const text = new TextDecoder('utf-8').decode(buffer)
    rawRows = parseCsvText(text)
  }

  const found = findHeaderRow(rawRows)
  if (!found) {
    errors.push('?�더 ??"거래?�시")??찾을 ???�습?�다. 카카?�뱅??거래?�역 ?�일?��? ?�인?�세??')
    return { rows: [], errors }
  }

  const rows = extractRows(rawRows, found.headerIdx, found.colMap)

  if (rows.length === 0) {
    errors.push('?�싱??거래 ?�이 ?�습?�다. ?�일 ?�용???�인?�세??')
  }

  return { rows, errors }
}

// ?�?� ?�버 ?�션: ?�일 ?�싱 + DB ?��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
export async function parseAndMatchFile(
  fileData: { buffer: number[]; name: string },
  participantId: string
): Promise<ParseAndMatchResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const buffer = new Uint8Array(fileData.buffer).buffer
  const { rows, errors } = await parseKakaoBankFile(buffer, fileData.name)

  if (rows.length === 0) {
    return { matched: [], unmatched: [], duplicate: [], parseErrors: errors }
  }

  // ?�당 참�??�의 거래 조회 (?�짜+금액 ?��?
  const dates = [...new Set(rows.map(r => r.date))]
  const { data: existingTxs } = await supabase
    .from('transactions')
    .select('id, date, amount, activity_name')
    .eq('participant_id', participantId)
    .in('date', dates)

  const txMap = new Map<string, { id: string; activity_name: string }[]>()
  for (const tx of existingTxs || []) {
    const key = `${tx.date}__${Math.abs(Number(tx.amount))}`
    if (!txMap.has(key)) txMap.set(key, [])
    txMap.get(key)!.push({ id: tx.id, activity_name: tx.activity_name })
  }

  const matched: MatchResult[] = []
  const unmatched: MatchResult[] = []
  const duplicate: MatchResult[] = []

  for (const row of rows) {
    const key = `${row.date}__${Math.abs(row.amount)}`
    const existing = txMap.get(key)

    if (!existing || existing.length === 0) {
      unmatched.push({ csvRow: row, isDuplicate: false })
    } else {
      const sameDesc = existing.find(tx => tx.activity_name === row.description)
      if (sameDesc) {
        duplicate.push({ csvRow: row, matchedTxId: sameDesc.id, matchedTxName: sameDesc.activity_name, isDuplicate: true })
      } else {
        matched.push({ csvRow: row, matchedTxId: existing[0].id, matchedTxName: existing[0].activity_name, isDuplicate: false })
      }
    }
  }

  return { matched, unmatched, duplicate, parseErrors: errors }
}

// ?�?� ?�택????�� ?�괄 ?�포???�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
export async function importSelectedRows(
  rows: CsvRow[],
  participantId: string,
  fundingSourceId: string
): Promise<{ imported: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (rows.length === 0) return { imported: 0 }

  const records = rows.map(row => ({
    participant_id: participantId,
    funding_source_id: fundingSourceId,
    date: row.date,
    activity_name: row.description,
    amount: row.amount,
    category: '기�?',
    status: 'pending' as const,
    payment_method: '체크카드',
    memo: row.memo || 'CSV ?�동 ?�포??,
  }))

  const { error } = await supabase.from('transactions').insert(records)
  if (error) return { imported: 0, error: error.message }

  return { imported: records.length }
}

// ?�위 ?�환 ???�전 ?�그?�처 ?��? (모달?�서 참조)
export { type CsvRow as ImportCsvRow }
