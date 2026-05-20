'use server'

import { createClient } from '@/utils/supabase/server'

function normalizeMonth(month: string): string {
  return month.slice(0, 7) + '-01'
}

function prevMonth(month: string): string {
  const [y, mo] = month.split('-').map(Number)
  const py = mo === 1 ? y - 1 : y
  const pmo = mo === 1 ? 12 : mo - 1
  return `${py}-${String(pmo).padStart(2, '0')}-01`
}

export async function getPrevMonthEvaluation(participantId: string, month: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const to = normalizeMonth(month)
  const from = prevMonth(to)

  const { data } = await supabase
    .from('evaluations')
    .select('*')
    .eq('participant_id', participantId)
    .eq('month', from)
    .single()

  return data ?? null
}
