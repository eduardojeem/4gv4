import type { createAdminSupabase } from '@/lib/supabase/admin'
import { BUSINESS_VERTICALS, type BusinessVertical } from '@/lib/organization/business-profile'
import { findGlobalCategoryByName, type GlobalCategory } from '@/lib/categories/global-catalog'
import type { CheckoutSettings, TrustBarSettings } from '@/types/website-settings'

/**
 * Lo que una empresa necesita para empezar a trabajar el primer día.
 *
 * Al registrarse solo se creaba la organización y una sucursal vacía: no había
 * caja para vender en el POS (6 de 13 organizaciones nunca la crearon), ni
 * categorías (5 de 13 tenían cero), y el cobro de la tienda ofrecía tarjeta a
 * domicilio, transferencia sin cuentas y delivery aunque la tienda no los
 * tuviera. Todo lo de acá solo agrega lo que falta: nunca pisa lo que la
 * empresa ya cargó.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export const MAIN_CASH_REGISTER_NAME = 'Caja principal'

export function isBusinessVertical(value: unknown): value is BusinessVertical {
  return typeof value === 'string' && (BUSINESS_VERTICALS as readonly string[]).includes(value)
}

/**
 * Categorías de arranque por rubro. Los nombres coinciden con la taxonomía
 * global cuando existe, así la tienda aparece agrupada en el marketplace desde
 * el primer producto.
 */
export const STARTER_CATEGORIES: Record<BusinessVertical, string[]> = {
  electronics: ['Celulares', 'Accesorios', 'Cargadores', 'Carcasas y Fundas', 'Audio y Video', 'Repuestos'],
  clothing: ['Mujer', 'Hombre', 'Niños', 'Calzados', 'Accesorios'],
  cosmetics: ['Maquillaje', 'Cuidado de la piel', 'Cuidado del cabello', 'Perfumes', 'Accesorios'],
  food: ['Comidas', 'Bebidas', 'Postres', 'Combos'],
  hardware: ['Herramientas', 'Electricidad', 'Plomería', 'Pinturas', 'Construcción'],
  general: ['Productos', 'Accesorios', 'Ofertas'],
  other: ['Productos', 'Servicios'],
}

/**
 * Rubros cuya taxonomía global existe. Hoy la del marketplace es de tecnología:
 * «Accesorios» de una tienda de ropa no puede caer en «Accesorios» de celulares.
 */
const LINKABLE_VERTICALS = new Set<BusinessVertical>(['electronics'])

/**
 * Las categorías a crear, con la global a la que se vinculan. Si la empresa ya
 * cargó alguna, no se agrega nada.
 */
export function planStarterCategories(
  vertical: BusinessVertical,
  existingNames: string[],
  catalog: GlobalCategory[],
): Array<{ name: string; global_category_id: string | null }> {
  if (existingNames.length > 0) return []
  const linkable = LINKABLE_VERTICALS.has(vertical)
  return STARTER_CATEGORIES[vertical].map((name) => ({
    name,
    global_category_id: linkable ? findGlobalCategoryByName(name, catalog)?.id ?? null : null,
  }))
}

/**
 * El cobro con el que arranca una tienda: consultas por WhatsApp, efectivo y
 * retiro en el local. Es lo único que cualquier comercio puede cumplir sin
 * configurar nada. Tarjeta, transferencia, billetera y delivery se activan
 * cuando la tienda carga sus datos.
 */
export function buildStarterCheckout(base: CheckoutSettings, options: { hasWhatsapp: boolean }): CheckoutSettings {
  return {
    ...base,
    // Sin WhatsApp no hay a dónde mandar la consulta: queda el carrito.
    commerceMode: options.hasWhatsapp ? 'whatsapp' : 'cart',
    payment: {
      cash: { ...base.payment.cash, enabled: true, instructions: 'Pagás al retirar en el local.' },
      card: { ...base.payment.card, enabled: false },
      transfer: { ...base.payment.transfer, enabled: false },
      digital_wallet: { ...base.payment.digital_wallet, enabled: false },
    },
    delivery: { ...base.delivery, enabled: false },
    pickup: { ...base.pickup, enabled: true },
  }
}

/** La barra de confianza dice solo lo que la tienda ofrece de verdad. */
export function buildStarterTrustBar(checkout: CheckoutSettings): TrustBarSettings {
  const items: TrustBarSettings['items'] = []
  if (checkout.commerceMode === 'whatsapp') {
    items.push({ id: 'whatsapp', icon: 'message', title: 'Atención por WhatsApp', description: 'Consultanos antes de comprar', active: true })
  }
  if (checkout.pickup.enabled) {
    items.push({ id: 'pickup', icon: 'package', title: 'Retiro en el local', description: 'Coordinamos el día y la hora', active: true })
  }
  if (checkout.delivery.enabled) {
    items.push({ id: 'delivery', icon: 'truck', title: 'Envíos a domicilio', description: 'Consultá costo y cobertura', active: true })
  }
  if (checkout.payment.cash.enabled) {
    items.push({ id: 'cash', icon: 'credit-card', title: 'Pago en efectivo', description: 'Al retirar tu pedido', active: true })
  }
  return { enabled: items.length > 0, position: 'above_carousel', items }
}

/**
 * Crea la caja principal en la sucursal principal si la organización no tiene
 * ninguna. Respeta el límite del plan. Devuelve si la creó.
 */
export async function ensureMainCashRegister(admin: Admin, organizationId: string, userId?: string | null): Promise<boolean> {
  const { data: branches } = await admin
    .from('branches')
    .select('id, is_default')
    .eq('organization_id', organizationId)
  const branch = (branches ?? []).find((row: { is_default: boolean | null }) => row.is_default) ?? branches?.[0]
  if (!branch) return false

  const { count } = await admin
    .from('cash_registers')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
  if ((count ?? 0) > 0) return false

  // Importado acá: el servicio de suscripciones trae dependencias de servidor
  // que no hacen falta para planear el kit.
  const { canCreateResource } = await import('@/lib/saas/subscription-service')
  const gate = await canCreateResource(organizationId, 'cashRegisters')
  if (!gate.allowed) return false

  const { error } = await admin.from('cash_registers').insert({
    name: MAIN_CASH_REGISTER_NAME,
    is_open: false,
    balance: 0,
    branch_id: branch.id,
    organization_id: organizationId,
    ...(userId ? { created_by: userId } : {}),
  })
  return !error
}

/** Crea las categorías de arranque del rubro si la organización no tiene ninguna. */
export async function seedStarterCategories(admin: Admin, organizationId: string, vertical: BusinessVertical): Promise<number> {
  const [{ data: existing }, { data: catalog }] = await Promise.all([
    admin.from('categories').select('name').eq('organization_id', organizationId),
    admin.from('global_categories').select('id, name, slug, aliases, is_active'),
  ])

  const plan = planStarterCategories(
    vertical,
    ((existing ?? []) as Array<{ name: string }>).map((row) => row.name),
    (catalog ?? []) as GlobalCategory[],
  )
  if (plan.length === 0) return 0

  const { data, error } = await admin
    .from('categories')
    .insert(plan.map((row) => ({ ...row, organization_id: organizationId, is_active: true })))
    .select('id')
  return error ? 0 : (data ?? []).length
}

/**
 * El kit completo para una organización recién creada. Nada de esto puede
 * hacer fallar el alta: lo que no se pudo crear se crea después a mano.
 */
export async function provisionStarterKit(
  admin: Admin,
  input: { organizationId: string; vertical?: BusinessVertical | null; userId?: string | null },
  log?: (message: string, meta: Record<string, unknown>) => void,
) {
  const result = { cashRegister: false, categories: 0 }
  try {
    result.cashRegister = await ensureMainCashRegister(admin, input.organizationId, input.userId)
  } catch (error) {
    log?.('No se pudo crear la caja principal', { organizationId: input.organizationId, error })
  }
  if (input.vertical) {
    try {
      result.categories = await seedStarterCategories(admin, input.organizationId, input.vertical)
    } catch (error) {
      log?.('No se pudieron crear las categorías iniciales', { organizationId: input.organizationId, error })
    }
  }
  return result
}
