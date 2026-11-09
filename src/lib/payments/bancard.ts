import { createHash, timingSafeEqual } from 'crypto'

/**
 * Cliente de Bancard vPOS 2.0 (API 0.3) para cobrar la suscripción.
 *
 * - Pago único (single_buy): se crea la operación en el servidor, Bancard
 *   devuelve un process_id y el navegador muestra el iframe de Bancard
 *   (bancard-checkout.js) en /admin/subscriptions/pagar.
 * - Confirmación: Bancard llama al webhook /api/payments/bancard/webhook (URL
 *   configurada en el portal de comercios). Además se puede consultar con
 *   get_confirmation, que es lo que usan la página de retorno y la conciliación.
 * - Tarjetas guardadas (cards/new, users/{id}/cards, charge): débito automático.
 *   Bancard las habilita por contrato; ver BANCARD_RECURRING_ENABLED.
 *
 * Todos los tokens son md5 de la clave privada concatenada con los datos de la
 * operación, como indica la documentación de vPOS 2.0.
 */

const BANCARD_BASE_URLS = {
  staging: 'https://vpos.infonet.com.py:8888',
  production: 'https://vpos.infonet.com.py',
} as const
const BANCARD_API_PATH = '/vpos/api/0.3'
const BANCARD_TIMEOUT_MS = 15_000
const BANCARD_CHECKOUT_SCRIPT_VERSION = '4.0.0'

export type BancardEnvironment = keyof typeof BANCARD_BASE_URLS

export type BancardOrderDisplayStatus = 'approved' | 'pending' | 'rejected' | 'cancelled' | 'processing'

export type BancardConfirmation = {
  shopProcessId: string
  /** 'S' aprobada, 'N' rechazada. */
  response: string | null
  responseCode: string | null
  responseDetails: string | null
  responseDescription: string | null
  amount: number | null
  currency: string | null
  authorizationNumber: string | null
  ticketNumber: string | null
}

export type BancardOrderStatusResult = {
  shopProcessId: string
  status: BancardOrderDisplayStatus
  amount: number | null
  authorizationNumber: string | null
  ticketNumber: string | null
  message: string | null
}

export type BancardSavedCard = {
  cardId: string
  masked: string
  brand: string | null
  cardType: string | null
  expiration: string | null
  /** Token temporal: se pide de nuevo antes de cada cobro o baja. */
  aliasToken: string
}

export class BancardError extends Error {
  /** rejected: Bancard respondió y dijo que no (no un timeout ni un error de red). */
  constructor(
    message: string,
    readonly endpoint: string,
    readonly rejected = false,
    readonly key: string | null = null,
  ) {
    super(message)
    this.name = 'BancardError'
  }
}

type BancardMessage = { key?: string; level?: string; dsc?: string }

type BancardPayload = {
  status?: string
  process_id?: string
  messages?: BancardMessage[]
  confirmation?: Record<string, unknown>
  operation?: Record<string, unknown>
  cards?: unknown
}

function md5(value: string) {
  return createHash('md5').update(value).digest('hex')
}

export function getBancardEnvironment(): BancardEnvironment {
  return process.env.BANCARD_ENVIRONMENT === 'production' ? 'production' : 'staging'
}

export function getBancardBaseUrl() {
  return BANCARD_BASE_URLS[getBancardEnvironment()]
}

export function getBancardCheckoutScriptUrl() {
  return `${getBancardBaseUrl()}/checkout/javascript/dist/bancard-checkout-${BANCARD_CHECKOUT_SCRIPT_VERSION}.js`
}

export function isBancardConfigured() {
  return Boolean(process.env.BANCARD_PUBLIC_KEY && process.env.BANCARD_PRIVATE_KEY)
}

export function isBancardRecurringEnabled() {
  return isBancardConfigured() && process.env.BANCARD_RECURRING_ENABLED === 'true'
}

function credentials() {
  const publicKey = process.env.BANCARD_PUBLIC_KEY
  const privateKey = process.env.BANCARD_PRIVATE_KEY
  if (!publicKey || !privateKey) throw new BancardError('Bancard no está configurado.', 'config')
  return { publicKey, privateKey }
}

/** Bancard espera los montos como texto con dos decimales: "150000.00". */
export function formatBancardAmount(amount: number) {
  return (Math.round(amount * 100) / 100).toFixed(2)
}

export function getBancardAmountInPyg(amount: number, currency: string) {
  if (currency === 'PYG') return Math.round(amount)

  const usdToPyg = Number(process.env.BANCARD_USD_TO_PYG || '')
  if (currency === 'USD' && Number.isFinite(usdToPyg) && usdToPyg > 0) {
    return Math.round(amount * usdToPyg)
  }

  throw new Error(`La conversión de ${currency} a guaraníes para Bancard no está configurada.`)
}

export function isValidBancardShopProcessId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,15}$/.test(value)
}

export function isValidBancardProcessId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9*_\-.]{8,64}$/.test(value)
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const amount = Number(value.trim())
  return Number.isFinite(amount) ? amount : null
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const clean = String(value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim()
  if (!clean || /<\/?[a-z][\s\S]*>/i.test(clean)) return null
  return clean.slice(0, 300)
}

function firstMessage(payload: BancardPayload | null) {
  const message = Array.isArray(payload?.messages) ? payload.messages[0] : null
  return { key: text(message?.key), description: text(message?.dsc) }
}

export function parseBancardConfirmation(raw: unknown): BancardConfirmation | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const shopProcessId = text(record.shop_process_id)
  if (!shopProcessId) return null
  return {
    shopProcessId,
    response: text(record.response),
    responseCode: text(record.response_code),
    responseDetails: text(record.response_details),
    responseDescription: text(record.response_description),
    amount: parseAmount(record.amount),
    currency: text(record.currency),
    authorizationNumber: text(record.authorization_number),
    ticketNumber: text(record.ticket_number),
  }
}

export function isBancardConfirmationApproved(confirmation: Pick<BancardConfirmation, 'response' | 'responseCode'>) {
  return confirmation.response === 'S' && confirmation.responseCode === '00'
}

async function request(
  endpoint: string,
  path: string,
  operation: Record<string, unknown>,
  method: 'POST' | 'DELETE' = 'POST',
): Promise<BancardPayload> {
  const { publicKey } = credentials()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), BANCARD_TIMEOUT_MS)

  try {
    const response = await fetch(`${getBancardBaseUrl()}${BANCARD_API_PATH}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: publicKey, operation }),
      cache: 'no-store',
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null) as BancardPayload | null
    if (!payload) {
      throw new BancardError(`Bancard respondió con un error (${response.status}).`, endpoint)
    }
    // charge responde solo con { operation: {...} }, sin `status` (manual vPOS 2.0):
    // esa forma es una respuesta válida y el resultado está dentro de operation.
    const bareOperation = payload.status === undefined && Boolean(payload.operation) && response.ok
    if (payload.status !== 'success' && !bareOperation) {
      const message = firstMessage(payload)
      throw new BancardError(
        message.description || 'Bancard rechazó la operación.',
        endpoint,
        true,
        message.key,
      )
    }
    return payload
  } catch (error) {
    if (error instanceof BancardError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BancardError('Bancard tardó demasiado en responder.', endpoint)
    }
    throw new BancardError('No se pudo conectar con Bancard.', endpoint)
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Pago único
// ---------------------------------------------------------------------------

export function getBancardSingleBuyToken(privateKey: string, shopProcessId: string, amount: string, currency: string) {
  return md5(`${privateKey}${shopProcessId}${amount}${currency}`)
}

export function getBancardConfirmToken(privateKey: string, shopProcessId: string, amount: string, currency: string) {
  return md5(`${privateKey}${shopProcessId}confirm${amount}${currency}`)
}

export async function createBancardSingleBuy(input: {
  shopProcessId: string
  amountPyg: number
  description: string
  returnUrl: string
  cancelUrl: string
}) {
  const { privateKey } = credentials()
  const amount = formatBancardAmount(input.amountPyg)
  const payload = await request('single_buy', '/single_buy', {
    token: getBancardSingleBuyToken(privateKey, input.shopProcessId, amount, 'PYG'),
    shop_process_id: Number(input.shopProcessId),
    amount,
    currency: 'PYG',
    additional_data: '',
    description: input.description.slice(0, 20),
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
  })
  if (!isValidBancardProcessId(payload.process_id)) {
    throw new BancardError('Bancard no devolvió el proceso de pago.', 'single_buy')
  }
  return { processId: payload.process_id }
}

/** Valida el token que Bancard manda en la confirmación (webhook). */
export function validateBancardConfirmToken(params: {
  shopProcessId: string
  amount: string
  currency: string
  token: string
}) {
  const { privateKey } = credentials()
  const expected = Buffer.from(getBancardConfirmToken(privateKey, params.shopProcessId, params.amount, params.currency))
  const received = Buffer.from(params.token)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

/**
 * Consulta el resultado de un pago. Bancard responde error con
 * PaymentNotFoundError mientras la operación no se haya pagado.
 */
export async function getBancardConfirmation(shopProcessId: string): Promise<BancardConfirmation | null> {
  if (!isValidBancardShopProcessId(shopProcessId)) {
    throw new BancardError('El identificador del pago no tiene un formato válido.', 'get_confirmation')
  }
  const { privateKey } = credentials()
  try {
    const payload = await request('get_confirmation', '/single_buy/confirmations', {
      token: md5(`${privateKey}${shopProcessId}get_confirmation`),
      shop_process_id: Number(shopProcessId),
    })
    return parseBancardConfirmation(payload.confirmation ?? payload.operation)
  } catch (error) {
    if (error instanceof BancardError && error.rejected && /notfound|not_found/i.test(error.key || '')) return null
    throw error
  }
}

/**
 * Mientras Bancard no confirma, un pago es pendiente; pasado este plazo sin pago se
 * da por abandonado y se anula. El manual recomienda consultar a los 10 minutos:
 * se deja más margen para quien tarda con la verificación del banco.
 */
export const BANCARD_ABANDONED_AFTER_MS = 30 * 60 * 1000

export async function queryBancardPayment(
  shopProcessId: string,
  createdAt?: string | null,
  now = new Date(),
): Promise<BancardOrderStatusResult> {
  const confirmation = await getBancardConfirmation(shopProcessId)
  if (!confirmation) {
    const created = createdAt ? new Date(createdAt).getTime() : NaN
    const abandoned = Number.isFinite(created) && now.getTime() - created > BANCARD_ABANDONED_AFTER_MS
    return {
      shopProcessId,
      status: abandoned ? 'cancelled' : 'pending',
      amount: null,
      authorizationNumber: null,
      ticketNumber: null,
      message: null,
    }
  }
  return {
    shopProcessId,
    status: isBancardConfirmationApproved(confirmation) ? 'approved' : 'rejected',
    amount: confirmation.amount,
    authorizationNumber: confirmation.authorizationNumber,
    ticketNumber: confirmation.ticketNumber,
    // Solo la descripción de la respuesta: Bancard no permite mostrar al usuario
    // el código de respuesta ni la respuesta extendida.
    message: confirmation.responseDescription,
  }
}

export type BancardRollbackResult = 'rolled_back' | 'not_paid' | 'already_rolled_back'

/**
 * Anula un pedido (pagado o no). Bancard solo lo permite el mismo día, antes de
 * que impacte en el extracto: si ya está «cuponado» devuelve
 * TransactionAlreadyConfirmed y la devolución se pide desde el portal de
 * comercios (Soporte → Anulaciones).
 *
 * Según el manual, PaymentNotFoundError (nunca se pagó) es una respuesta correcta.
 */
export async function rollbackBancardPayment(shopProcessId: string): Promise<BancardRollbackResult> {
  const { privateKey } = credentials()
  try {
    await request('rollback', '/single_buy/rollback', {
      token: md5(`${privateKey}${shopProcessId}rollback0.00`),
      shop_process_id: Number(shopProcessId),
    })
    return 'rolled_back'
  } catch (error) {
    if (error instanceof BancardError && error.rejected) {
      if (error.key === 'PaymentNotFoundError') return 'not_paid'
      if (error.key === 'AlreadyRollbackedError') return 'already_rolled_back'
      if (error.key === 'TransactionAlreadyConfirmed') {
        throw new BancardError(
          'El cobro ya impactó en el extracto del cliente: pedí la anulación desde el portal de comercios de Bancard (Soporte → Anulaciones).',
          'rollback',
          true,
          error.key,
        )
      }
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Tarjetas guardadas (débito automático)
// ---------------------------------------------------------------------------

/** Devuelve el process_id del formulario de Bancard para catastrar una tarjeta. */
export async function startBancardCardRegistration(params: {
  userId: number
  cardId: number
  email: string
  phone: string
  returnUrl: string
}) {
  const { privateKey } = credentials()
  const payload = await request('cards_new', '/cards/new', {
    token: md5(`${privateKey}${params.cardId}${params.userId}request_new_card`),
    card_id: params.cardId,
    user_id: params.userId,
    user_cell_phone: params.phone,
    user_mail: params.email,
    return_url: params.returnUrl,
  })
  if (!isValidBancardProcessId(payload.process_id)) {
    throw new BancardError('Bancard no devolvió el formulario de la tarjeta.', 'cards_new')
  }
  return payload.process_id
}

export function parseBancardCards(raw: unknown): BancardSavedCard[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => typeof item.alias_token === 'string' && item.alias_token.length > 0)
    .map((item) => ({
      cardId: String(item.card_id ?? ''),
      masked: text(item.card_masked_number) || '',
      brand: text(item.card_brand),
      cardType: text(item.card_type),
      expiration: text(item.expiration_date),
      aliasToken: item.alias_token as string,
    }))
}

export async function listBancardCards(userId: number) {
  const { privateKey } = credentials()
  try {
    const payload = await request('users_cards', `/users/${userId}/cards`, {
      token: md5(`${privateKey}${userId}request_user_cards`),
    })
    return parseBancardCards(payload.cards)
  } catch (error) {
    // Un usuario que nunca guardó tarjetas todavía no existe en Bancard.
    if (error instanceof BancardError && error.rejected && /notfound|not_found|nocards/i.test(error.key || '')) return []
    throw error
  }
}

export async function deleteBancardCard(params: { userId: number; aliasToken: string }) {
  const { privateKey } = credentials()
  await request('delete_card', `/users/${params.userId}/cards`, {
    token: md5(`${privateKey}delete_card${params.userId}${params.aliasToken}`),
    alias_token: params.aliasToken,
  }, 'DELETE')
}

export type BancardChargeResult =
  | { kind: 'result'; confirmation: BancardConfirmation }
  /**
   * La tarjeta pide 3D Secure: no se cobró. El titular tiene que completar la
   * verificación en el iframe Bancard.Charge3DS con este process_id; el
   * resultado llega después a la URL de confirmación.
   */
  | { kind: 'requires_3ds'; processId: string }

/**
 * Debita con una tarjeta guardada. Devuelve la confirmación (aprobada o
 * rechazada por la tarjeta) o el pedido de 3D Secure. Un BancardError sin
 * `rejected` significa que no se sabe si se cobró: hay que consultar con
 * get_confirmation.
 */
export async function chargeBancardCard(params: {
  shopProcessId: string
  amountPyg: number
  aliasToken: string
  description: string
  /** Bancard lo exige: adónde vuelve el titular si la tarjeta pide 3D Secure. */
  returnUrl: string
}): Promise<BancardChargeResult> {
  const { privateKey } = credentials()
  const amount = formatBancardAmount(params.amountPyg)
  const payload = await request('charge', '/charge', {
    token: md5(`${privateKey}${params.shopProcessId}charge${amount}PYG${params.aliasToken}`),
    shop_process_id: Number(params.shopProcessId),
    amount,
    number_of_payments: 1,
    currency: 'PYG',
    additional_data: '',
    description: params.description.slice(0, 20),
    return_url: params.returnUrl,
    alias_token: params.aliasToken,
    // El manual pide enviarlo siempre: así la respuesta trae el process_id del flujo 3DS.
    extra_response_attributes: ['confirmation.process_id'],
  })
  const raw = (payload.operation ?? payload.confirmation) as Record<string, unknown> | undefined
  const threeDsProcessId = raw?.process_id
  if (isValidBancardProcessId(threeDsProcessId) && !text(raw?.response)) {
    return { kind: 'requires_3ds', processId: threeDsProcessId }
  }
  const confirmation = parseBancardConfirmation(raw)
  if (!confirmation) throw new BancardError('Bancard no devolvió el resultado del cobro.', 'charge')
  return { kind: 'result', confirmation }
}

/** Elige la tarjeta a debitar: la guardada (por número enmascarado) o la más reciente. */
export function pickBancardCard(cards: BancardSavedCard[], preferredMasked?: string | null) {
  if (preferredMasked) {
    const match = cards.find((card) => card.masked === preferredMasked)
    if (match) return match
  }
  return [...cards].sort((a, b) => Number(b.cardId) - Number(a.cardId))[0] ?? null
}
