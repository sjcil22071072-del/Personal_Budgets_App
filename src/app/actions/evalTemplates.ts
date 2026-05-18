'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OrgEvalSetting } from '@/types/eval-templates'
import { DEFAULT_ORG_EVAL_SETTING } from '@/types/eval-templates'

export async function getEvalTemplateSetting(): Promise<OrgEvalSetting> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'eval_template')
    .single()

  if (!data?.value) return DEFAULT_ORG_EVAL_SETTING
  return data.value as OrgEvalSetting
}

export async function saveEvalTemplateSetting(
  setting: OrgEvalSetting
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { success: false, error: '관리자�??�정??변경할 ???�습?�다.' }
  }

  const { error } = await supabase
    .from('system_settings')
    .upsert(
      { key: 'eval_template', value: setting as any, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/settings')
  return { success: true }
}
