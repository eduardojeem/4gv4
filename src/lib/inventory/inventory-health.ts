import { resolveStockLevel, type StockLevelInput } from '@/lib/inventory/stock-status'

/**
 * Diagnóstico del inventario para el asistente de /admin/inventory. Todo sale de
 * los datos de la empresa: no hay servicios externos ni costos por uso.
 */

export interface InventoryHealthInput extends StockLevelInput {
  id: string
  name?: string | null
  sku?: string | null
  barcode?: string | null
  purchase_price?: number | null
  sale_price?: number | null
  category_id?: string | null
  image_url?: string | null
  is_active?: boolean | null
}

export type InventoryIssueKey =
  | 'out_of_stock'
  | 'low_stock'
  | 'negative_margin'
  | 'missing_cost'
  | 'missing_min_stock'
  | 'over_stock'
  | 'missing_category'
  | 'missing_code'
  | 'missing_image'

export interface InventoryIssueSample {
  id: string
  name: string
  sku: string | null
}

export interface InventoryIssue {
  count: number
  /** Algunos ejemplos para ir directo a corregirlos. */
  samples: InventoryIssueSample[]
}

export interface InventoryHealth {
  /** Productos activos evaluados. */
  evaluated: number
  issues: Record<InventoryIssueKey, InventoryIssue>
  /** 0 a 100: qué tan completos y sanos están los datos del catálogo. */
  score: number
}

const SAMPLE_SIZE = 5

const ISSUE_KEYS: InventoryIssueKey[] = [
  'out_of_stock', 'low_stock', 'negative_margin', 'missing_cost', 'missing_min_stock',
  'over_stock', 'missing_category', 'missing_code', 'missing_image',
]

const blank = (value?: string | null) => !value || !value.trim()

/** Qué problemas tiene un producto. Los inactivos no se evalúan: no se venden. */
export function productIssues(product: InventoryHealthInput): InventoryIssueKey[] {
  if (product.is_active === false) return []
  const issues: InventoryIssueKey[] = []
  const level = resolveStockLevel(product)
  const cost = Number(product.purchase_price ?? 0)
  const sale = Number(product.sale_price ?? 0)

  if (level === 'out') issues.push('out_of_stock')
  if (level === 'low') issues.push('low_stock')
  if (level === 'high') issues.push('over_stock')
  if (cost > 0 && sale > 0 && cost > sale) issues.push('negative_margin')
  if (!(cost > 0)) issues.push('missing_cost')
  if (!(Number(product.min_stock ?? 0) > 0)) issues.push('missing_min_stock')
  if (blank(product.category_id)) issues.push('missing_category')
  if (blank(product.sku) && blank(product.barcode)) issues.push('missing_code')
  if (blank(product.image_url)) issues.push('missing_image')
  return issues
}

/** Peso de cada problema en el puntaje: lo que hace perder ventas o plata pesa más. */
const SCORE_WEIGHTS: Partial<Record<InventoryIssueKey, number>> = {
  out_of_stock: 3,
  negative_margin: 3,
  missing_cost: 2,
  low_stock: 2,
  missing_min_stock: 1,
  missing_category: 1,
  missing_code: 1,
}

export function calculateInventoryHealth(products: InventoryHealthInput[]): InventoryHealth {
  const issues = Object.fromEntries(ISSUE_KEYS.map((key) => [key, { count: 0, samples: [] }])) as unknown as Record<InventoryIssueKey, InventoryIssue>
  let evaluated = 0

  for (const product of products) {
    if (product.is_active === false) continue
    evaluated += 1
    for (const key of productIssues(product)) {
      const issue = issues[key]
      issue.count += 1
      if (issue.samples.length < SAMPLE_SIZE) {
        issue.samples.push({ id: product.id, name: product.name?.trim() || 'Sin nombre', sku: product.sku?.trim() || null })
      }
    }
  }

  // Cada problema resta según qué parte del catálogo afecta, y los graves más.
  // Un promedio por producto daba «buen estado» con 14% agotado y 60% sin mínimo.
  let quality = 1
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS) as Array<[InventoryIssueKey, number]>) {
    const share = evaluated === 0 ? 0 : issues[key].count / evaluated
    quality *= Math.pow(1 - share, weight / 2)
  }
  const score = evaluated === 0 ? 0 : Math.round(100 * quality)
  return { evaluated, issues, score: Math.max(0, Math.min(100, score)) }
}

// ---------------------------------------------------------------------------
// Recomendaciones del asistente
// ---------------------------------------------------------------------------

export type InventoryTab = 'products' | 'stock-control' | 'movements' | 'alerts' | 'suppliers' | 'categories'

export interface InventoryRecommendation {
  key: InventoryIssueKey | 'no_products' | 'no_categories' | 'no_suppliers'
  severity: 'critical' | 'warning' | 'tip'
  title: string
  detail: string
  count: number
  samples: InventoryIssueSample[]
  action: { label: string; tab: InventoryTab; stockStatus?: 'out' | 'low' | 'high' } | { label: string; href: string }
}

export interface InventoryAssistantContext {
  categories: number
  suppliers: number
  branchName?: string | null
}

const plural = (count: number, one: string, many: string) => `${count.toLocaleString('es-PY')} ${count === 1 ? one : many}`

/**
 * Qué conviene hacer primero, en orden: lo que impide vender, lo que hace perder
 * plata, lo que deja al sistema sin poder avisar y, al final, la prolijidad.
 */
export function buildInventoryRecommendations(health: InventoryHealth | null, context: InventoryAssistantContext): InventoryRecommendation[] {
  const recommendations: InventoryRecommendation[] = []
  const where = context.branchName ? ` en ${context.branchName}` : ''

  if (context.categories === 0) {
    recommendations.push({
      key: 'no_categories', severity: 'warning', count: 0, samples: [],
      title: 'Creá tus categorías',
      detail: 'Ordenan el catálogo, los reportes y la tienda online. El formulario de producto pide una.',
      action: { label: 'Crear categorías', href: '/dashboard/categories' },
    })
  }
  if (context.suppliers === 0) {
    recommendations.push({
      key: 'no_suppliers', severity: 'warning', count: 0, samples: [],
      title: 'Cargá al menos un proveedor',
      detail: 'Cada producto se asocia a quién se lo comprás; así sabés a quién pedir cuando falta.',
      action: { label: 'Agregar proveedor', tab: 'suppliers' },
    })
  }
  if (!health || health.evaluated === 0) {
    recommendations.push({
      key: 'no_products', severity: 'warning', count: 0, samples: [],
      title: 'Cargá tus primeros productos',
      detail: 'Con el catálogo cargado vas a ver stock, alertas y el valor de tu inventario.',
      action: { label: 'Ir al catálogo', tab: 'products' },
    })
    return recommendations
  }

  const { issues } = health
  const push = (key: InventoryIssueKey, severity: InventoryRecommendation['severity'], title: string, detail: string, action: InventoryRecommendation['action']) => {
    if (issues[key].count > 0) recommendations.push({ key, severity, title, detail, count: issues[key].count, samples: issues[key].samples, action })
  }

  push('out_of_stock', 'critical',
    `${plural(issues.out_of_stock.count, 'producto agotado', 'productos agotados')}${where}`,
    'No se pueden vender. Registrá la entrada de mercadería o desactivalos si ya no los trabajás.',
    { label: 'Ver agotados', tab: 'products', stockStatus: 'out' })
  push('negative_margin', 'critical',
    `${plural(issues.negative_margin.count, 'producto se vende', 'productos se venden')} por debajo del costo`,
    'Cada venta te hace perder plata. Revisá el precio de venta o el costo cargado.',
    { label: 'Revisar precios', tab: 'products' })
  push('low_stock', 'warning',
    `${plural(issues.low_stock.count, 'producto llegó', 'productos llegaron')} al mínimo${where}`,
    'Es el momento de pedir al proveedor antes de quedarte sin stock.',
    { label: 'Ver stock bajo', tab: 'products', stockStatus: 'low' })
  push('missing_cost', 'warning',
    `${plural(issues.missing_cost.count, 'producto sin costo', 'productos sin costo')}`,
    'Sin el costo no se puede calcular tu margen ni el valor real del inventario.',
    { label: 'Completar costos', tab: 'products' })
  push('missing_min_stock', 'tip',
    `${plural(issues.missing_min_stock.count, 'producto sin stock mínimo', 'productos sin stock mínimo')}`,
    'Sin mínimo el sistema no puede avisarte cuándo reponer. Cargá cuántas unidades querés tener siempre.',
    { label: 'Configurar mínimos', tab: 'products' })
  push('over_stock', 'tip',
    `${plural(issues.over_stock.count, 'producto pasó', 'productos pasaron')} su máximo${where}`,
    'Es plata inmovilizada. Considerá una promoción o frenar las compras.',
    { label: 'Ver sobrestock', tab: 'products', stockStatus: 'high' })
  push('missing_category', 'tip',
    `${plural(issues.missing_category.count, 'producto sin categoría', 'productos sin categoría')}`,
    'Quedan fuera de los filtros, los reportes por categoría y las secciones de la tienda.',
    { label: 'Asignar categorías', tab: 'products' })
  push('missing_code', 'tip',
    `${plural(issues.missing_code.count, 'producto sin SKU ni código de barras', 'productos sin SKU ni código de barras')}`,
    'Con un código se encuentran al instante en la caja y en la toma de inventario.',
    { label: 'Agregar códigos', tab: 'products' })

  const order = { critical: 0, warning: 1, tip: 2 } as const
  return recommendations.sort((a, b) => order[a.severity] - order[b.severity])
}

export function describeHealthScore(score: number): { label: string; tone: 'good' | 'fair' | 'poor' } {
  if (score >= 85) return { label: 'Inventario en buen estado', tone: 'good' }
  if (score >= 60) return { label: 'Hay cosas para ordenar', tone: 'fair' }
  return { label: 'Necesita atención', tone: 'poor' }
}
