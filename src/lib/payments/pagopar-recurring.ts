import { createHash } from 'crypto'
import { isPagoparConfigured } from '@/lib/payments/pagopar'

/**
 * Catastro de tarjetas y débito sin acción del usuario (API "pago-recurrente"
 * 3.0 de Pagopar). Requiere que Pagopar habilite la funcionalidad por contrato,
 * por eso además de las claves se exige PAGOPAR_RECURRING_ENABLED=true.
 *
 * Referencia: "Catastro de tarjetas - Pagos recurrentes - Preautorización"
 * de la documentación de Pagopar. Pagopar ahora opera con la marca uPay: el
 * viejo soporte.pagopar.com ya no existe y el soporte es soporte@upay.com.py;
 * la API y el checkout siguen en pagopar.com.
 */

const PAGOPAR_RECURRING_BASE_URL = 'https://api.pagopar.com/api/pago-recurrente/3.0'
const PAGOPAR_UPAY_IFRAME_URL = 'https://www.pagopar.com/upay-iframe/'
const PAGOPAR_RECURRING_TIMEOUT_MS = 15_000

export type PagoparCardProvider = 'uPay' | 'Bancard'

export type PagoparSavedCard = {
  cardId: string
  masked: string
  brand: string | null
  issuer: string | null
  cardType: string | null
  provider: string | null
  /** Hash temporal (15 minutos) para pagar o eliminar la tarjeta. */
  aliasToken: string
}

export class PagoparRecurringError extends Error {
  /** rejected: Pagopar respondió y dijo que no (no un timeout ni un error de red). */
  constructor(message: string, readonly endpoint: string, readonly rejected = false) {
    super(message)
    this.name = 'PagoparRecurringError'
  }
}

type PagoparRecurringPayload = {
  respuesta?: boolean
  resultado?: unknown
}

type PagoparCardItem = {
  tarjeta?: string | number | null
  tarjeta_numero?: string | null
  marca?: string | null
  emisor?: string | null
  alias_token?: string | null
  proveedor?: string | null
  tipo_tarjeta?: string | null
}

export function isPagoparRecurringEnabled() {
  return isPagoparConfigured() && process.env.PAGOPAR_RECURRING_ENABLED === 'true'
}

export function getPagoparRecurringToken(privateKey: string) {
  return createHash('sha1').update(`${privateKey}PAGO-RECURRENTE`).digest('hex')
}

export function getUpayCardFormUrl(formId: string) {
  return `${PAGOPAR_UPAY_IFRAME_URL}?id-form=${encodeURIComponent(formId)}`
}

function credentials() {
  const publicKey = process.env.PAGOPAR_PUBLIC_KEY
  const privateKey = process.env.PAGOPAR_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new PagoparRecurringError('Pagopar no está configurado.', 'config')
  }
  return { token: getPagoparRecurringToken(privateKey), token_publico: publicKey }
}

function sanitizeMessage(value: unknown) {
  if (typeof value !== 'string') return null
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim()
  if (!clean || /<\/?[a-z][\s\S]*>/i.test(clean)) return null
  return clean.slice(0, 200)
}

async function post(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAGOPAR_RECURRING_TIMEOUT_MS)

  try {
    const response = await fetch(`${PAGOPAR_RECURRING_BASE_URL}/${endpoint}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...credentials(), ...body }),
      cache: 'no-store',
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null) as PagoparRecurringPayload | null

    if (!response.ok || !payload) {
      throw new PagoparRecurringError(`Pagopar respondió con un error (${response.status}).`, endpoint)
    }
    if (payload.respuesta !== true) {
      throw new PagoparRecurringError(
        sanitizeMessage(payload.resultado) || 'Pagopar rechazó la operación.',
        endpoint,
        true,
      )
    }
    return payload.resultado
  } catch (error) {
    if (error instanceof PagoparRecurringError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new PagoparRecurringError('Pagopar tardó demasiado en responder.', endpoint)
    }
    throw new PagoparRecurringError('No se pudo conectar con Pagopar.', endpoint)
  } finally {
    clearTimeout(timeout)
  }
}

export async function addPagoparCustomer(params: {
  customerId: number
  name: string
  email: string
  phone: string
}) {
  await post('agregar-cliente', {
    identificador: params.customerId,
    nombre_apellido: params.name,
    email: params.email,
    celular: params.phone,
  })
}

/** Devuelve el id del formulario que se muestra en el iframe de uPay. */
export async function startPagoparCardForm(params: {
  customerId: number
  returnUrl: string
  provider: PagoparCardProvider
}) {
  const result = await post('agregar-tarjeta', {
    url: params.returnUrl,
    proveedor: params.provider,
    identificador: params.customerId,
  })
  if (typeof result !== 'string' || !result.trim()) {
    throw new PagoparRecurringError('Pagopar no devolvió el formulario de la tarjeta.', 'agregar-tarjeta')
  }
  return result.trim()
}

/** Obligatorio al volver del formulario, se haya guardado la tarjeta o no. */
export async function confirmPagoparCards(params: { customerId: number; returnUrl: string }) {
  await post('confirmar-tarjeta', {
    url: params.returnUrl,
    identificador: params.customerId,
  })
}

export function parsePagoparCards(result: unknown): PagoparSavedCard[] {
  if (!Array.isArray(result)) return []
  return (result as PagoparCardItem[])
    .filter((item) => typeof item?.alias_token === 'string' && item.alias_token.length > 0)
    .map((item) => ({
      cardId: String(item.tarjeta ?? ''),
      masked: item.tarjeta_numero?.trim() || '',
      brand: item.marca?.trim() || null,
      issuer: item.emisor?.trim() || null,
      cardType: item.tipo_tarjeta?.trim() || null,
      provider: item.proveedor?.trim() || null,
      aliasToken: item.alias_token as string,
    }))
}

export async function listPagoparCards(customerId: number) {
  try {
    return parsePagoparCards(await post('listar-tarjeta', { identificador: customerId }))
  } catch (error) {
    // Un cliente que nunca guardó tarjetas no existe todavía en Pagopar.
    if (error instanceof PagoparRecurringError && /no existe comprador/i.test(error.message)) return []
    throw error
  }
}

export async function deletePagoparCard(params: { customerId: number; aliasToken: string }) {
  await post('eliminar-tarjeta', {
    tarjeta: params.aliasToken,
    identificador: params.customerId,
  })
}

/** Debita un pedido ya creado con iniciar-transaccion usando la tarjeta guardada. */
export async function payPagoparOrderWithCard(params: {
  customerId: number
  aliasToken: string
  orderHash: string
}) {
  await post('pagar', {
    hash_pedido: params.orderHash,
    tarjeta: params.aliasToken,
    identificador: params.customerId,
  })
}

/** Elige la tarjeta a debitar: la guardada (por número enmascarado) o la primera del proveedor. */
export function pickPagoparCard(
  cards: PagoparSavedCard[],
  preferred: { masked?: string | null; provider?: string | null },
) {
  const sameProvider = preferred.provider
    ? cards.filter((card) => card.provider?.toLowerCase() === preferred.provider?.toLowerCase())
    : cards
  return sameProvider.find((card) => preferred.masked && card.masked === preferred.masked)
    || sameProvider[0]
    || null
}
