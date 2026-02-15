export type AppRole = 'admin' | 'vendedor' | 'tecnico' | 'cliente'

export function normalizeRole(raw?: string | null): AppRole | undefined {
  if (!raw) return undefined
  const r = raw.toLowerCase().trim()
  if (r === 'admin' || r === 'super_admin') return 'admin'
  if (r === 'vendedor' || r === 'employee' || r === 'manager') return 'vendedor'
  if (r === 'tecnico' || r === 'technician') return 'tecnico'
  if (r === 'cliente' || r === 'viewer' || r === 'client_normal' || r === 'mayorista' || r === 'client_mayorista') return 'cliente'
  return undefined
}

export function isWholesale(raw?: string | null): boolean {
  if (!raw) return false
  const r = raw.toLowerCase().trim()
  return r === 'mayorista' || r === 'client_mayorista'
}

