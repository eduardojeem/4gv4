export type ServiceTerms = { price: number; durationMinutes: number; bufferMinutes: number }
export type ServiceTermsOverride = { [K in keyof ServiceTerms]?: number | null }

/** Null inherits; a zero price is an intentional free service. */
export function resolveServiceTerms(base: ServiceTerms, override: ServiceTermsOverride | null): ServiceTerms {
  const terms = {
    price: override?.price ?? base.price,
    durationMinutes: override?.durationMinutes ?? base.durationMinutes,
    bufferMinutes: override?.bufferMinutes ?? base.bufferMinutes,
  }
  if (!Number.isFinite(terms.price) || terms.price < 0 || terms.price > 999999999999.99
    || !Number.isInteger(terms.durationMinutes) || terms.durationMinutes < 5 || terms.durationMinutes > 600
    || !Number.isInteger(terms.bufferMinutes) || terms.bufferMinutes < 0 || terms.bufferMinutes > 120) {
    throw new Error('INVALID_SERVICE_TERMS')
  }
  return terms
}
