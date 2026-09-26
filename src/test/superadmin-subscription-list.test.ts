import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isRunningTrial } from '@/components/superadmin/subscriptions/utils'
import type { SuperAdminSubscription } from '@/components/superadmin/subscriptions/types'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const TABLERO = leer('src/components/superadmin/subscriptions/subscriptions-dashboard.tsx')
const TARJETAS = leer('src/components/superadmin/subscriptions/subscription-stats.tsx')
const PAGINA = leer('src/app/superadmin/subscriptions/page.tsx')
const TARJETA = leer('src/components/superadmin/subscriptions/subscription-card.tsx')

const dias = (n: number) => new Date(Date.now() + n * 86400000).toISOString()
const sub = (over: Partial<SuperAdminSubscription>) =>
  ({ status: 'active', trial_ends_at: null, ...over }) as SuperAdminSubscription

/**
 * La pestaña «Trials» contaba `status === 'trialing'` sin mirar la fecha: un
 * trial terminado hace un año que quedó en ese estado seguía contando, y el
 * número no bajaba nunca.
 */
describe('un trial terminado deja de contar como trial', () => {
  it('en curso cuenta', () => {
    expect(isRunningTrial(sub({ status: 'trialing', trial_ends_at: dias(5) }))).toBe(true)
    expect(isRunningTrial(sub({ status: 'trialing', trial_ends_at: dias(0) }))).toBe(true)
  })

  it('terminado no cuenta, aunque el estado siga diciendo «trialing»', () => {
    expect(isRunningTrial(sub({ status: 'trialing', trial_ends_at: dias(-1) }))).toBe(false)
    expect(isRunningTrial(sub({ status: 'trialing', trial_ends_at: dias(-365) }))).toBe(false)
  })

  it('sin fecha de fin, el estado es lo único que hay', () => {
    expect(isRunningTrial(sub({ status: 'trialing', trial_ends_at: null }))).toBe(true)
    expect(isRunningTrial(sub({ status: 'active', trial_ends_at: null }))).toBe(false)
  })

  it('el tablero usa esa regla en el contador y en el filtro', () => {
    expect(TABLERO).toContain('trials: subscriptions.filter(isRunningTrial).length')
    expect(TABLERO).toContain("(tab === 'trials' && isRunningTrial(s))")
  })
})

/**
 * El MRR sumaba también los trials: plata que todavía no existe, contada como
 * si el 100% fuera a convertir.
 */
describe('el MRR cuenta lo que cobra', () => {
  it('solo suma las activas', () => {
    expect(TABLERO).toContain("const paying = subscriptions.filter((s) => s.status === 'active')")
    expect(TABLERO).not.toContain("['active', 'trialing'].includes(s.status))\n      .reduce")
  })

  it('avisa cuando hay activas sin precio configurado', () => {
    // Aportaban 0 en silencio: el MRR podía estar bajo por datos faltantes.
    expect(TABLERO).toContain('const missingPrice = paying.filter(')
    expect(TARJETAS).toContain('sin precio configurado')
    expect(TARJETAS).toContain('warn: stats.missingPrice > 0')
  })

  it('la tarjeta dice qué suma', () => {
    expect(TARJETAS).toContain("label: 'MRR de activas'")
    expect(TARJETAS).not.toContain("label: 'MRR Estimado'")
  })
})

describe('las tarjetas dicen lo que miden', () => {
  it('«conversión» no era una conversión', () => {
    // Era `active / (active + trialing)`: la proporción entre dos estados
    // actuales, ignorando canceladas y vencidas. Daba 95% con 400 bajas.
    // El nombre viejo sobrevive en el comentario que explica por qué se sacó;
    // lo que no puede sobrevivir es el texto que se pinta.
    expect(TARJETAS).not.toContain('helper: `${stats.activeRate}% conversión`')
    expect(TARJETAS).toContain('helper: `${stats.activeRate}% del total`')
    expect(TABLERO).toContain('Math.round((active / subscriptions.length) * 100)')
  })

  it('«En riesgo» explica en castellano en vez de mostrar la columna cruda', () => {
    expect(TARJETAS).not.toContain("'past_due / unpaid'")
    expect(TARJETAS).toContain('Con cobro pendiente')
  })
})

/**
 * `price_monthly: Number(commercialPlan?.price || 0)` convertía «falta la fila»
 * en «cuesta cero».
 */
describe('el precio ausente no se convierte en gratis', () => {
  it('la página deja pasar el nulo', () => {
    expect(PAGINA).toContain('price_monthly: commercialPlan?.price === null || commercialPlan?.price === undefined')
    expect(PAGINA).not.toContain('price_monthly: Number(commercialPlan?.price || 0)')
  })

  it('la tarjeta usa el mismo criterio que la tabla', () => {
    expect(TARJETA).toContain("{ text: 'Precio sin definir', warn: true }")
    expect(TARJETA).toContain("{ text: 'Gratuito', warn: false }")
  })
})

describe('la búsqueda encuentra nombres con tilde', () => {
  it('normaliza los dos lados', () => {
    // «Gimenez» no encontraba «Giménez».
    expect(TABLERO).toContain("import { normalizeText } from '@/lib/text/normalize'")
    expect(TABLERO).toContain('const q = normalizeText(query)')
    expect(TABLERO).toContain('normalizeText(v).includes(q)')
    expect(TABLERO).not.toContain("v?.toLowerCase().includes(q)")
  })
})

describe('el CSV se abre bien en Excel', () => {
  it('usa punto y coma, BOM y fin de línea de Windows', () => {
    expect(TABLERO).toContain('const CSV_BOM = String.fromCharCode(0xfeff)')
    expect(TABLERO).toContain('const CSV_EOL = String.fromCharCode(13, 10)')
    expect(TABLERO).toContain('join(";")')
  })
})
