/**
 * Invita a un cliente a la tienda pública: le manda un correo para que cree
 * su propia contraseña y queda vinculado a la organización.
 *
 * Reutiliza el endpoint que ya existía para el detalle del cliente. Se aisla
 * acá porque al invitar desde el alta hay un matiz importante: el cliente ya
 * quedó creado, así que un fallo de la invitación no puede reportarse como si
 * hubiera fallado el alta.
 */

export type InviteCustomerResult =
  | { status: 'sent'; message: string }
  | { status: 'already-linked'; message: string }
  | { status: 'failed'; message: string }

/** El endpoint responde 409 cuando el cliente ya tenía cuenta vinculada. */
const ALREADY_LINKED_PATTERN = /ya tiene una cuenta vinculada/i

export async function inviteCustomerToStore(
  customerId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InviteCustomerResult> {
  if (!customerId) {
    return { status: 'failed', message: 'No se pudo identificar al cliente recién creado.' }
  }

  try {
    const response = await fetchImpl(`/api/customers/${customerId}/create-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // sendInvite: el cliente elige su contraseña desde el correo, en vez de
      // que le generemos una temporal que alguien tendría que transmitirle.
      body: JSON.stringify({ sendInvite: true }),
    })

    const data = await response.json().catch(() => null) as
      | { success?: boolean; message?: string; error?: string; action?: string }
      | null

    if (!response.ok || !data?.success) {
      const message = data?.error || 'No se pudo enviar la invitación.'
      if (ALREADY_LINKED_PATTERN.test(message)) {
        return { status: 'already-linked', message }
      }
      return { status: 'failed', message }
    }

    return {
      status: 'sent',
      message: data.message || 'Se envió la invitación por correo.',
    }
  } catch {
    return {
      status: 'failed',
      message: 'No se pudo contactar al servidor para enviar la invitación.',
    }
  }
}

/** Si tiene sentido ofrecer la invitación con lo cargado hasta ahora. */
export function canInviteCustomer(email: string | null | undefined) {
  const trimmed = (email ?? '').trim()
  if (trimmed.length === 0) return false
  // Chequeo mínimo: el endpoint valida en serio, esto solo evita ofrecer la
  // opción sobre algo que claramente no es un correo.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}
