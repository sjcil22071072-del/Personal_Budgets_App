/**
 * Storage 유틸리티
 * - Public URL에서 storage 경로 추출
 * - Private 버킷 전환 이후에도 경로 기반 signed URL 생성에 사용
 */

/**
 * DB에 저장된 public URL에서 storage 오브젝트 경로를 추출합니다.
 * 예) https://xxx.supabase.co/storage/v1/object/public/receipts/abc/123.jpg
 *  → "abc/123.jpg"
 */
export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  if (!publicUrl) return null
  
  let path: string | null = null

  // public 버킷 URL 형식
  const publicMarker = `/object/public/${bucket}/`
  const publicIdx = publicUrl.indexOf(publicMarker)
  if (publicIdx !== -1) {
    path = publicUrl.slice(publicIdx + publicMarker.length)
  } else {
    // authenticated 버킷 URL 형식 (이미 signed URL인 경우 등)
    const authMarker = `/object/authenticated/${bucket}/`
    const authIdx = publicUrl.indexOf(authMarker)
    if (authIdx !== -1) {
      path = publicUrl.slice(authIdx + authMarker.length)
    }
  }

  if (path) {
    // 쿼리 스트링(?token=...)이 존재하면 제거하여 순수 파일 경로만 반환
    const qIdx = path.indexOf('?')
    if (qIdx !== -1) {
      path = path.slice(0, qIdx)
    }
    return path
  }

  return null
}
