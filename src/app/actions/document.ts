'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * ?´ë¼?´ì–¸??ì§ì ‘ ?…ë¡œ?œìš© ?œëª… URL ë°œê¸‰
 * ?Œì¼?€ ë¸Œë¼?°ì? ??Supabase Storageë¡?ì§ì ‘ ?„ì†¡ (Vercel body limit ?°íšŒ)
 */
export async function getDocumentUploadUrl(
  participantId: string,
  originalFileName: string,
): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??' }

  // ??•  ?•ì¸ + supporter??ê²½ìš° ?´ë‹¹ ì°¸ì—¬?ë§Œ ?‘ê·¼ ?ˆìš©
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { error: 'ê¶Œí•œ???†ìŠµ?ˆë‹¤.' }
  }

  if (profile.role === 'supporter') {
    const { data: assigned } = await supabase
      .from('participants')
      .select('id')
      .eq('id', participantId)
      .eq('assigned_supporter_id', user.id)
      .single()
    if (!assigned) return { error: '?´ë‹¹ ì°¸ì—¬?ì— ?€???‘ê·¼ ê¶Œí•œ???†ìŠµ?ˆë‹¤.' }
  }

  const admin = createAdminClient()
  // Storage ê²½ë¡œ??ASCIIë§??ˆìš© ???•ì¥?ë§Œ ì¶”ì¶œ?˜ê³  ?€?„ìŠ¤?¬í”„ë¡?ê³ ìœ ??ë³´ì¥
  const ext = (originalFileName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const filePath = `${participantId}/${Date.now()}${ext ? '.' + ext : ''}`

  const { data, error } = await admin.storage
    .from('documents')
    .createSignedUploadUrl(filePath)

  if (error) return { error: '?…ë¡œ??URL ?ì„± ?¤íŒ¨: ' + error.message }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path }
}

/**
 * ?´ë¼?´ì–¸??ì§ì ‘ ?…ë¡œ???„ë£Œ ??DB ?ˆì½”???€??
 */
export async function saveDocumentRecord(
  participantId: string,
  title: string,
  fileType: string,
  filePath: string,
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??' }

  // ?œë²„ê°€ ë°œê¸‰??ê²½ë¡œ ?•ì‹?¸ì? ê²€ì¦?(ê²½ë¡œ ?„ë?ì¡?ë°©ì?)
  // ?•ì‹: {participantId}/{timestamp}.{ext}
  const expectedPrefix = `${participantId}/`
  if (!filePath.startsWith(expectedPrefix) || filePath.includes('..') || /[^a-zA-Z0-9/_.-]/.test(filePath)) {
    return { error: '?˜ëª»???Œì¼ ê²½ë¡œ?…ë‹ˆ??' }
  }

  const admin = createAdminClient()
  const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

  const { error } = await admin.from('file_links').insert({
    participant_id: participantId,
    title,
    url: publicUrl,
    file_type: fileType,
  })

  if (error) return { error: 'DB ?€???¤íŒ¨: ' + error.message }

  revalidatePath('/supporter/documents')
  return { success: true }
}

export async function uploadDocument(formData: FormData) {
  // ?¸ì¦ ?•ì¸?€ ?¬ìš©???¸ì…˜ ?´ë¼?´ì–¸?¸ë¡œ
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??')

  const participantId = formData.get('participant_id') as string
  const title = formData.get('title') as string
  const fileType = formData.get('file_type') as string
  const file = formData.get('file') as File | null
  const externalUrl = formData.get('url') as string

  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

  let finalUrl = externalUrl

  // Storage ?…ë¡œ?œÂ·DB ?°ê¸°???œë¹„??ë¡??´ë¼?´ì–¸???¬ìš© (RLS ?°íšŒ)
  const admin = createAdminClient()

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`?Œì¼ ?©ëŸ‰??20MBë¥?ì´ˆê³¼?©ë‹ˆ?? (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const fileName = `${participantId}/${Date.now()}${ext ? '.' + ext : ''}`
    const mimeMap: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls:  'application/vnd.ms-excel',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc:  'application/msword',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt:  'application/vnd.ms-powerpoint',
      pdf:  'application/pdf',
      csv:  'text/csv',
      txt:  'text/plain',
      png:  'image/png',
      jpg:  'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
    }
    const contentType = file.type || mimeMap[ext] || 'application/octet-stream'

    // File ê°ì²´ë¥?Bufferë¡?ë³€??(?œë²„ ?˜ê²½?ì„œ ë¹„ì´ë¯¸ì? ?Œì¼???¤íŠ¸ë¦¬ë° ë¬¸ì œ ë°©ì?)
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(fileName, buffer, { upsert: true, contentType })

    if (uploadError) {
      throw new Error(`?Œì¼ ?…ë¡œ???¤íŒ¨ [${uploadError.message}] (?Œì¼: ${file.name}, ?€?? ${contentType}, ?¬ê¸°: ${file.size}B)`)
    }

    const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(fileName)
    finalUrl = publicUrl
  }

  if (!finalUrl) throw new Error('?Œì¼ ?ëŠ” ë§í¬ë¥??…ë ¥?´ì£¼?¸ìš”.')

  const { error } = await admin.from('file_links').insert({
    participant_id: participantId,
    title,
    url: finalUrl,
    file_type: fileType,
  })

  if (error) throw new Error('DB ?€???¤íŒ¨: ' + error.message)

  revalidatePath('/supporter/documents')
  return { success: true }
}

export async function deleteDocument(id: string) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') throw new Error('?°ëª¨ ëª¨ë“œ?ì„œ???? œ?????†ìŠµ?ˆë‹¤.')

  const admin = createAdminClient()

  const { error } = await admin.from('file_links').delete().eq('id', id)
  if (error) throw error

  revalidatePath('/supporter/documents')
  return { success: true }
}
