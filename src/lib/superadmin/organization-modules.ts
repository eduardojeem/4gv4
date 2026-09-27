import { getModuleAvailability, type ModuleAvailability } from '@/lib/saas/effective-modules'

/**
 * Que le da el plan a la organizacion, que tiene prendido, y que usa de verdad.
 *
 * La pestaña de modulos mostraba dos estados —«Habilitado» y «No contratado»—
 * y calculaba la lista de habilitados asi:
 *
 *   org.enabled_modules?.length ? org.enabled_modules : ['pos','inventory','crm','ecommerce']
 *
 * Ese fallback no solo era inventado: contradice la regla del sistema. En
 * `resolveEffectiveModules`, `enabled_modules === null` significa «todos los
 * del plan estan activos», no «estos cuatro».
 */

export type ModuleState =
  /** El plan lo da y la organizacion lo tiene prendido. */
  | 'on'
  /** El plan lo da y la organizacion lo apago. */
  | 'off_by_org'
  /** El plan no lo incluye. */
  | 'not_in_plan'
  /** Esta prendido pero el plan no lo da: alguien lo dejo fuera de lugar. */
  | 'on_outside_plan'
  /** Habilitado por una prueba con fecha de vencimiento. */
  | 'trial'

export const MODULE_STATE_LABELS: Record<ModuleState, string> = {
  on: 'Activo',
  off_by_org: 'Disponible, apagado',
  not_in_plan: 'No incluido en el plan',
  on_outside_plan: 'Activo fuera del plan',
  trial: 'En prueba',
}

export interface ModuleContext {
  /** `plans.modules` del plan de la organizacion. */
  entitled: readonly string[]
  /** Modulos con prueba vigente. */
  trials: readonly string[]
  /** `organizations.enabled_modules`. `null` significa «todos los del plan». */
  enabled: readonly string[] | null
}

export function resolveModuleState(module: string, ctx: ModuleContext): ModuleState {
  const enTrial = ctx.trials.includes(module)
  const loDaElPlan = ctx.entitled.includes(module)
  // `enabled === null` es «todos los del plan», no «ninguno».
  const prendido = ctx.enabled === null ? loDaElPlan || enTrial : ctx.enabled.includes(module)

  if (prendido && !loDaElPlan && !enTrial) return 'on_outside_plan'
  if (enTrial && prendido) return 'trial'

  // La regla de fondo la sigue teniendo `effective-modules`: aca solo se le
  // agrega el caso «prendido fuera del plan», que esa funcion no distingue.
  const disponibilidad: ModuleAvailability = getModuleAvailability(module, {
    entitledModules: ctx.entitled,
    trialModules: ctx.trials,
    enabledModules: ctx.enabled === null ? null : [...ctx.enabled],
  })

  if (disponibilidad === 'not_in_plan') return 'not_in_plan'
  if (disponibilidad === 'disabled_by_org') return 'off_by_org'
  return 'on'
}

/** Los modulos que la organizacion efectivamente tiene funcionando. */
export function activeModules(all: readonly string[], ctx: ModuleContext): string[] {
  return all.filter((m) => {
    const estado = resolveModuleState(m, ctx)
    return estado === 'on' || estado === 'trial' || estado === 'on_outside_plan'
  })
}

/**
 * Cobertura contra lo que el plan da, no contra el catalogo entero.
 *
 * Se mostraba «35% de cobertura funcional» comparando contra los 20 modulos
 * que existen, incluidos los que ese plan nunca va a dar. Una cuenta Free al
 * 35% no esta desaprovechando nada: esta en Free.
 */
export function planCoverage(ctx: ModuleContext): { active: number; entitled: number; percent: number | null } {
  const entitled = new Set(ctx.entitled)
  const active = [...entitled].filter((m) => {
    const estado = resolveModuleState(m, ctx)
    return estado === 'on' || estado === 'trial'
  }).length

  return {
    active,
    entitled: entitled.size,
    percent: entitled.size > 0 ? Math.round((active / entitled.size) * 100) : null,
  }
}

// ── Uso real de cada modulo ─────────────────────────────────────────────────

export interface ModuleUsageSignals {
  sales?: number | null
  products?: number | null
  customers?: number | null
  orders?: number | null
  repairs?: number | null
  credits?: number | null
}

export interface ModuleUsage {
  /** `null` cuando no hay una señal barata que mirar para ese modulo. */
  used: boolean | null
  label: string | null
}

const SIN_MEDICION: ModuleUsage = { used: null, label: null }

/**
 * `vacio` se pasa entero en vez de derivarlo del plural: intentar conjugar
 * «registrado» a partir de la ultima letra fallaba con «pedidos web», que
 * termina en «b».
 */
const contar = (
  valor: number | null | undefined,
  singular: string,
  plural: string,
  vacio: string
): ModuleUsage => {
  if (valor === null || valor === undefined) return SIN_MEDICION
  return {
    used: valor > 0,
    label: valor > 0 ? `${valor.toLocaleString('es-PY')} ${valor === 1 ? singular : plural}` : vacio,
  }
}

/**
 * Un modulo prendido que nunca se uso es exactamente lo que un superadmin
 * necesita ver: es plata que el cliente paga por algo que no toca. Solo se
 * afirma sobre los modulos que dejan un rastro barato de mirar; para el resto
 * se devuelve `null` en vez de decir «nunca se uso» sin haberlo comprobado.
 */
export function moduleUsage(module: string, signals: ModuleUsageSignals): ModuleUsage {
  switch (module) {
    case 'pos':
      return contar(signals.sales, 'venta cobrada', 'ventas cobradas', 'Nunca cobró una venta')
    case 'inventory':
    case 'inventory_admin':
      return contar(signals.products, 'producto', 'productos', 'Catálogo vacío')
    case 'crm':
      return contar(signals.customers, 'cliente', 'clientes', 'Sin clientes cargados')
    case 'ecommerce':
    case 'orders':
      return contar(signals.orders, 'pedido web', 'pedidos web', 'Sin pedidos web')
    case 'repairs':
      return contar(signals.repairs, 'reparación', 'reparaciones', 'Sin reparaciones')
    case 'credits':
      return contar(signals.credits, 'crédito', 'créditos', 'Sin créditos otorgados')
    default:
      return SIN_MEDICION
  }
}

/** Modulos prendidos y sin usar: el hallazgo comercial de la pantalla. */
export function unusedActiveModules(
  all: readonly string[],
  ctx: ModuleContext,
  signals: ModuleUsageSignals
): string[] {
  return activeModules(all, ctx).filter((m) => moduleUsage(m, signals).used === false)
}
