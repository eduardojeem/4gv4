import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El codigo interno del plan (`tier`) y su nombre comercial son cosas distintas:
 * en esta plataforma el tier `free` corresponde a un plan PAGO llamado "Lite".
 *
 * Por eso la pantalla de registro no puede derivar lo que muestra a partir del
 * tier. Antes tenia una tabla fija (free -> 'FREE', basic -> 'BASIC', ...) y
 * quien clickeaba "Lite" en la pagina de precios terminaba leyendo
 * "Plan seleccionado: FREE", como si hubiera elegido algo gratis.
 */
const source = readFileSync(resolve(process.cwd(), 'src/app/register/page.tsx'), 'utf8')

const code = source
  .split('\n')
  .filter((line) => {
    const trimmed = line.trim()
    return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
  })
  .join('\n')

describe('seleccion de plan en el registro', () => {
  it('no traduce el tier a una etiqueta fija', () => {
    expect(code).not.toContain('PLAN_LABELS')
  })

  it('lee el nombre comercial de la base', () => {
    expect(code).toContain("from('subscription_plans')")
    expect(code).toContain('planInfo.name')
  })

  it('solo consulta planes activos', () => {
    // Un plan desactivado no deberia anunciarse como elegido: la API tambien lo
    // rechaza, y mostrarlo llevaria al usuario a un error recien al enviar.
    expect(code).toContain(".eq('is_active', true)")
  })

  it('no promete una duracion de prueba fija', () => {
    // Los planes tienen duraciones distintas (20, 7, 14 dias); el cartel decia
    // siempre 14.
    expect(code).not.toContain('14 días de prueba')
    expect(code).toContain('planInfo.trialDays')
  })

  it('valida el plan contra la base, no contra una lista fija', () => {
    // La validacion no se puede perder: es lo que evita que un `?plan=` armado a
    // mano llegue tal cual a la API. Lo que cambio es la autoridad: antes era la
    // lista `VALID_PLAN_TIERS` escrita a mano, y un plan creado desde el panel
    // con otro tier caia al default sin avisar.
    expect(code).not.toContain('VALID_PLAN_TIERS')
    expect(code).toContain('availablePlans.find')
    expect(code).toContain('planInfo?.tier ?? null')
  })

  it('sugiere el subdominio a partir del nombre de la empresa', () => {
    // Antes la sugerencia era solo un placeholder gris y el campo quedaba vacio.
    expect(code).toContain('companySlug: slugifyTenantName(value)')
  })
})
