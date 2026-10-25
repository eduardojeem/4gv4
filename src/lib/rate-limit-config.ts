/**
 * Dónde están las credenciales del Redis que comparte el límite de pedidos
 * entre instancias. Upstash las da con un nombre y la integración de Vercel
 * (Marketplace) con otro: se acepta cualquiera de los dos pares completos.
 * Sin dependencias, para que el chequeo de salud lo use sin cargar Redis.
 */
export const SHARED_RATE_LIMIT_ENV = [
  { url: 'UPSTASH_REDIS_REST_URL', token: 'UPSTASH_REDIS_REST_TOKEN' },
  { url: 'KV_REST_API_URL', token: 'KV_REST_API_TOKEN' },
] as const

export type SharedRateLimitEnv = (typeof SHARED_RATE_LIMIT_ENV)[number]

/** Los nombres a configurar, para mensajes y avisos. */
export const SHARED_RATE_LIMIT_HINT = 'UPSTASH_REDIS_REST_URL/TOKEN | KV_REST_API_URL/TOKEN'

const read = (name: string) => process.env[name]?.trim() || null

/** El primer par completo, o null. Nunca mezcla la dirección de un par con la clave del otro. */
export function sharedRateLimitCredentials(): { url: string; token: string; source: SharedRateLimitEnv } | null {
  for (const source of SHARED_RATE_LIMIT_ENV) {
    const url = read(source.url)
    const token = read(source.token)
    if (url && token) return { url, token, source }
  }
  return null
}

/** Para el chequeo de salud: configurado, a medias (hay una variable sin su pareja) o ausente. */
export function sharedRateLimitState(): 'configured' | 'partial' | 'missing' {
  if (sharedRateLimitCredentials()) return 'configured'
  return SHARED_RATE_LIMIT_ENV.some((source) => read(source.url) || read(source.token)) ? 'partial' : 'missing'
}

/** Si la variable falta pero está su equivalente del otro par, el nombre de ese equivalente. */
export function sharedRateLimitAlternative(name: string): string | null {
  const [primary, alternative] = SHARED_RATE_LIMIT_ENV
  if (name === primary.url) return alternative.url
  if (name === primary.token) return alternative.token
  return null
}
