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
  
  // Supabase storage URL 구조에서 버킷명 뒤의 파일 상대 경로를 추출하는 정규식
  // 일반 Object API 포맷 및 Image Transformation (render/image) API 포맷 모두 매칭
  // /storage/v1/(object|render/image)/(public|authenticated|sign|auth)/bucket_name/ 파일경로
  const regex = new RegExp(`\\/storage\\/v1\\/(?:object|render\\/image)\\/(?:public|authenticated|sign|auth)\\/${bucket}\\/([^?#]+)`, 'i')
  const match = publicUrl.match(regex)
  
  if (match && match[1]) {
    try {
      // URL 인코딩 문자(%2F, %20 등)를 디코딩하여 순수한 파일 상대 경로 획득
      // Supabase JS Client는 내부적으로 createSignedUrl 등 호출 시 인코딩을 수행하므로 디코딩된 평문 경로를 넘겨야 함
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }

  // http 주소가 아니며 쿼리가 없는 상대경로인 경우 fallback 처리
  if (!publicUrl.startsWith('http://') && !publicUrl.startsWith('https://')) {
    const qIdx = publicUrl.indexOf('?')
    const cleanPath = qIdx !== -1 ? publicUrl.slice(0, qIdx) : publicUrl
    try {
      return decodeURIComponent(cleanPath)
    } catch {
      return cleanPath
    }
  }

  return null
}

/**
 * 임의의 storage URL(signed URL 또는 public URL 등)을 토큰이 없는 깨끗한 public URL 형태로 정제합니다.
 * DB 저장 전에 사용합니다.
 */
export function cleanStorageUrl(url: string, bucket: string): string {
  if (!url) return url
  const path = extractStoragePath(url, bucket)
  if (!path) return url

  const matchDomain = url.match(/^(https?:\/\/[^\/]+)/i)
  if (matchDomain) {
    const domain = matchDomain[1]
    const encodedPath = path
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/')
    return `${domain}/storage/v1/object/public/${bucket}/${encodedPath}`
  }
  return url
}

