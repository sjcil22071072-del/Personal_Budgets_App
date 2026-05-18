'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { callOpenAI } from '@/utils/openai'

interface PlanOption {
  name: string
  cost: number
  time: string
  icon: string
  description?: string
}

interface PlanContext {
  activity?: string
  when?: string
  where?: string
  who?: string
  why?: string
}

/**
 * ?¨ê³„ 1: ?”ì•¡Â·?”ì¼ ê¸°ë°˜ ?œë™ 2ê°€ì§€ ì¶”ì²œ (?€?¥ëœ ê³„íš ê¸°ë°˜ ê°œì¸???¬í•¨)
 */
export async function suggestActivityOptions(
  balance: number,
  dayOfWeek: string,
  month: number,
  participantId?: string
): Promise<{ success: boolean; data?: { a: string; b: string }; error?: string }> {
  try {
    // ?´ì „???€?¥í•œ ê³„íš?ì„œ ?œë™ ëª©ë¡ ì¡°íšŒ (ê°œì¸?”ìš©)
    let recentContext = ''
    if (participantId) {
      const supabase = await createClient()
      const { data: plans } = await supabase
        .from('plans')
        .select('activity_name')
        .eq('participant_id', participantId)
        .order('date', { ascending: false })
        .limit(10)

      const activities = (plans ?? [])
        .map((p: { activity_name: string }) => p.activity_name)
        .filter(Boolean)

      if (activities.length > 0) {
        const unique = [...new Set(activities)].slice(0, 6).join(', ')
        recentContext = `\n???¬ëŒ??ìµœê·¼??ì¢‹ì•„?ˆë˜ ?œë™?? ${unique}\n?´ì „ ?œë™ê³?ë¹„ìŠ·?˜ê±°???°ê???ê²??„ì£¼ë¡?ì¶”ì²œ?˜ë˜, ê°€?”ì? ?ˆë¡œ???œë™???œì•ˆ?´ì£¼?¸ìš”.`
      }
    }

    const result = await callOpenAI([
      {
        role: 'system',
        content: `?¹ì‹ ?€ ë°œë‹¬?¥ì• ???±ì¸???„í•œ ?¼ìƒ ê³„íš ?„ìš°ë¯¸ì…?ˆë‹¤.
?¬ìš©?ëŠ” ?´ë²ˆ ??${balance.toLocaleString()}?ì´ ?¨ì•„?ˆìŠµ?ˆë‹¤.
?¤ëŠ˜?€ ${dayOfWeek}?”ì¼(${month}???…ë‹ˆ??${recentContext}

?¼ìƒ?ì´ê³??ˆì‚°??ë§ëŠ” ?œë™ 2ê°€ì§€ë¥?ì¶”ì²œ?´ì£¼?¸ìš”.
ì¡°ê±´:
- ê°??œë™ëª…ì? 10ê¸€???´ë‚´
- ?ˆì‚°??5~25% ?˜ì???ë¹„ìš©
- ?„ì‹¤?ì¸ ?¼ìƒ ?œë™ (?ì‚¬, ?Œë£Œ, ?¼í•‘, ?°ì±… ??
- ?¹ìˆ˜ë¬¸ì(#, &, ~, %, ^, /) ?¬ìš© ê¸ˆì?

ë°˜ë“œ??JSON?¼ë¡œë§??‘ë‹µ:
{"a": "?œë™ëª…A", "b": "?œë™ëª…B"}`,
      },
      { role: 'user', content: '?¤ëŠ˜ ?????ˆëŠ” ?œë™??ì¶”ì²œ?´ì¤˜.' },
    ])
    const r = result as { a: string; b: string }
    return { success: true, data: { a: r.a, b: r.b } }
  } catch (error: any) {
    console.error('?œë™ ì¶”ì²œ ?¤ë¥˜:', error)
    return { success: false, error: error.message }
  }
}

/**
 * ?¨ê³„ 2: ? íƒ???œë™Â·?”ì•¡ ê¸°ë°˜ ë°©ë²•Â·ë¹„ìš© 2ê°€ì§€ ì¶”ì²œ
 */
export async function suggestMethodOptions(
  activity: string,
  balance: number
): Promise<{ success: boolean; data?: { a: string; b: string; a_cost: number; b_cost: number }; error?: string }> {
  try {
    const result = await callOpenAI([
      {
        role: 'system',
        content: `?¹ì‚¬?ê? ?¤ëŠ˜ "${activity}"??ë¥? ?˜ë ¤ê³??©ë‹ˆ??
?´ë²ˆ ???¨ì? ?ˆì‚°?€ ${balance.toLocaleString()}?ì…?ˆë‹¤.

???œë™???˜ëŠ” 2ê°€ì§€ ë°©ë²•??ì¶”ì²œ?´ì£¼?¸ìš”.
ì¡°ê±´:
- ë°©ë²• A: ??ê°„ë‹¨?˜ê±°???€?´í•œ ë°©ë²•
- ë°©ë²• B: ì¡°ê¸ˆ ?¤ë¥¸ ë°©ë²• (ë¹„ìš©???¬ë¼???©ë‹ˆ??
- ê°??¤ëª…?€ 15ê¸€???´ë‚´
- ?ˆìƒ ë¹„ìš©?€ ?„ë¼ë¹„ì•„?«ì(??ë¡??œì‹œ

ë°˜ë“œ??JSON?¼ë¡œë§??‘ë‹µ:
{"a": "ë°©ë²• ?¤ëª…", "b": "ë°©ë²• ?¤ëª…", "a_cost": 5000, "b_cost": 7000}`,
      },
      { role: 'user', content: `${activity}??ë¥? ?´ë–»ê²??˜ë©´ ì¢‹ì„ì§€ ì¶”ì²œ?´ì¤˜.` },
    ])
    const r = result as { a: string; b: string; a_cost: number; b_cost: number }
    return {
      success: true,
      data: {
        a: r.a,
        b: r.b,
        a_cost: Number(r.a_cost) || 5000,
        b_cost: Number(r.b_cost) || 10000,
      },
    }
  } catch (error: any) {
    console.error('ë°©ë²• ì¶”ì²œ ?¤ë¥˜:', error)
    return { success: false, error: error.message }
  }
}

/**
 * ?¹ì‚¬?ì˜ ê³„íš??DB???€??
 */
export async function savePlan({
  participantId,
  activityName,
  date,
  options,
  selectedOptionIndex,
  details,
  place_name,
  place_lat,
  place_lng,
}: {
  participantId: string
  activityName: string
  date: string
  options: PlanOption[]
  selectedOptionIndex: number
  details?: PlanContext
  place_name?: string | null
  place_lat?: number | null
  place_lng?: number | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // ?¹ì‚¬?ëŠ” profiles ?Œì´ë¸”ì— ?‰ì´ ?†ìœ¼ë¯€ë¡?creator_id FK ?„ë°˜ ë°©ì?
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()
  const creator_id = profile ? user.id : null

  const { error } = await supabase.from('plans').insert({
    participant_id: participantId,
    activity_name: activityName,
    date,
    options,
    selected_option_index: selectedOptionIndex,
    creator_id,
    details: details || null,
    place_name: place_name ?? null,
    place_lat: place_lat ?? null,
    place_lng: place_lng ?? null,
  })

  if (error) {
    console.error('Plan save error:', error)
    throw new Error('ê³„íš ?€?¥ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.')
  }

  revalidatePath('/plan')
  return { success: true }
}

/**
 * ?¹ì‚¬?ì˜ ?€?¥ëœ ê³„íš ëª©ë¡ ì¡°íšŒ
 */
export async function getParticipantPlans(participantId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('participant_id', participantId)
    .order('date', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Plan fetch error:', error)
    return []
  }

  return data || []
}
