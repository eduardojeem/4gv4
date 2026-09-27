import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La pagina publica de planes no puede prometer nada que el sistema no cobre ni
 * cumpla. Estos casos fijan cuatro problemas concretos que tenia:
 *
 * 1. Un selector "Anual" aplicaba un 20% de descuento solo en pantalla: la base
 *    tiene un unico `price`, y el CTA solo llevaba el tier, asi que el cliente
 *    veia un precio con descuento y se le cobraba el mensual completo.
 * 2. Un plan con `trial_days = 0` (sin prueba, valor que el panel permite)
 *    igual anunciaba "20 dias gratis", por caer a un valor inventado.
 * 3. Un plan de precio 0 se mostraba como "A Medida", escondiendo el plan
 *    gratuito detras de un supuesto contacto comercial.
 * 4. Se mapeaban tiers que el sistema no acepta ('lite', 'pro_plus'), con lo
 *    que 'free' caia en el plan pago mas bajo.
 */
const source = readFileSync(
  resolve(process.cwd(), 'src/components/saas/landing/saas-plans-section.tsx'),
  'utf8',
)

/**
 * Codigo sin comentarios. Los comentarios SI pueden nombrar lo que se saco
 * (para explicar por que), y no deben hacer fallar estas comprobaciones.
 */
const code = source
  .split('\n')
  .filter((line) => {
    const trimmed = line.trim()
    return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
  })
  .join('\n')

describe('precios honestos en la pagina publica de planes', () => {
  it('no ofrece un ciclo de facturacion que el sistema no cobra', () => {
    expect(source).not.toContain('setYearly')
    expect(source).not.toContain('Pago Anual')
    expect(source).not.toContain('-20% OFF')
    // Tampoco puede sobrevivir el calculo del descuento.
    expect(source).not.toContain('* 0.8')
  })

  it('no promete dias de prueba cuando el plan no los tiene', () => {
    // El unico origen valido es `plan.trial_days`; cualquier constante por tier
    // vuelve a desincronizar la web de lo que configura el superadmin.
    expect(source).toContain('typeof plan.trial_days === \'number\' && plan.trial_days > 0 ? plan.trial_days : 0')
    expect(source).not.toContain('return 20')
  })

  it('anuncia el plan gratuito como gratis y no como cotizacion', () => {
    expect(source).toContain("if (!price || price === 0) return 'Gratis'")
  })

  it('solo usa los tiers que la plataforma acepta', () => {
    // La API de creacion valida contra free, basic, pro y enterprise.
    expect(code).not.toContain('pro_plus')
    expect(code).not.toContain("recommendedTier: 'lite'")
  })

  it('no deja numeros de prueba fijos por tier en el texto comercial', () => {
    for (const claim of ['20 días', '7 días', 'PRO+']) {
      // Se ignoran los comentarios, que si pueden nombrarlos para explicar el porque.
      const withoutComments = source
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n')
      expect(withoutComments).not.toContain(claim)
    }
  })
})
