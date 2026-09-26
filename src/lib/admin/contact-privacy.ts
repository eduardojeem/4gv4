/**
 * Los datos de contacto de un cliente no se muestran de entrada.
 *
 * La lista de usuarios mostraba el correo y el teléfono de cada cliente de la
 * tienda a cualquier persona del equipo con acceso al panel, en pantalla y en
 * cada respuesta de la API. Son datos personales de gente que solo compró: se
 * muestran tapados y quien necesita uno lo pide, y esa consulta queda
 * registrada.
 */

export const CONTACT_REVEAL_ACTION = 'reveal_customer_contact'

/** `ana@gmail.com` → `an•••@gmail.com`. Se conserva el dominio. */
export function maskEmail(value: string | null | undefined): string {
  const email = String(value ?? '').trim()
  if (!email) return ''

  const at = email.lastIndexOf('@')
  if (at <= 0) return '•••'

  const user = email.slice(0, at)
  const domain = email.slice(at + 1)
  const visible = user.slice(0, user.length <= 2 ? 1 : 2)
  return `${visible}•••@${domain}`
}

/** `0985 796 523` → `••• 523`: alcanza para reconocer al cliente que llamó. */
export function maskPhone(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 3) return '•••'
  return `••• ${digits.slice(-3)}`
}

export type MaskableContact = { role?: string | null; email?: string | null; phone?: string | null }

/** Un cliente de la tienda: no es parte del equipo. */
export function isCustomerRole(role: string | null | undefined): boolean {
  const normalized = String(role ?? '').trim().toLowerCase()
  return normalized === 'cliente' || normalized === 'customer'
}

/**
 * Tapa el contacto cuando la fila es de un cliente. Devuelve el mismo objeto si
 * no hay nada que tapar, así el resto del código no cambia.
 */
export function maskCustomerContact<T extends MaskableContact>(user: T): T & { contactMasked?: boolean } {
  if (!isCustomerRole(user.role)) return user
  if (!user.email && !user.phone) return { ...user, contactMasked: true }

  return {
    ...user,
    email: maskEmail(user.email),
    phone: maskPhone(user.phone),
    contactMasked: true,
  }
}
