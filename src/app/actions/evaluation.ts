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

  // PCP ?�용 컬럼
  const tried = isPcp ? formData.get('tried') as string : null
  const learned = isPcp ? formData.get('learned') as string : null
  const pleased = isPcp ? formData.get('pleased') as string : null
  const concerned = isPcp ? formData.get('concerned') as string : null
  const next_step = isPcp ? formData.get('next_step') as string : null

  // ?�출???�식 ?�형 기�??�로 effective setting 구성
  // custom??경우?�만 기�? ?�정?�서 custom_fields�?가?�옴
  const orgSetting = evaluation_template === 'custom' ? await getEvalTemplateSetting() : null
  const effectiveSetting: OrgEvalSetting = {
    active: evaluation_template,
    custom_fields: orgSetting?.custom_fields,
  }

  // 비PCP: ?�출???�식 기�??�로 ?�드�??�집
  let template_data: Record<string, string> | null = null
  if (!isPcp) {
    const fields = resolveTemplateFields(effectiveSetting)
    template_data = {}
    for (const field of fields) {
      template_data[field.id] = (formData.get(field.id) as string) || ''
    }
  }

  // AI 분석 ?�동??로직
  let ai_analysis = null
  let easy_summary = null

  const apiKey = process.env.OPENAI_API_KEY
  const aiPromptHint = resolveAiPrompt(effectiveSetting)

  let shouldRunAI = false
  let aiUserContent = ''

  if (isPcp) {
    shouldRunAI = !!(apiKey && (tried || learned || pleased || concerned))
    aiUserContent = `[?�도??�?: ${tried}\n[배운 �?: ${learned}\n[만족?�는 �?: ${pleased}\n[고�??�는 �?: ${concerned}\n[?�음 ?�계]: ${next_step}`
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
              content: `?�는 ?�회복�? ?�문가?�자 발달?�애???�사?�의 ?�기주도???�을 ?�는 코치??
              지?�자가 ?�성???��? ?�용??바탕?�로 ?�음 ??가지�??�성?�줘.
              1. supporterAnalysis: 지?�자가 ?�후 ?�떤 ?�에 집중?�서 지?�해???��? ?�문가??분석 (지?�자??
              2. easySummary: ${aiPromptHint} ?�사?��? ?�었?????�해?�기 ?�고 ?�취감을 ?�낄 ???�는 ?�뜻??2-3문장???�약 (?�사?�용)

              반드??JSON ?�식?�로 ?��??�줘: {"supporterAnalysis": "...", "easySummary": "..."}`,
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
      console.error('AI 분석 ?�패:', e)
      // AI 분석 ?�패?�도 ?�?��? 진행
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
    throw new Error('?��? ?�?�에 ?�패?�습?�다.')
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
    throw new Error('권한???�습?�다.')
  }

  const { error } = await supabase
    .from('evaluations')
    .update({ published_at: new Date().toISOString() })
    .eq('id', evaluationId)
  if (error) throw new Error('발행???�패?�습?�다.')

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
    throw new Error('권한???�습?�다.')
  }

  const { error } = await supabase
    .from('evaluations')
    .update({ published_at: null })
    .eq('id', evaluationId)
  if (error) throw new Error('발행 취소???�패?�습?�다.')

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
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') throw new Error('?�모 모드?�서????��?????�습?�다.')

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    throw new Error('권한???�습?�다.')
  }

  const { error } = await supabase
    .from('evaluations')
    .delete()
    .eq('id', evaluationId)

  if (error) throw new Error('?��? ??��???�패?�습?�다.')

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/supporter/evaluations')
  return { success: true }
}
