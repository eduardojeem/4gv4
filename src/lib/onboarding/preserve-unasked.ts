import { isKnownBrandColor } from '@/lib/website/brand-colors'

type CompanyInfo = Record<string, unknown> | null | undefined

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/**
 * El asistente compartido (web y app) no pregunta email, RUC, logo, WhatsApp,
 * redes ni si la tienda está publicada. Al finalizar, el endpoint completaba
 * esos campos con vacíos y la función de la base los guardaba: se borraba el
 * logo, el RUC o el email que el dueño hubiera cargado en Configuración o en
 * Sitio web mientras tanto, y la tienda volvía a quedar sin publicar.
 * Esto devuelve los valores que ya tiene la organización para mandarlos tal
 * cual.
 */
export function preservedSharedSetupFields(current: {
  adminSettings: { companyEmail?: string; companyRuc?: string }
  companyInfo: CompanyInfo
  organizationLogoUrl: string | null | undefined
  storefrontPublic: boolean
}) {
  const info = current.companyInfo ?? {}
  const hours = info.hours && typeof info.hours === 'object' && !Array.isArray(info.hours)
    ? info.hours as Record<string, unknown>
    : {}
  const email = text(current.adminSettings.companyEmail) || text(info.email)
  const logoUrl = text(current.organizationLogoUrl) || text(info.logoUrl)
  const brandColor = text(info.brandColor)
  return {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    ruc: text(current.adminSettings.companyRuc) || text(info.ruc),
    logoUrl: /^https?:\/\/\S+$/i.test(logoUrl) ? logoUrl : '',
    whatsapp: text(info.whatsapp),
    instagram: text(info.instagram),
    facebook: text(info.facebook),
    tiktok: text(info.tiktok),
    businessType: text(info.businessType),
    saturday: text(hours.saturday),
    ...(isKnownBrandColor(brandColor) ? { brandColor } : {}),
    storefrontPublic: current.storefrontPublic,
  }
}
