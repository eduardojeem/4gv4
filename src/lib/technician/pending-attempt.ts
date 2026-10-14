export type PendingTechnicianAttempt = { key: string; body: string; scope: string; fresh: boolean }
type Kind = 'payment' | 'compensation'
const storageKey = (scope: string, kind: Kind) => `technician-attempt:v1:${kind}:${scope}`

export function readTechnicianAttempt(scope: string, kind: Kind): PendingTechnicianAttempt | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(storageKey(scope, kind))
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (value.scope !== scope || typeof value.body !== 'string' || value.body.length > 8000
      || typeof value.key !== 'string' || !/^[a-zA-Z0-9:_-]{8,120}$/.test(value.key)) throw new Error('invalid attempt')
    JSON.parse(value.body)
    return { key: value.key, body: value.body, scope, fresh: false }
  } catch {
    throw new Error('Hay una solicitud pendiente que no se puede recuperar. Revisá el historial antes de registrar otra.')
  }
}
export function persistTechnicianAttempt(attempt: PendingTechnicianAttempt, kind: Kind) {
  // The key is persisted BEFORE dispatch; restored attempts have an uncertain outcome.
  window.sessionStorage.setItem(storageKey(attempt.scope, kind), JSON.stringify({ ...attempt, fresh: false }))
}
export function clearTechnicianAttempt(scope: string, kind: Kind) {
  window.sessionStorage.removeItem(storageKey(scope, kind))
}
