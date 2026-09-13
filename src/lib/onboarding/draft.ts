/**
 * Borrador de la configuracion inicial.
 *
 * El onboarding guarda una sola vez, al final, y son tres pestañas de campos:
 * si el navegador se cerraba a mitad, se perdia todo lo cargado. El borrador
 * vive en el equipo de quien lo escribe —no viaja al servidor— y se borra
 * apenas se guarda de verdad.
 */

export type OnboardingDraft = {
  form: Record<string, unknown>
  countryCode: string
  localPhone: string
  savedAt: string
}

/** Una semana: un borrador mas viejo que eso ya no representa lo que queria hacer. */
export const ONBOARDING_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function onboardingDraftKey(organizationId: string) {
  return `onboarding:borrador:${organizationId}`
}

export function isDraftFresh(draft: OnboardingDraft, now: Date): boolean {
  const savedAt = Date.parse(draft.savedAt)
  if (Number.isNaN(savedAt)) return false
  return now.getTime() - savedAt <= ONBOARDING_DRAFT_MAX_AGE_MS
}

/** Un borrador solo sirve si difiere de lo ya guardado; si no, no hay nada que retomar. */
export function isDraftWorthRestoring(
  draft: OnboardingDraft | null,
  savedForm: unknown,
  now: Date,
): boolean {
  if (!draft || !draft.form || typeof draft.form !== 'object') return false
  if (!isDraftFresh(draft, now)) return false
  return JSON.stringify(draft.form) !== JSON.stringify(savedForm)
}

export function readOnboardingDraft(organizationId: string): OnboardingDraft | null {
  try {
    const raw = window.localStorage.getItem(onboardingDraftKey(organizationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnboardingDraft
    return parsed && typeof parsed === 'object' && parsed.form ? parsed : null
  } catch {
    // Navegador sin almacenamiento o borrador corrupto: se sigue sin borrador.
    return null
  }
}

export function writeOnboardingDraft(organizationId: string, draft: OnboardingDraft): void {
  try {
    window.localStorage.setItem(onboardingDraftKey(organizationId), JSON.stringify(draft))
  } catch {
    // Sin almacenamiento no hay borrador; no es motivo para romper el formulario.
  }
}

export function clearOnboardingDraft(organizationId: string): void {
  try {
    window.localStorage.removeItem(onboardingDraftKey(organizationId))
  } catch {
    // Nada que hacer.
  }
}
