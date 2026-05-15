/** profiles.role 비교용 (대소문자·공백 무시) */
export function normalizeRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase()
}

export function isAdminRole(role: unknown): boolean {
  const r = normalizeRole(role)
  return r === 'admin' || r === 'superadmin' || r === 'super_admin'
}

export function isSupporterRole(role: unknown): boolean {
  return normalizeRole(role) === 'supporter'
}

/** 지원자 또는 관리자(슈퍼관리자 포함) */
export function isStaffRole(role: unknown): boolean {
  return isSupporterRole(role) || isAdminRole(role)
}
