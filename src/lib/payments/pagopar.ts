import { createHash } from 'crypto'

const PAGOPAR_API_BASE_URL = 'https://api.pagopar.com/api'
const PAGOPAR_CHECKOUT_BASE_URL = 'https://www.pagopar.com/pagos'

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
}

type PagoparCreateResponse = {
  checkoutUrl: string
  providerOrderId: string | null
  hash: string
  raw: unknown
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function sha1(value: string) {
  return createHash('sha1').update(value).digest('hex')
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

function normalizePagoparError(message: string) {
  if (message.includes('servicios o productos virtuales')) {
    return 'Pagopar rechazo el pago porque el comercio no esta habilitado para cobrar servicios o productos virtuales. Solicita a Pagopar que habilite productos virtuales para esta cuenta.'
  }

  return message
}

export async function createPagoparOrder(input: CreatePagoparOrderInput): Promise<PagoparCreateResponse> {
  const publicKey = requiredEnv('PAGOPAR_PUBLIC_KEY')
  const privateKey = requiredEnv('PAGOPAR_PRIVATE_KEY')
  const amount = Math.round(input.amountPyg)
  const token = sha1(`${privateKey}${input.externalReference}${String(Number(amount))}`)
  const buyerName = input.buyer.name || input.buyer.businessName || 'Cliente'
  const buyerDocument = normalizeDocument(input.buyer.document || input.buyer.ruc)

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
    forma_pago: getPagoparPaymentMethodId(input.paymentMethod),
  }

  const response = await fetch(`${PAGOPAR_API_BASE_URL}/comercios/2.0/iniciar-transaccion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null) as {
    respuesta?: boolean
    resultado?: Array<{ data?: string; pedido?: string | number }> | string
  } | null

  if (!response.ok || !payload?.respuesta || !Array.isArray(payload.resultado) || !payload.resultado[0]?.data) {
    const message = typeof payload?.resultado === 'string' ? payload.resultado : 'Pagopar rejected the transaction'
    throw new Error(normalizePagoparError(message))
  }

  const hash = payload.resultado[0].data

  return {
    checkoutUrl: getPagoparCheckoutUrl(hash, input.paymentMethod),
    providerOrderId: payload.resultado[0].pedido ? String(payload.resultado[0].pedido) : null,
    hash,
    raw: payload,
  }
}

export function validatePagoparNotificationToken(hash: string, token: string) {
  const privateKey = requiredEnv('PAGOPAR_PRIVATE_KEY')
  return sha1(`${privateKey}${hash}`) === token
}
