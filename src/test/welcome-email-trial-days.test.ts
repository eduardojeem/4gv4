import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { renderWelcomeEmail } from '@/lib/email/templates'

const base = { ownerName: 'Ana', companyName: 'Mi Tienda', plan: 'Pro', loginUrl: 'https://x/login' }

/** El correo de bienvenida decía «14 días» fijo aunque el plan tuviera 7. */
describe('correo de bienvenida y días de prueba', () => {
  it('usa los días de prueba del plan elegido', () => {
    const html = renderWelcomeEmail({ ...base, trialDays: 7 })
    expect(html).toContain('prueba gratis de 7 días')
    expect(html).not.toContain('14 días')
  })

  it('sin prueba no promete días', () => {
    expect(renderWelcomeEmail({ ...base, trialDays: 0 })).not.toMatch(/prueba gratis/)
    expect(renderWelcomeEmail(base)).not.toMatch(/prueba gratis/)
  })

  it('el alta de empresa le pasa los mismos días que usa para la suscripción', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/auth/register-company/route.ts'), 'utf8')
    const call = route.slice(route.indexOf('renderWelcomeEmail({'))
    expect(call.slice(0, call.indexOf('})'))).toContain('trialDays,')
  })
})
