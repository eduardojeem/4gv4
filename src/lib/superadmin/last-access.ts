/**
 * Cuándo entró por última vez alguien de la organización.
 *
 * La ficha decía cuánto factura, pero no si todavía usan el sistema: una
 * empresa que dejó de entrar hace tres meses se veía igual que una que entró
 * hoy. El dato vive en `auth.users.last_sign_in_at`.
 */

const DAY = 24 * 60 * 60 * 1000

/** Más de un mes sin entrar: vale la pena llamarlos. */
export const STALE_ACCESS_DAYS = 30

export type LastAccess = {
  label: string
  /** `true` cuando nunca entró o hace más de un mes que no entra. */
  stale: boolean
}

export function describeLastAccess(value: string | null | undefined, now = Date.now()): LastAccess {
  const time = value ? new Date(value).getTime() : Number.NaN
  if (!Number.isFinite(time)) return { label: 'Nunca entró', stale: true }

  const days = Math.floor(Math.max(0, now - time) / DAY)
  const stale = days > STALE_ACCESS_DAYS

  if (days === 0) return { label: 'Hoy', stale }
  if (days === 1) return { label: 'Ayer', stale }
  if (days < 30) return { label: `Hace ${days} días`, stale }
  const months = Math.floor(days / 30)
  if (months < 12) return { label: `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`, stale }
  const years = Math.floor(days / 365)
  return { label: `Hace ${years} ${years === 1 ? 'año' : 'años'}`, stale }
}

export type TeamAccessSummary = {
  /** El acceso más reciente de cualquiera del equipo. */
  lastAccessAt: string | null
  /** Cuántos entraron en los últimos 7 días. */
  activeLastWeek: number
  /** Cuántos nunca entraron (típicamente, invitaciones sin usar). */
  neverSignedIn: number
}

export function summarizeTeamAccess(
  lastSignIns: Array<string | null | undefined>,
  now = Date.now(),
): TeamAccessSummary {
  let lastAccessAt: string | null = null
  let lastTime = -Infinity
  let activeLastWeek = 0
  let neverSignedIn = 0

  for (const value of lastSignIns) {
    const time = value ? new Date(value).getTime() : Number.NaN
    if (!Number.isFinite(time)) {
      neverSignedIn += 1
      continue
    }
    if (time > lastTime) {
      lastTime = time
      lastAccessAt = value as string
    }
    if (now - time <= 7 * DAY) activeLastWeek += 1
  }

  return { lastAccessAt, activeLastWeek, neverSignedIn }
}
