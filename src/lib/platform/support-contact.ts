/**
 * Contacto de soporte de la plataforma: lo define el superadmin en Marca SaaS
 * y lo ven los comercios en el panel, la landing y la baja de cuenta.
 *
 * Sin dependencias de servidor: lo usan el formulario, la API y los componentes.
 */

export const DEFAULT_SUPPORT_EMAIL = 'soporte@mitiendapy.com'
export const SUPPORT_HOURS_MAX_LENGTH = 80

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/

/** Correo en minúsculas o '' si no es un correo válido. */
export function normalizeSupportEmail(value: unknown): string {
  if (typeof value !== 'string') return ''
  const email = value.trim().toLowerCase()
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return ''
  return email
}

/**
 * Número en formato internacional (`+595981123456`) o '' si no sirve.
 * Acepta espacios, guiones, paréntesis y el prefijo `00`. Un número sin código
 * de país no se adivina: `wa.me` necesita el número completo.
 */
export function normalizeSupportWhatsapp(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/[^\d+\s().-]/.test(trimmed)) return ''
  let digits = trimmed.replace(/[\s().-]/g, '')
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (!digits.startsWith('+')) return ''
  const number = digits.slice(1)
  if (!/^[1-9]\d{7,14}$/.test(number)) return ''
  return `+${number}`
}

export function normalizeSupportHours(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, SUPPORT_HOURS_MAX_LENGTH)
}

/** Enlace `wa.me` para un número ya normalizado. */
export function supportWhatsappLink(whatsapp: string, message?: string): string | null {
  const normalized = normalizeSupportWhatsapp(whatsapp)
  if (!normalized) return null
  const base = `https://wa.me/${normalized.slice(1)}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

/** El número como se lee: `+595 981123456`. */
export function formatSupportWhatsapp(whatsapp: string): string {
  const normalized = normalizeSupportWhatsapp(whatsapp)
  if (!normalized) return ''
  // Paraguay es el caso habitual: separa el código de país para que se lea mejor.
  if (normalized.startsWith('+595')) return `+595 ${normalized.slice(4)}`
  return normalized
}

/**
 * El correo de soporte vigente: el del superadmin, si no las variables de
 * entorno y, por último, el de la marca.
 */
export function resolveSupportEmail(brandingEmail: unknown, env: Record<string, string | undefined> = process.env): string {
  return normalizeSupportEmail(brandingEmail)
    || normalizeSupportEmail(env.SUPPORT_EMAIL)
    || normalizeSupportEmail(env.EMAIL_REPLY_TO)
    || DEFAULT_SUPPORT_EMAIL
}

export type SupportContact = {
  email: string
  whatsapp: string
  whatsappUrl: string | null
  hours: string
}

export function buildSupportContact(
  branding: { supportEmail?: string; supportWhatsapp?: string; supportHours?: string },
  env?: Record<string, string | undefined>,
): SupportContact {
  const whatsapp = normalizeSupportWhatsapp(branding.supportWhatsapp)
  return {
    email: resolveSupportEmail(branding.supportEmail, env),
    whatsapp,
    whatsappUrl: supportWhatsappLink(whatsapp),
    hours: normalizeSupportHours(branding.supportHours),
  }
}
