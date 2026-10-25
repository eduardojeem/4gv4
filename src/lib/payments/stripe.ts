import Stripe from 'stripe'

let client: Stripe | null = null

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY no está configurada.')

  client ??= new Stripe(secretKey, {
    appInfo: { name: 'MiTiendaPY' },
    maxNetworkRetries: 2,
    timeout: 15_000,
  })
  return client
}

/**
 * Stripe cobra en la unidad mínima de cada moneda. PYG no tiene decimales
 * (1 = Gs. 1); USD sí (1 = 1 centavo).
 */
export function toStripeUnitAmount(amount: number, currency: string) {
  const normalized = currency.toUpperCase()
  if (normalized === 'PYG') return Math.round(amount)
  if (normalized === 'USD') return Math.round(amount * 100)
  throw new Error(`Stripe no tiene conversión configurada para ${currency}`)
}

export function fromStripeUnitAmount(amount: number, currency: string) {
  return currency.toUpperCase() === 'PYG' ? amount : amount / 100
}

export function isValidStripeCheckoutSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(value)
}

export { getBrowserRequestOrigin, getAppReturnOrigin as getStripeReturnOrigin } from '@/lib/http/app-origin'
