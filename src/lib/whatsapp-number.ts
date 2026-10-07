/**
 * El número de WhatsApp de una tienda, con una sola regla para todo el sistema:
 * el campo WhatsApp y, si está vacío, el teléfono. Antes la carga inicial, la
 * modalidad de la tienda y el botón de cada producto decidían distinto si una
 * tienda «tenía WhatsApp».
 *
 * Sin dependencias del navegador: se usa en el servidor y en el cliente.
 */

/** Deja el número como lo pide wa.me: solo dígitos, con código de país. */
export function formatWhatsAppPhone(phone: string, defaultCountryCode = '595'): string {
  let cleaned = phone.replace(/\D/g, '')

  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }

  if (!cleaned.startsWith(defaultCountryCode)) {
    cleaned = defaultCountryCode + cleaned
  } else if (cleaned.startsWith(`${defaultCountryCode}0`)) {
    // Guardado como «595» + «0981…»: el 0 es del formato local y wa.me lo
    // rechaza. Hay números así cargados en las tiendas.
    cleaned = defaultCountryCode + cleaned.slice(defaultCountryCode.length + 1)
  }

  return cleaned
}

const VALID_WHATSAPP = /^[1-9]\d{9,14}$/

/** El número listo para wa.me (primero el WhatsApp, después el teléfono), o null si ninguno sirve. */
export function storeWhatsappNumber(company: { whatsapp?: string | null; phone?: string | null } | null | undefined): string | null {
  for (const raw of [company?.whatsapp, company?.phone]) {
    const value = raw?.trim() ?? ''
    if (value.replace(/\D/g, '').length < 6) continue
    const formatted = formatWhatsAppPhone(value)
    if (VALID_WHATSAPP.test(formatted)) return formatted
  }
  return null
}

export function hasStoreWhatsapp(company: { whatsapp?: string | null; phone?: string | null } | null | undefined): boolean {
  return storeWhatsappNumber(company) !== null
}
