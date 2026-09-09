import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_LABELS,
  getActivityLevel,
  limitUsage,
  summarizeOrganizationActivity,
} from '@/lib/superadmin/organization-activity'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const PAGINA = leer('src/app/superadmin/organizations/[id]/page.tsx')
const VISTA = leer('src/components/superadmin/organizations/OrganizationDetailView.tsx')

const DIA = 86_400_000
const AHORA = new Date('2026-09-09T12:00:00Z').getTime()
const hace = (dias: number) => new Date(AHORA - dias * DIA).toISOString()

/**
 * El expediente contaba `sales` con `count: 'exact'` y sin filtrar estado: una
 * venta anulada sumaba igual que una cobrada, y no habia forma de saber cuanto
 * factura la organizacion.
 */
describe('la facturación cuenta lo que se cobró', () => {
  it('ignora las ventas anuladas', () => {
    const r = summarizeOrganizationActivity(
      [
        { total_amount: 100_000, status: 'completed', created_at: hace(1) },
        { total_amount: 900_000, status: 'cancelled', created_at: hace(1) },
      ],
      AHORA
    )
    expect(r.revenueTotal).toBe(100_000)
    expect(r.completedSales).toBe(1)
    // El total de registros se conserva: sirve para ver cuántas se anularon.
    expect(r.totalSales).toBe(2)
  })

  it('separa los últimos 30 días del histórico', () => {
    const r = summarizeOrganizationActivity(
      [
        { total_amount: 50_000, status: 'completed', created_at: hace(5) },
        { total_amount: 30_000, status: 'completed', created_at: hace(29) },
        { total_amount: 400_000, status: 'completed', created_at: hace(120) },
      ],
      AHORA
    )
    expect(r.revenueLast30).toBe(80_000)
    expect(r.revenueTotal).toBe(480_000)
  })

  it('la última venta es la última COBRADA, no la última registrada', () => {
    const r = summarizeOrganizationActivity(
      [
        { total_amount: 10_000, status: 'cancelled', created_at: hace(1) },
        { total_amount: 10_000, status: 'completed', created_at: hace(40) },
      ],
      AHORA
    )
    expect(r.daysSinceLastSale).toBe(40)
  })

  it('sin ventas cobradas no inventa una fecha', () => {
    const r = summarizeOrganizationActivity([{ total_amount: 1, status: 'cancelled', created_at: hace(1) }], AHORA)
    expect(r.lastSaleAt).toBeNull()
    expect(r.daysSinceLastSale).toBeNull()
    expect(r.revenueTotal).toBe(0)
  })

  it('un importe corrupto no rompe la suma', () => {
    const r = summarizeOrganizationActivity(
      [
        { total_amount: null, status: 'completed', created_at: hace(1) },
        { total_amount: 20_000, status: 'completed', created_at: hace(1) },
      ],
      AHORA
    )
    expect(r.revenueTotal).toBe(20_000)
    expect(r.completedSales).toBe(2)
  })
})

/**
 * Una empresa con 240 productos que dejó de operar hace ocho meses se veía
 * igual que una que vendió hoy.
 */
describe('el estado de la cuenta se dice en palabras', () => {
  it('cada tramo tiene su nombre', () => {
    expect(getActivityLevel(0)).toBe('active')
    expect(getActivityLevel(30)).toBe('active')
    expect(getActivityLevel(31)).toBe('slowing')
    expect(getActivityLevel(91)).toBe('dormant')
    expect(getActivityLevel(null)).toBe('never')
  })

  it('los nombres están en castellano y son accionables', () => {
    expect(ACTIVITY_LABELS.dormant).toBe('Sin vender hace meses')
    expect(ACTIVITY_LABELS.never).toBe('Nunca vendió')
  })

  it('la vista resalta lo que hay que mirar', () => {
    expect(VISTA).toContain("warn={activityLevel === 'dormant' || activityLevel === 'never'}")
  })
})

describe('el uso contra el límite del plan', () => {
  it('sin límite definido no devuelve un porcentaje', () => {
    // Una barra al 0% se leería como «no usa nada», que es lo contrario de «no
    // hay tope».
    expect(limitUsage(10, null)).toBeNull()
    expect(limitUsage(10, undefined)).toBeNull()
    expect(limitUsage(10, 'Ilimitado')).toBeNull()
    expect(limitUsage(10, 0)).toBeNull()
  })

  it('calcula y nunca pasa de 100', () => {
    expect(limitUsage(50, 200)).toBe(25)
    expect(limitUsage(250, 200)).toBe(100)
  })

  it('la vista avisa cuando está cerca del tope', () => {
    expect(VISTA).toContain('cerca del tope')
    expect(VISTA).toContain('percent !== null && percent >= 80')
  })
})

describe('los conteos dejan de mezclar cosas distintas', () => {
  it('los productos activos se cuentan aparte de los archivados', () => {
    // El total incluía inactivos y lo archivado por baja de plan, así que el
    // uso contra el límite del plan salía inflado.
    expect(PAGINA).toContain(".eq('is_active', true)")
    expect(PAGINA).toContain(".is('archived_by_plan_at', null)")
    expect(PAGINA).toContain('activeProducts: activeProductsCount ?? 0')
  })

  it('las reparaciones distinguen «cero» de «el módulo no está»', () => {
    expect(PAGINA).toContain('repairs: repairsError ? null : repairsCount ?? 0')
  })

  it('si hay más ventas de las que se pueden sumar, se dice', () => {
    expect(PAGINA).toContain('const activityTruncated = sales.length > SALES_SCAN_CAP')
    expect(VISTA).toContain('Parcial: hay más ventas de las que se pueden sumar de una vez')
  })
})

describe('el resumen abre con el negocio, no con la configuración', () => {
  it('lo primero es cuánto factura y si sigue operando', () => {
    const resumen = VISTA.slice(
      VISTA.indexOf('{/* Tab 1: Overview */}'),
      VISTA.indexOf('Identidad del Negocio')
    )
    expect(resumen).toContain('label="Facturado"')
    expect(resumen).toContain('label="Últimos 30 días"')
    expect(resumen).toContain('label="Actividad"')
    expect(resumen).toContain('label="Tienda pública"')
  })

  it('la tienda pública dice si alguien puede verla', () => {
    expect(VISTA).toContain('Nadie puede verla todavía')
    expect(VISTA).toContain('const storefrontPublic = org.storefront_public === true')
  })

  it('el uso del plan sube al resumen en vez de vivir en otra pestaña', () => {
    expect(VISTA).toContain('Qué tiene cargado')
    expect(VISTA).toContain('plan_details?.limits?.max_products')
  })
})
