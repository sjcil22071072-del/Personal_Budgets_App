'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getEvalTemplateSetting } from '@/app/actions/evalTemplates'
import { resolveTemplateFields, resolveAiPrompt, type EvalTemplateId, type OrgEvalSetting } from '@/types/eval-templates'

export async function upsertEvaluation(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const participantId = formData.get('participant_id') as string
  const month = formData.get('month') as string
  const evaluation_template = ((formData.get('evaluation_template') as string) || 'pcp') as EvalTemplateId
  const isPcp = evaluation_template === 'pcp'

  // PCP ?„ìš© ì»¬ëŸ¼
  const tried = isPcp ? formData.get('tried') as string : null
  const learned = isPcp ? formData.get('learned') as string : null
  const pleased = isPcp ? formData.get('pleased') as string : null
  const concerned = isPcp ? formData.get('concerned') as string : null
  const next_step = isPcp ? formData.get('next_step') as string : null

  // ?œì¶œ???‘ì‹ ? í˜• ê¸°ì??¼ë¡œ effective setting êµ¬ì„±
  // custom??ê²½ìš°?ë§Œ ê¸°ê? ?¤ì •?ì„œ custom_fieldsë¥?ê°€?¸ì˜´
  const orgSetting = evaluation_template === 'custom' ? await getEvalTemplateSetting() : null
  const effectiveSetting: OrgEvalSetting = {
    active: evaluation_template,
    custom_fields: orgSetting?.custom_fields,
  }

  // ë¹„PCP: ?œì¶œ???‘ì‹ ê¸°ì??¼ë¡œ ?„ë“œë¥??˜ì§‘
  let template_data: Record<string, string> | null = null
  if (!isPcp) {
    const fields = resolveTemplateFields(effectiveSetting)
    template_data = {}
    for (const field of fields) {
      template_data[field.id] = (formData.get(field.id) as string) || ''
    }
  }

  // AI ë¶„ì„ ?ë™??ë¡œì§
  let ai_analysis = null
  let easy_summary = null

  const apiKey = process.env.OPENAI_API_KEY
  const aiPromptHint = resolveAiPrompt(effectiveSetting)

  let shouldRunAI = false
  let aiUserContent = ''

  if (isPcp) {
    shouldRunAI = !!(apiKey && (tried || learned || pleased || concerned))
    aiUserContent = `[?œë„??ê²?: ${tried}\n[ë°°ìš´ ê²?: ${learned}\n[ë§Œì¡±?˜ëŠ” ê²?: ${pleased}\n[ê³ ë??˜ëŠ” ê²?: ${concerned}\n[?¤ìŒ ?¨ê³„]: ${next_step}`
  } else if (apiKey && template_data) {
    const fields = resolveTemplateFields(effectiveSetting)
    shouldRunAI = fields.some(f => template_data![f.id])
    aiUserContent = fields.map(f => `[${f.label}]: ${template_data![f.id] || ''}`).join('\n')
  }

  if (shouldRunAI) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `?ˆëŠ” ?¬íšŒë³µì? ?„ë¬¸ê°€?´ì ë°œë‹¬?¥ì• ???¹ì‚¬?ì˜ ?ê¸°ì£¼ë„???¶ì„ ?•ëŠ” ì½”ì¹˜??
              ì§€?ìê°€ ?‘ì„±???‰ê? ?´ìš©??ë°”íƒ•?¼ë¡œ ?¤ìŒ ??ê°€ì§€ë¥??‘ì„±?´ì¤˜.
              1. supporterAnalysis: ì§€?ìê°€ ?¥í›„ ?´ë–¤ ?ì— ì§‘ì¤‘?´ì„œ ì§€?í•´??? ì? ?„ë¬¸ê°€??ë¶„ì„ (ì§€?ì??
              2. easySummary: ${aiPromptHint} ?¹ì‚¬?ê? ?½ì—ˆ?????´í•´?˜ê¸° ?½ê³  ?±ì·¨ê°ì„ ?ë‚„ ???ˆëŠ” ?°ëœ»??2-3ë¬¸ì¥???”ì•½ (?¹ì‚¬?ìš©)

              ë°˜ë“œ??JSON ?•ì‹?¼ë¡œ ?µë??´ì¤˜: {"supporterAnalysis": "...", "easySummary": "..."}`,
            },
            {
              role: 'user',
              content: aiUserContent,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      })

      const aiData = await response.json()
      const result = JSON.parse(aiData.choices[0].message.content)
      ai_analysis = result
      easy_summary = result.easySummary
    } catch (e) {
      console.error('AI ë¶„ì„ ?¤íŒ¨:', e)
      // AI ë¶„ì„ ?¤íŒ¨?´ë„ ?€?¥ì? ì§„í–‰
    }
  }

  const { error } = await supabase
    .from('evaluations')
    .upsert(
      {
        participant_id: participantId,
        month,
        evaluation_template,
        tried,
        learned,
        pleased,
        concerned,
        next_step,
        template_data,
        ai_analysis,
        easy_summary,
        creator_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'participant_id, month' }
    )

  if (error) {
    console.error('Evaluation Save Error:', error)
    throw new Error('?‰ê? ?€?¥ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.')
  }

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/evaluations')
  return { success: true }
}

export async function publishEvaluation(evaluationId: string, participantId: string, month: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    throw new Error('ê¶Œí•œ???†ìŠµ?ˆë‹¤.')
  }

  const { error } = await supabase
    .from('evaluations')
    .update({ published_at: new Date().toISOString() })
    .eq('id', evaluationId)
  if (error) throw new Error('ë°œí–‰???¤íŒ¨?ˆìŠµ?ˆë‹¤.')

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/evaluations')
  revalidatePath('/')
  return { success: true }
}

export async function unpublishEvaluation(evaluationId: string, participantId: string, month: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    throw new Error('ê¶Œí•œ???†ìŠµ?ˆë‹¤.')
  }

  const { error } = await supabase
    .from('evaluations')
    .update({ published_at: null })
    .eq('id', evaluationId)
  if (error) throw new Error('ë°œí–‰ ì·¨ì†Œ???¤íŒ¨?ˆìŠµ?ˆë‹¤.')

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/evaluations')
  revalidatePath('/')
  return { success: true }
}

export async function getEvaluation(participantId: string, month: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('evaluations')
    .select('*')
    .eq('participant_id', participantId)
    .eq('month', month)
    .single()
  return data ?? null
}

export async function deleteEvaluation(evaluationId: string, participantId: string, month: string) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') throw new Error('?°ëª¨ ëª¨ë“œ?ì„œ???? œ?????†ìŠµ?ˆë‹¤.')

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    throw new Error('ê¶Œí•œ???†ìŠµ?ˆë‹¤.')
  }

  const { error } = await supabase
    .from('evaluations')
    .delete()
    .eq('id', evaluationId)

  if (error) throw new Error('?‰ê? ?? œ???¤íŒ¨?ˆìŠµ?ˆë‹¤.')

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/supporter/evaluations')
  return { success: true }
}
