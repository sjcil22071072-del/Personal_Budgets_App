export function normalizeRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase()
}

export function isAdminRole(role: unknown): boolean {
  const r = normalizeRole(role)
  return r === 'admin' || r === 'superadmin' || r === 'super_admin'
}

export function isSupporterRole(_role: unknown): boolean {
  void _role
  return false
}

export function isStaffRole(role: unknown): boolean {
  return isAdminRole(role)
}
