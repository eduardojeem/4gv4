import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const promotions = read('src/app/api/public/promotions/validate/route.ts')
const repairAuth = read('src/app/api/public/repairs/auth/route.ts')
const authEvents = read('src/app/api/security/auth-events/route.ts')
const telegram = read('src/app/api/telegram/webhook/route.ts')
const healthGenerator = read('scripts/generate-health-manifest.mjs')

describe('rate limits de endpoints sensibles', () => {
  it.each([
    ['promociones', promotions],
    ['autenticacion de reparaciones', repairAuth],
    ['eventos de seguridad', authEvents],
    ['webhook de Telegram', telegram],
  ])('espera el resultado asincrono en %s', (_name, source) => {
    expect(source).toMatch(/await\s+rateLimiter\.check\(/)
  })

  it('deriva la identidad de auth-events desde la sesion del servidor', () => {
    expect(authEvents).toContain('auth.getUser()')
    expect(authEvents).toContain('p_user_id: authenticatedUser?.id ?? null')
    expect(authEvents).not.toContain('p_user_id: body.userId')
  })
})

describe('clasificador de seguridad de System Health', () => {
  it('distingue la proteccion de cada metodo', () => {
    expect(healthGenerator).toContain('methodSecurity')
  })

  it('solo reconoce rate limits asincronos correctamente esperados', () => {
    expect(healthGenerator).toContain('EFFECTIVE_RATE_LIMIT_RE')
    expect(healthGenerator).toMatch(/await\\s\+.*rateLimiter/)
  })

  it('reconoce captchaToken delegado a Supabase Auth', () => {
    expect(healthGenerator).toMatch(/captchaToken/)
  })
})
