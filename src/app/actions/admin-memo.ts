'use server'

import { createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const MEMO_KEY = 'admin_shared_memo'

export async function getAdminMemo(): Promise<string> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('system_settings')
    .select('value')
    .eq('key', MEMO_KEY)
    .single()

  if (!data) return ''
  return (data.value as string) ?? ''
}

export async function saveAdminMemo(memo: string): Promise<void> {
  const adminClient = createAdminClient()
  await adminClient
    .from('system_settings')
    .upsert({ key: MEMO_KEY, value: memo, updated_at: new Date().toISOString() })

  revalidatePath('/admin')
}
