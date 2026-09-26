import { createHash, randomUUID } from 'crypto'

const PAGOPAR_API_BASE_URL = 'https://api.pagopar.com/api'
const PAGOPAR_CHECKOUT_BASE_URL = 'https://www.pagopar.com/pagos'
const PAGOPAR_ORDER_QUERY_URL = `${PAGOPAR_API_BASE_URL}/pedidos/1.1/traer`
const PAGOPAR_QUERY_TIMEOUT_MS = 10_000
const PAGOPAR_CREATE_TIMEOUT_MS = 15_000

export type PagoparPaymentMethod = 'card' | 'qr'

const PAGOPAR_PAYMENT_METHOD_IDS: Record<PagoparPaymentMethod, number> = {
  card: 9,
  qr: 24,
}

type PagoparBuyer = {
  ruc?: string | null
  email?: string | null
  name?: string | null
  phone?: string | null
  address?: string | null
  document?: string | null
  businessName?: string | null
}

type CreatePagoparOrderInput = {
  amountPyg: number
  buyer: PagoparBuyer
  description: string
  externalReference: string
  itemId: number
  paymentMethod: PagoparPaymentMethod
  correlationId?: string
}

type PagoparCreateResponse = {
  checkoutUrl: string
  providerOrderId: string | null
  hash: string
  raw: unknown
}

export class PagoparOrderCreationError extends Error {
  constructor(
    message: string,
    readonly correlationId: string,
  ) {
    super(message)
    this.name = 'PagoparOrderCreationError'
  }
}

type PagoparCreatePayload = {
  respuesta?: boolean
  resultado?: unknown
}

type PagoparCreateLog = {
  correlationId: string
  event: 'success' | 'http_error' | 'timeout' | 'network_error'
  httpStatus: number | null
  contentType: string | null
  respuesta: boolean | null
  resultType: string
  resultMessage: string | null
  paymentMethodId: number
  amountPyg: number
  externalReference: string
  durationMs: number
}

type PagoparOrderQueryItem = {
  pagado?: boolean
  cancelado?: boolean
  fecha_pago?: string | null
  fecha_maxima_pago?: string | null
  forma_pago?: string | null
  hash_pedido?: string | null
  monto?: string | number | null
  numero_pedido?: string | number | null
  ultimo_mensaje_error?: string | null
  mensaje_resultado_pago?: {
    titulo?: string | null
    descripcion?: string | null
  } | null
}

export type PagoparOrderDisplayStatus = 'approved' | 'pending' | 'rejected' | 'cancelled' | 'processing'

export type PagoparOrderStatusResult = {
  hash: string
  amount: number
  providerOrderId: string | null
  paymentMethod: string | null
  paidAt: string | null
  maximumPaymentDate: string | null
  message: string | null
  status: PagoparOrderDisplayStatus
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function sha1(value: string) {
  return createHash('sha1').update(value).digest('hex')
}

export function isValidPagoparOrderHash(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9]{40,128}$/.test(value)
}

export function getPagoparOrderDisplayStatus(
  item: Pick<PagoparOrderQueryItem, 'pagado' | 'cancelado' | 'ultimo_mensaje_error' | 'mensaje_resultado_pago'>,
): PagoparOrderDisplayStatus {
  if (item.pagado === true) return 'approved'
  if (item.cancelado === true) return 'cancelled'
  if (item.ultimo_mensaje_error?.trim()) return 'rejected'

  const resultTitle = item.mensaje_resultado_pago?.titulo?.toLocaleLowerCase() || ''
  if (resultTitle.includes('pendiente')) return 'pending'
  return 'processing'
}

function normalizePhone(value?: string | null) {
  if (!value) return ''
  const digits = value.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('595')) return `+${digits}`
  return digits
}

function normalizeDocument(value?: string | null) {
  const normalized = value?.replace(/[^\d]/g, '') || ''
  return normalized
}

function maxPaymentDate() {
  const date = new Date(Date.now() + 72 * 60 * 60 * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function isPagoparConfigured() {
  return Boolean(process.env.PAGOPAR_PUBLIC_KEY && process.env.PAGOPAR_PRIVATE_KEY)
}

export function parsePagoparPaymentMethod(value: unknown): PagoparPaymentMethod | null {
  return value === 'card' || value === 'qr' ? value : null
}

export function getPagoparPaymentMethodId(method: PagoparPaymentMethod) {
  return PAGOPAR_PAYMENT_METHOD_IDS[method]
}

export function getPagoparCheckoutUrl(hash: string, method: PagoparPaymentMethod) {
  const paymentMethodId = getPagoparPaymentMethodId(method)
  return `${PAGOPAR_CHECKOUT_BASE_URL}/${encodeURIComponent(hash)}?forma_pago=${paymentMethodId}`
}

export function getPagoparAmountInPyg(amount: number, currency: string) {
  if (currency === 'PYG') return Math.round(amount)

  const usdToPyg = Number(process.env.PAGOPAR_USD_TO_PYG || '')
  if (currency === 'USD' && Number.isFinite(usdToPyg) && usdToPyg > 0) {
    return Math.round(amount * usdToPyg)
  }

  throw new Error(`Pagopar amount conversion is not configured for ${currency}`)
}

export function parsePagoparNotificationAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null
  }
  if (typeof value !== 'string' || !value.trim()) return null

  const raw = value.trim().replace(/\s/g, '')
  let normalized = raw

  if (raw.includes('.') && raw.includes(',')) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (raw.includes(',')) {
    normalized = raw.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, '')
  }

  const amount = Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export async function queryPagoparOrder(hash: string): Promise<PagoparOrderStatusResult> {
  if (!isValidPagoparOrderHash(hash)) {
    throw new Error('El hash de Pagopar no tiene un formato válido.')
  }

  const publicKey = requiredEnv('PAGOPAR_PUBLIC_KEY')
  const privateKey = requiredEnv('PAGOPAR_PRIVATE_KEY')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAGOPAR_QUERY_TIMEOUT_MS)

  try {
    const response = await fetch(PAGOPAR_ORDER_QUERY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash_pedido: hash,
        token: sha1(`${privateKey}CONSULTA`),
        token_publico: publicKey,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null) as {
      respuesta?: boolean
      resultado?: PagoparOrderQueryItem[] | string
    } | null
    const item = payload?.respuesta === true && Array.isArray(payload.resultado)
      ? payload.resultado[0]
      : null

    if (!response.ok || !item) {
      throw new Error('Pagopar no pudo confirmar el estado del pedido.')
    }
    if (item.hash_pedido !== hash) {
      throw new Error('La respuesta no corresponde al pedido solicitado.')
    }

    const amount = parsePagoparNotificationAmount(item.monto)
    if (amount === null) {
      throw new Error('Pagopar devolvió un monto inválido.')
    }

    return {
      hash,
      amount,
      providerOrderId: item.numero_pedido == null ? null : String(item.numero_pedido),
      paymentMethod: item.forma_pago?.trim() || null,
      paidAt: item.fecha_pago || null,
      maximumPaymentDate: item.fecha_maxima_pago || null,
      message: item.ultimo_mensaje_error?.trim()
        || item.mensaje_resultado_pago?.titulo?.trim()
        || null,
      status: getPagoparOrderDisplayStatus(item),
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Pagopar tardó demasiado en responder.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function normalizePagoparError(message: string) {
  if (message.includes('servicios o productos virtuales')) {
    return 'Pagopar rechazo el pago porque el comercio no esta habilitado para cobrar servicios o productos virtuales. Solicita a Pagopar que habilite productos virtuales para esta cuenta.'
  }

  return message
}

function redactKnownSecrets(value: string) {
  const secrets = [process.env.PAGOPAR_PRIVATE_KEY, process.env.PAGOPAR_PUBLIC_KEY]
    .filter((secret): secret is string => Boolean(secret && secret.length >= 4))
  return secrets.reduce((sanitized, secret) => sanitized.split(secret).join('[REDACTED]'), value)
}

function sanitizeProviderMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const withoutControlCharacters = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim()
  if (!withoutControlCharacters || /<\/?[a-z][\s\S]*>/i.test(withoutControlCharacters)) return null
  return redactKnownSecrets(withoutControlCharacters)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s().-]{5,}\d/g, '[REDACTED_NUMBER]')
    .slice(0, 300)
}

function getResultType(result: unknown, rawBody: string, contentType: string | null) {
  if (!rawBody.trim()) return 'empty'
  if (contentType?.toLowerCase().includes('text/html') || /^\s*</.test(rawBody)) return 'html'
  if (result === undefined) return 'missing'
  if (result === null) return 'null'
  if (Array.isArray(result)) return 'array'
  return typeof result
}

function getResultMessage(result: unknown, resultType: string) {
  if (resultType === 'html') return 'Respuesta HTML de Pagopar'
  if (resultType === 'empty') return 'Respuesta vacía de Pagopar'
  if (resultType === 'invalid_json') return 'Respuesta JSON inválida de Pagopar'
  if (typeof result === 'string') return sanitizeProviderMessage(result)
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const record = result as Record<string, unknown>
    return sanitizeProviderMessage(record.mensaje)
      || sanitizeProviderMessage(record.message)
      || sanitizeProviderMessage(record.error)
      || sanitizeProviderMessage(record.descripcion)
  }
  if (Array.isArray(result)) {
    return result
      .map((item) => {
        if (typeof item === 'string') return sanitizeProviderMessage(item)
        if (!item || typeof item !== 'object') return null
        const record = item as Record<string, unknown>
        return sanitizeProviderMessage(record.mensaje)
          || sanitizeProviderMessage(record.message)
          || sanitizeProviderMessage(record.error)
          || sanitizeProviderMessage(record.descripcion)
      })
      .find(Boolean) || null
  }
  return null
}

function logPagoparCreation(level: 'info' | 'error', log: PagoparCreateLog) {
  console[level](
    level === 'info' ? 'Pagopar order creation completed' : 'Pagopar order creation failed',
    log,
  )
}

export async function createPagoparOrder(input: CreatePagoparOrderInput): Promise<PagoparCreateResponse> {
  const publicKey = requiredEnv('PAGOPAR_PUBLIC_KEY')
  const privateKey = requiredEnv('PAGOPAR_PRIVATE_KEY')
  const amount = Math.round(input.amountPyg)
  const token = sha1(`${privateKey}${input.externalReference}${String(Number(amount))}`)
  const buyerName = input.buyer.name || input.buyer.businessName || 'Cliente'
  const buyerDocument = normalizeDocument(input.buyer.document || input.buyer.ruc)
  const correlationId = input.correlationId || randomUUID()
  const startedAt = Date.now()
  const paymentMethodId = getPagoparPaymentMethodId(input.paymentMethod)

  if (!buyerDocument) {
    throw new Error('Completa el RUC o CI en datos de facturacion antes de pagar con Pagopar.')
  }

  const body = {
    token,
    comprador: {
      ruc: input.buyer.ruc || '',
      email: input.buyer.email || '',
      ciudad: '1',
      nombre: buyerName,
      telefono: normalizePhone(input.buyer.phone),
      direccion: input.buyer.address || '',
      documento: buyerDocument,
      coordenadas: '',
      razon_social: input.buyer.businessName || buyerName,
      tipo_documento: 'CI',
      direccion_referencia: '',
    },
    public_key: publicKey,
    monto_total: amount,
    tipo_pedido: 'VENTA-COMERCIO',
    compras_items: [
      {
        ciudad: '1',
        nombre: input.description,
        cantidad: 1,
        categoria: '909',
        public_key: publicKey,
        url_imagen: '',
        descripcion: input.description,
        id_producto: input.itemId,
        precio_total: amount,
        vendedor_telefono: '',
        vendedor_direccion: '',
        vendedor_direccion_referencia: '',
        vendedor_direccion_coordenadas: '',
      },
    ],
    fecha_maxima_pago: maxPaymentDate(),
    id_pedido_comercio: input.externalReference,
    descripcion_resumen: input.description,
    forma_pago: paymentMethodId,
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAGOPAR_CREATE_TIMEOUT_MS)

  try {
    const response = await fetch(`${PAGOPAR_API_BASE_URL}/comercios/2.0/iniciar-transaccion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type')
    const rawBody = await response.text()
    let payload: PagoparCreatePayload | null = null
    let invalidJson = false

    if (rawBody.trim() && !contentType?.toLowerCase().includes('text/html') && !/^\s*</.test(rawBody)) {
      try {
        payload = JSON.parse(rawBody) as PagoparCreatePayload
      } catch {
        invalidJson = true
      }
    }

    const resultType = invalidJson
      ? 'invalid_json'
      : getResultType(payload?.resultado, rawBody, contentType)
    const resultMessage = getResultMessage(payload?.resultado, resultType)
    const log: PagoparCreateLog = {
      correlationId,
      event: response.ok ? 'success' : 'http_error',
      httpStatus: response.status,
      contentType,
      respuesta: typeof payload?.respuesta === 'boolean' ? payload.respuesta : null,
      resultType,
      resultMessage,
      paymentMethodId,
      amountPyg: amount,
      externalReference: input.externalReference,
      durationMs: Date.now() - startedAt,
    }
    const result = Array.isArray(payload?.resultado) ? payload.resultado[0] : null
    const hash = result && typeof result === 'object' && typeof result.data === 'string' ? result.data : null

    if (!response.ok || payload?.respuesta !== true || !hash) {
      logPagoparCreation('error', { ...log, event: 'http_error' })
      const safeProviderMessage = resultMessage ? normalizePagoparError(resultMessage) : null
      throw new PagoparOrderCreationError(
        safeProviderMessage || `No se pudo iniciar el pago. Código: ${correlationId}`,
        correlationId,
      )
    }

    logPagoparCreation('info', log)
    return {
      checkoutUrl: getPagoparCheckoutUrl(hash, input.paymentMethod),
      providerOrderId: result.pedido ? String(result.pedido) : null,
      hash,
      raw: payload,
    }
  } catch (error) {
    if (error instanceof PagoparOrderCreationError) throw error
    const isTimeout = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')
    logPagoparCreation('error', {
      correlationId,
      event: isTimeout ? 'timeout' : 'network_error',
      httpStatus: null,
      contentType: null,
      respuesta: null,
      resultType: 'unavailable',
      resultMessage: isTimeout ? 'Tiempo de espera agotado' : 'Error de red al conectar con Pagopar',
      paymentMethodId,
      amountPyg: amount,
      externalReference: input.externalReference,
      durationMs: Date.now() - startedAt,
    })
    throw new PagoparOrderCreationError(
      `No se pudo iniciar el pago. Código: ${correlationId}`,
      correlationId,
    )
  } finally {
    clearTimeout(timeout)
  }
}

export function validatePagoparNotificationToken(hash: string, token: string) {
  const privateKey = requiredEnv('PAGOPAR_PRIVATE_KEY')
  return sha1(`${privateKey}${hash}`) === token
}
