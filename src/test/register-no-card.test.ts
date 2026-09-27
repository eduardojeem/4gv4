import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const PAGINA = leer('src/app/register/page.tsx')
const RUTA = leer('src/app/api/auth/register-company/route.ts')

describe('el registro no pide tarjeta', () => {
  it('lo dice donde se elige el plan y también antes de enviar', () => {
    // Quien llega con `?plan=` desde la página de precios va directo al
    // formulario y no ve el texto del selector: hace falta en los dos lugares.
    expect(PAGINA).toContain('Sin tarjeta: empezás con los días de regalo')
    expect(PAGINA).toContain('No pedimos tarjeta para crear la cuenta')
  })

  it('nombra los días de regalo reales del plan elegido', () => {
    // Prometer "días de regalo" sin decir cuántos deja al usuario adivinando;
    // los planes tienen 20, 7 y 7.
    expect(PAGINA).toContain('tenés {planInfo.trialDays} días de regalo')
  })

  /**
   * Lo de arriba es una promesa impresa en la pantalla de alta. Estas dos
   * pruebas la atan a lo que el sistema hace: si mañana alguien agrega un cobro
   * al registro, falla la suite en vez de dejar publicada una promesa falsa.
   */
  it('el formulario no tiene ningún campo de pago', () => {
    const ids = [...PAGINA.matchAll(/id="([a-zA-Z]+)"/g)].map((m) => m[1])
    for (const id of ids) {
      expect(id.toLowerCase(), `campo sospechoso: ${id}`).not.toMatch(/card|tarjeta|cvv|cvc|iban|cbu/)
    }
  })

  it('la API de registro no llama a ningún cobro', () => {
    expect(RUTA.toLowerCase()).not.toContain('pagopar')
    expect(RUTA).not.toContain('createSubscriptionPagoparCheckout')
    expect(RUTA.toLowerCase()).not.toContain('checkouturl')
  })

  it('la suscripción nace en prueba, no cobrada', () => {
    // Es lo que hace cierta la promesa: se crea `trialing` con los días del
    // plan, y el cobro recién aparece en /admin/subscriptions.
    const suscripcion = RUTA.slice(RUTA.indexOf("from('subscriptions')"))
    expect(suscripcion.slice(0, 400)).toContain("status: 'trialing'")
    expect(suscripcion.slice(0, 400)).toContain('trial_ends_at')
  })
})
