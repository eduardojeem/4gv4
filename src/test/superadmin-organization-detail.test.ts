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
  it('el consumo de cupo se cuenta con el mismo filtro que lo aplica', () => {
    // `countActiveProducts` en subscription-service excluye SOLO lo archivado
    // por baja de plan. Si la pantalla filtrara además por `is_active`, diría
    // un consumo menor al que el sistema realmente aplica al crear el próximo
    // producto.
    expect(PAGINA).toContain(".is('archived_by_plan_at', null)")
    expect(PAGINA).not.toContain(".eq('is_active', true)")
    expect(PAGINA).toContain('quotaProducts: quotaProductsCount ?? 0')
  })

  it('las butacas cuentan staff activo, no todos los miembros', () => {
    // `members.length` incluía clientes registrados desde la pública y staff
    // suspendido: ninguno de los dos consume butaca.
    expect(PAGINA).toContain(".neq('role', 'customer')")
    expect(PAGINA).toContain(".eq('status', 'active')")
    expect(VISTA).toContain('used={counts.staffMembers}')
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
    expect(VISTA).toContain('limit={plan_limits?.products}')
  })
})

/**
 * Los limites se leian de `subscription_plans.limits` con las claves
 * `max_products` / `max_users` / `max_branches`, que no existen en ninguna
 * parte del sistema. Todas las barras salian «Sin tope en el plan» y la ficha
 * del plan decia «Ilimitado» para toda organizacion, incluidas las del plan
 * Free con tope de 50 productos.
 */
describe('los límites del plan son los que el sistema aplica', () => {
  it('se leen de la tabla técnica, que es la que gana en el merge', () => {
    expect(PAGINA).toContain("admin.from('plans').select('code, name, limits, modules, is_active')")
    expect(PAGINA).toContain('normalizePlanCode(planTier)')
  })

  it('usa las claves reales de `ResourceType`, no `max_*`', () => {
    for (const clave of ['max_products', 'max_users', 'max_branches']) {
      expect(VISTA).not.toContain(clave)
    }
    expect(VISTA).toContain('plan_limits?.products')
    expect(VISTA).toContain('plan_limits?.users')
    expect(VISTA).toContain('plan_limits?.branches')
  })

  it('un plan sin límites cargados no se muestra como «Ilimitado»', () => {
    // Sin fila en `plans`, el servicio aplica los de Free: decir «sin tope»
    // seria exactamente lo contrario de lo que pasa.
    expect(VISTA).not.toContain("'Ilimitado'")
    expect(VISTA).toContain('El plan no tiene límites cargados')
  })

  it('el soporte deja de anunciarse como 24/7 para todos los planes', () => {
    expect(VISTA).not.toContain('Prioritario 24/7')
  })
})

/**
 * «Equipo & Colaboradores» decia 0 en organizaciones con equipo cargado.
 * `organization_members.user_id` referencia `auth.users(id)`, no
 * `public.profiles`: PostgREST no puede resolver el embebido `profiles(...)`,
 * devuelve un error, y la pagina descartaba el error quedandose con `data`,
 * que en ese caso es `null`. Un fallo de consulta se renderizaba como una
 * afirmacion sobre la organizacion.
 */
describe('el equipo se carga sin depender de una relación que no existe', () => {
  const RUTA_API = leer('src/app/api/superadmin/organizations/[id]/route.ts')

  it('ni la página ni la API embeben `profiles(...)` en los miembros', () => {
    for (const fuente of [PAGINA, RUTA_API]) {
      expect(fuente).not.toContain('created_at, profiles(id, email, full_name, avatar_url)')
    }
  })

  it('los perfiles se cruzan en una segunda consulta, como en /api/admin/users', () => {
    expect(PAGINA).toContain(".in('id', memberUserIds)")
    expect(PAGINA).toContain('profileById.get(String(m.user_id))')
  })

  it('el error de la consulta no se descarta', () => {
    expect(PAGINA).toContain('{ data: memberRows, error: membersError }')
    expect(PAGINA).toContain('membersFailed: Boolean(membersError)')
    expect(RUTA_API).toContain('if (membersError)')
  })

  it('un fallo se dice, no se muestra como «0 usuarios»', () => {
    expect(VISTA).toContain("membersFailed ? 'No se pudo cargar'")
    expect(VISTA).toContain('esto es un fallo de la consulta, no una lista vacía')
  })
})
