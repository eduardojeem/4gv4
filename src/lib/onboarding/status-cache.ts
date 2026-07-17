/**
 * Cache client-side del estado de onboarding (/api/onboarding/status).
 *
 * Lo consumen DashboardGuard y el sidebar: comparte una única llamada en vuelo
 * y cachea el resultado terminal (no necesita onboarding) en sessionStorage,
 * de modo que las recargas dentro de la misma pestaña no repitan el fetch ni
 * bloqueen el render con un loader.
 */

export interface OnboardingStatusPayload {
  needsOnboarding?: boolean
  completed?: boolean
}

const STORAGE_KEY = 'onboarding-status-v1'

let cached: OnboardingStatusPayload | null = null
let inflight: Promise<OnboardingStatusPayload | null> | null = null

export function getCachedOnboardingStatus(): OnboardingStatusPayload | null {
  if (cached) return cached
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) cached = JSON.parse(raw) as OnboardingStatusPayload
  } catch {
    /* storage no disponible o JSON corrupto: se ignora */
  }
  return cached
}

export function clearOnboardingStatusCache() {
  cached = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatusPayload | null> {
  const hit = getCachedOnboardingStatus()
  if (hit) return hit

  if (!inflight) {
    inflight = fetch('/api/onboarding/status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as OnboardingStatusPayload
      })
      .then((payload) => {
        // Solo se cachea el estado terminal: si aún necesita onboarding, el
        // próximo montaje debe re-consultar (el usuario pudo completarlo).
        if (payload && !payload.needsOnboarding) {
          cached = payload
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
          } catch {
            /* ignore */
          }
        }
        return payload
      })
      .catch(() => null)
      .finally(() => {
        inflight = null
      })
  }

  return inflight
}
