import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isRunningTrial } from '@/components/superadmin/subscriptions/utils'
import type { SuperAdminSubscription } from '@/components/superadmin/subscriptions/types'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const TABLERO = leer('src/components/superadmin/subscriptions/subscriptions-dashboard.tsx')
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
 * El MRR se calculaba en cinco pantallas con reglas distintas. Ahora vive en
 * Resumen, con calculateRecurringRevenue; Suscripciones gestiona la cartera y
 * no repite números: los contadores de las pestañas son el único resumen.
 */
describe('suscripciones no repite el MRR ni los contadores', () => {
  it('no calcula su propio MRR', () => {
    expect(TABLERO).not.toContain('estimatedMrr')
    expect(TABLERO).not.toContain('price_monthly ?? 0), 0)')
  })

  it('los contadores viven solo en las pestañas', () => {
    expect(TABLERO).not.toContain('SubscriptionStats')
    expect(TABLERO).not.toContain('riskBannerDismissed')
    expect(TABLERO).toContain("{ value: 'attention', label: 'Atención', count: tabCounts.attention")
  })

  it('usa el encabezado común del superadmin', () => {
    expect(TABLERO).toContain('<PageHeader')
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
