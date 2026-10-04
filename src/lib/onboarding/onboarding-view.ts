/**
 * Lo que muestra la configuración inicial (/admin/onboarding), sin React:
 * estado de la suscripción, módulos sugeridos según el plan, y cómo se
 * limpian los usuarios de redes.
 */

export type SubscriptionInfo = {
  plan: string
  status: string
  trialEndsAt: string | null
  currentPeriodEndsAt?: string | null
} | null

export type SubscriptionSummary = {
  label: string
  tone: 'ok' | 'trial' | 'warning' | 'danger'
  /** «Prueba hasta 15 oct 2026», «Se renueva el …», o null si no hay fecha que mostrar. */
  dateLabel: string | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

/**
 * Antes todo lo que no fuera «active» se mostraba como «Período de prueba» y
 * la fecha era siempre la del fin de la prueba, aunque ya estuviera pagando.
 */
export function subscriptionSummary(subscription: SubscriptionInfo): SubscriptionSummary {
  const status = (subscription?.status ?? '').toLowerCase()
  const trialEnd = formatDate(subscription?.trialEndsAt)
  const periodEnd = formatDate(subscription?.currentPeriodEndsAt)
  switch (status) {
    case 'active':
      return { label: 'Suscripción activa', tone: 'ok', dateLabel: periodEnd ? `Se renueva el ${periodEnd}` : null }
    case 'trialing':
    case 'trial':
      return { label: 'Período de prueba', tone: 'trial', dateLabel: trialEnd ? `Prueba hasta el ${trialEnd}` : null }
    case 'past_due':
    case 'unpaid':
      return { label: 'Pago pendiente', tone: 'warning', dateLabel: periodEnd ? `Venció el ${periodEnd}` : null }
    case 'canceled':
    case 'cancelled':
      return { label: 'Suscripción cancelada', tone: 'danger', dateLabel: periodEnd ? `Activa hasta el ${periodEnd}` : null }
    case 'suspended':
    case 'expired':
      return { label: 'Suscripción vencida', tone: 'danger', dateLabel: null }
    default:
      return trialEnd
        ? { label: 'Período de prueba', tone: 'trial', dateLabel: `Prueba hasta el ${trialEnd}` }
        : { label: 'Plan gratuito', tone: 'ok', dateLabel: null }
  }
}

/**
 * Lo que el servidor va a activar son solo los módulos sugeridos que el plan
 * incluye (o está probando). La pantalla mostraba todos como si vinieran.
 */
export function splitSuggestedModules<T extends string>(suggested: readonly T[], entitled: readonly string[] | null) {
  if (!entitled) return { included: [...suggested], notIncluded: [] as T[] }
  const allowed = new Set(entitled)
  return {
    included: suggested.filter((module) => allowed.has(module)),
    notIncluded: suggested.filter((module) => !allowed.has(module)),
  }
}

/** Negocios que venden turnos y servicios más que productos. */
export function isServiceFocused(vertical: string | null | undefined, operatingModel: string | null | undefined) {
  return vertical === 'barbershop' || operatingModel === 'service'
}

const SOCIAL_PREFIX: Record<'instagram' | 'facebook' | 'tiktok', RegExp> = {
  instagram: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i,
  facebook: /^(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook|fb)\.com\//i,
  tiktok: /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@?/i,
}

/**
 * Del enlace pegado o del «@usuario» queda solo el usuario: el campo ya
 * muestra «instagram.com/» delante y se veía duplicado.
 */
export function socialHandle(value: string, platform: 'instagram' | 'facebook' | 'tiktok') {
  return value
    .trim()
    .replace(SOCIAL_PREFIX[platform], '')
    .replace(/^@/, '')
    // Facebook tiene perfiles «profile.php?id=…»: ahí solo se saca la barra final.
    .replace(platform === 'facebook' ? /\/+$/ : /[/?#].*$/, '')
}
