'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'

export interface CsvRow {
  date: string        // YYYY-MM-DD
  description: string // ?´ìš© (ê°€ê²Œëª…)
  memo: string        // ë©”ëª¨ (?ì„¸?¤ëª…)
  amount: number      // ?‘ìˆ˜ = ì¶œê¸ˆ(ì§€ì¶?, ?Œìˆ˜ = ?…ê¸ˆ(?˜ì…)
  type: 'ì¶œê¸ˆ' | '?…ê¸ˆ' | string
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

// ?€?€ ?¤ì œ ì¹´ì¹´?¤ë±…??xlsx/csv ?Œì‹± ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
// ?¤ì œ ?¬ë§· (Row 11???¤ë”):
//   ê±°ë˜?¼ì‹œ | êµ¬ë¶„ | ê±°ë˜ê¸ˆì•¡ | ê±°ë˜ ???”ì•¡ | ê±°ë˜êµ¬ë¶„ | ?´ìš© | ë©”ëª¨
//
// Row 1: 'ì¹´ì¹´?¤ë±…??ê±°ë˜?´ì—­' (?€?´í?)
// Row 4: ?±ëª…, ê³„ì¢Œë²ˆí˜¸ ??ë©”í??•ë³´
// Row 11: ?¤ë” ??
// Row 12~: ?¤ì œ ?°ì´??

function parseDate(raw: string | number | Date | null | undefined): string | null {
  if (!raw) return null

  // Excel serial number (?«ì)
  if (typeof raw === 'number') {
    // xlsxê°€ ?´ë? JS Dateë¡?ë³€?˜í•˜ë¯€ë¡?ë³´í†µ ?¬ê¸° ?¤ì? ?ŠìŒ
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }

  // JS Date ê°ì²´
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10)
  }

  // ë¬¸ì?? '2026.03.05 10:53:34' ?ëŠ” '2026-03-05'
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
 * xlsx ?¼ì´ë¸ŒëŸ¬ë¦¬ë¡œ ë°”ì´?ˆë¦¬ ??2D ë°°ì—´ ë³€??
 * ArrayBuffer | string (csv text) ëª¨ë‘ ì§€??
 */
async function parseWorkbook(buffer: ArrayBuffer): Promise<(unknown[])[]> {
  const XLSX = await import('xlsx')

  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // header: 1 ??ì²??‰ì„ ë°°ì—´ ?¸ë±?¤ë¡œ ?¬ìš© (?¤ë” ?ë™ ê°ì??˜ì? ?ŠìŒ)
  const rows: (unknown[])[] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,   // ? ì§œÂ·?«ì ëª¨ë‘ ë¬¸ì?´ë¡œ ë°›ì•„ ì§ì ‘ ?Œì‹±
  }) as (unknown[])[]

  return rows
}

/**
 * CSV ?ìŠ¤?¸ë? 2D ë°°ì—´ë¡?ë³€??(xlsx ?†ì´)
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
 * 2D ë°°ì—´?ì„œ 'ê±°ë˜?¼ì‹œ' ?¤ë” ??ì°¾ê¸°
 * ì¹´ì¹´?¤ë±…?? ??11?‰ì§¸???¤ë” ?ˆìŒ
 */
function findHeaderRow(rows: unknown[][]): { headerIdx: number; colMap: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    if (!row) continue
    const headerText = row.map(c => String(c ?? '').trim())
    const dateColIdx = headerText.findIndex(c =>
      c === 'ê±°ë˜?¼ì‹œ' || c === 'ê±°ë˜?? || c === '?¼ì‹œ'
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

  // ì¹´ì¹´?¤ë±…??ì»¬ëŸ¼ ?œì„œ ?•ì¸
  // ê³µì‹: ê±°ë˜?¼ì‹œ(0) | êµ¬ë¶„(1) | ê±°ë˜ê¸ˆì•¡(2) | ê±°ë˜ ???”ì•¡(3) | ê±°ë˜êµ¬ë¶„(4) | ?´ìš©(5) | ë©”ëª¨(6)
  // colMap?¼ë¡œ ?¤ì œ ?¸ë±??ì°¾ê¸°
  const iDate    = colMap['ê±°ë˜?¼ì‹œ'] ?? colMap['ê±°ë˜??] ?? colMap['?¼ì‹œ'] ?? 0
  const iType    = colMap['êµ¬ë¶„'] ?? 1
  const iAmount  = colMap['ê±°ë˜ê¸ˆì•¡'] ?? colMap['ì¶œê¸ˆ(??'] ?? 2
  const iContent = colMap['?´ìš©'] ?? 5
  const iMemo    = colMap['ë©”ëª¨'] ?? 6

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

    // ê±°ë˜ê¸ˆì•¡???Œìˆ˜ë©?ì¶œê¸ˆ, ?‘ìˆ˜ë©??…ê¸ˆ
    // êµ¬ë¶„ ì»¬ëŸ¼??'ì¶œê¸ˆ'?´ë©´ ?‘ìˆ˜?”í•˜??ì§€ì¶œë¡œ ì²˜ë¦¬
    let finalAmount: number
    if (rawType === 'ì¶œê¸ˆ') {
      finalAmount = Math.abs(amountVal)   // ?‘ìˆ˜ = ì§€ì¶?
    } else if (rawType === '?…ê¸ˆ') {
      finalAmount = -Math.abs(amountVal)  // ?Œìˆ˜ = ?˜ì…
    } else {
      // êµ¬ë¶„ ?†ì´ ê¸ˆì•¡ ë¶€?¸ë¡œ ?ë‹¨
      finalAmount = amountVal < 0 ? Math.abs(amountVal) : -Math.abs(amountVal)
    }

    const description = rawContent || rawMemo || '(?´ìš© ?†ìŒ)'
    const memo = rawContent && rawMemo && rawContent !== rawMemo ? rawMemo : ''

    result.push({ date, description, memo, amount: finalAmount, type: rawType })
  }

  return result
}

// ?€?€ ë©”ì¸ ?Œì„œ (XLSX binary ?ëŠ” CSV text) ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
async function parseKakaoBankFile(buffer: ArrayBuffer, fileName: string): Promise<{ rows: CsvRow[]; errors: string[] }> {
  const errors: string[] = []
  let rawRows: unknown[][]

  const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
  const isCsv  = fileName.endsWith('.csv')

  if (isXlsx) {
    rawRows = await parseWorkbook(buffer)
  } else {
    // CSV ??text decode ???Œì‹±
    const text = new TextDecoder('utf-8').decode(buffer)
    rawRows = parseCsvText(text)
  }

  const found = findHeaderRow(rawRows)
  if (!found) {
    errors.push('?¤ë” ??"ê±°ë˜?¼ì‹œ")??ì°¾ì„ ???†ìŠµ?ˆë‹¤. ì¹´ì¹´?¤ë±…??ê±°ë˜?´ì—­ ?Œì¼?¸ì? ?•ì¸?˜ì„¸??')
    return { rows: [], errors }
  }

  const rows = extractRows(rawRows, found.headerIdx, found.colMap)

  if (rows.length === 0) {
    errors.push('?Œì‹±??ê±°ë˜ ?‰ì´ ?†ìŠµ?ˆë‹¤. ?Œì¼ ?´ìš©???•ì¸?˜ì„¸??')
  }

  return { rows, errors }
}

// ?€?€ ?œë²„ ?¡ì…˜: ?Œì¼ ?Œì‹± + DB ?€ì¡??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
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

  // ?´ë‹¹ ì°¸ê??ì˜ ê±°ë˜ ì¡°íšŒ (? ì§œ+ê¸ˆì•¡ ?€ì¡?
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

// ?€?€ ? íƒ????ª© ?¼ê´„ ?„í¬???€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
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
    category: 'ê¸°í?',
    status: 'pending' as const,
    payment_method: 'ì²´í¬ì¹´ë“œ',
    memo: row.memo || 'CSV ?ë™ ?„í¬??,
  }))

  const { error } = await supabase.from('transactions').insert(records)
  if (error) return { imported: 0, error: error.message }

  return { imported: records.length }
}

// ?˜ìœ„ ?¸í™˜ ???´ì „ ?œê·¸?ˆì²˜ ? ì? (ëª¨ë‹¬?ì„œ ì°¸ì¡°)
export { type CsvRow as ImportCsvRow }
