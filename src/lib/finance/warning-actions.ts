/**
 * Qué hacer con cada aviso de datos incompletos de Finanzas: un botón que lleve
 * al lugar exacto donde se corrige. Antes los avisos solo explicaban y el único
 * link iba a Rentabilidad, donde no se puede cargar un costo.
 */
export type FinanceWarningAction =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'section'; label: string; section: 'payroll' }

/** Acción para todo un grupo de avisos del mismo tipo. */
export function financeWarningAction(code: string): FinanceWarningAction | null {
  switch (code) {
    case 'MISSING_DIRECT_COST':
      return { kind: 'link', label: 'Cargar costos en Productos', href: '/dashboard/products' }
    case 'MISSING_REPAIR_PRICE':
      return { kind: 'link', label: 'Ver reparaciones', href: '/dashboard/repairs' }
    case 'MISSING_EMPLOYEE':
      return { kind: 'section', label: 'Revisar sueldos', section: 'payroll' }
    default:
      return null
  }
}

/** Link directo a un registro puntual del aviso, si se puede abrir. */
export function financeWarningSourceHref(sourceType: string | undefined, sourceId: string | undefined): string | null {
  if (!sourceId) return null
  if (sourceType === 'repair') return `/dashboard/repairs?id=${encodeURIComponent(sourceId)}&edit=true`
  return null
}

/** Título del grupo en palabras del comercio. */
export function financeWarningTitle(code: string, count: number): string {
  const n = (one: string, many: string) => `${count} ${count === 1 ? one : many}`
  switch (code) {
    case 'MISSING_DIRECT_COST':
      return `${n('venta', 'ventas')} con productos sin costo cargado`
    case 'MISSING_CASH_TIMING':
      return `${n('cobro', 'cobros')} sin fecha`
    case 'MISSING_REPAIR_PRICE':
      return `${n('reparación entregada', 'reparaciones entregadas')} sin precio`
    case 'MISSING_EMPLOYEE':
      return `${n('pago', 'pagos')} sin colaborador asignado`
    case 'MISSING_BRANCH':
      return `${n('movimiento', 'movimientos')} sin sucursal`
    default:
      return n('dato para revisar', 'datos para revisar')
  }
}

/** Qué cambia en los números mientras el aviso siga abierto. */
export function financeWarningImpact(code: string): string {
  switch (code) {
    case 'MISSING_DIRECT_COST':
      return 'La ganancia sale más alta de lo real hasta que cargues cuánto te costaron esos productos.'
    case 'MISSING_CASH_TIMING':
      return 'No sabemos qué día entró esa plata, así que puede faltar en «Entró».'
    case 'MISSING_REPAIR_PRICE':
      return 'Cuentan como venta cero hasta que cargues lo que cobraste.'
    case 'MISSING_EMPLOYEE':
      return 'El sueldo no se puede atribuir a nadie en «Qué deja más».'
    case 'MISSING_BRANCH':
      return 'No suman al filtrar por sucursal.'
    default:
      return 'Puede afectar la precisión del resultado.'
  }
}
