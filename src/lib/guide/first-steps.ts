import type { OrganizationModule } from '@/lib/organization/business-profile'

/**
 * Los primeros pasos de una organización nueva, medidos contra los datos.
 *
 * El onboarding guarda `status: completed` cuando la persona termina el
 * formulario, y eso no dice nada de si el negocio quedó operativo: hoy hay
 * empresas marcadas como completas sin un solo producto, sin caja y sin
 * ninguna venta. Acá cada paso se responde con lo que existe en la base.
 */

export type FirstStepKey = 'negocio' | 'productos' | 'caja' | 'venta' | 'tienda' | 'equipo'

/** Lo que hace falta saber de la organización para responder cada paso. */
export type FirstStepsInput = {
  businessName?: string | null
  /** Teléfono o WhatsApp: cualquiera de los dos sirve para que la contacten. */
  contactPhone?: string | null
  address?: string | null
  activeProducts: number
  cashRegisters: number
  completedSales: number
  storefrontPublic: boolean
  /** Personas con acceso al sistema, sin contar a los clientes de la tienda. */
  staffMembers: number
}

export type FirstStep = {
  key: FirstStepKey
  label: string
  /** Por qué importa, en una frase. */
  why: string
  /** Lo que hay hoy, con los números reales. */
  detail: string
  done: boolean
  /** Sin esto no se puede vender; el resto suma. */
  essential: boolean
  action: { label: string; href: string }
  /** Permiso que hace falta para completarlo. */
  permission?: string
  /** Módulo del plan que tiene que estar activo para que el paso aplique. */
  module?: OrganizationModule
}

export type FirstStepsAssessment = {
  steps: FirstStep[]
  done: number
  total: number
  /** Pasos cumplidos sobre el total, de 0 a 100. */
  percent: number
  /** El siguiente paso a hacer, o `null` si están todos. */
  next: FirstStep | null
  /** Lo imprescindible para cobrar una venta ya está. */
  readyToSell: boolean
}

const plural = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`

export function assessFirstSteps(input: FirstStepsInput): FirstStepsAssessment {
  const name = input.businessName?.trim() || ''
  const phone = input.contactPhone?.trim() || ''
  const address = input.address?.trim() || ''
  const products = Math.max(0, input.activeProducts)
  const registers = Math.max(0, input.cashRegisters)
  const sales = Math.max(0, input.completedSales)
  const staff = Math.max(0, input.staffMembers)

  const missingFromBusiness = [
    name ? null : 'el nombre',
    phone ? null : 'el teléfono',
    address ? null : 'la dirección',
  ].filter((part): part is string => part !== null)

  const missingFromStore = [
    !input.storefrontPublic ? 'falta publicarla' : null,
    products === 0 ? 'no tiene productos' : null,
    !phone ? 'no tiene teléfono de contacto' : null,
  ].filter((reason): reason is string => reason !== null)

  const steps: FirstStep[] = [
    {
      key: 'negocio',
      label: 'Completá los datos del negocio',
      why: 'El nombre, el teléfono y la dirección aparecen en los tickets y en la tienda: sin eso, un cliente no sabe a quién le compró.',
      detail: missingFromBusiness.length === 0
        ? 'Nombre, teléfono y dirección cargados'
        : `Falta ${missingFromBusiness.join(', ')}`,
      done: missingFromBusiness.length === 0,
      essential: true,
      action: { label: 'Configurar el negocio', href: '/dashboard/onboarding' },
      permission: 'settings.update',
    },
    {
      key: 'productos',
      label: 'Cargá tus productos',
      why: 'El POS y la tienda venden lo que esté en el catálogo: sin productos no hay nada que cobrar ni mostrar.',
      detail: products > 0
        ? `${plural(products, 'producto activo', 'productos activos')} en el catálogo`
        : 'El catálogo está vacío',
      done: products > 0,
      essential: true,
      action: { label: 'Ir al catálogo', href: '/dashboard/products' },
      permission: 'products.create',
    },
    {
      key: 'caja',
      label: 'Creá tu caja',
      why: 'El POS no abre turno sin una caja: es donde se registran la apertura, los cobros y el cierre del día.',
      detail: registers > 0
        ? `${plural(registers, 'caja creada', 'cajas creadas')}`
        : 'Todavía no hay ninguna caja',
      done: registers > 0,
      essential: true,
      action: { label: 'Abrir caja', href: '/dashboard/pos/caja' },
      permission: 'pos.manage',
      module: 'pos',
    },
    {
      key: 'venta',
      label: 'Hacé tu primera venta',
      why: 'La primera venta confirma que precios, stock y caja quedaron bien configurados antes de atender a un cliente real.',
      detail: sales > 0
        ? `${plural(sales, 'venta registrada', 'ventas registradas')}`
        : 'Todavía sin ventas registradas',
      done: sales > 0,
      essential: false,
      action: { label: 'Ir al punto de venta', href: '/dashboard/pos' },
      permission: 'pos.read',
      module: 'pos',
    },
    {
      key: 'tienda',
      label: 'Publicá tu tienda',
      why: 'Publicada, tu tienda tiene enlace propio y los clientes pueden ver el catálogo y escribirte por WhatsApp.',
      detail: missingFromStore.length === 0
        ? 'Publicada, con productos y contacto'
        : `Todavía ${missingFromStore.join(' y ')}`,
      done: missingFromStore.length === 0,
      essential: false,
      action: { label: 'Configurar la tienda', href: '/admin/website' },
      permission: 'settings.update',
    },
    {
      key: 'equipo',
      label: 'Invitá a tu equipo',
      why: 'Cada persona entra con su usuario y su rol: así sabés quién vendió, quién movió stock y quién cerró la caja.',
      detail: staff > 1
        ? `${plural(staff, 'persona con acceso', 'personas con acceso')}`
        : 'Sos la única persona con acceso',
      done: staff > 1,
      essential: false,
      action: { label: 'Gestionar usuarios', href: '/admin/users' },
      permission: 'users.create',
    },
  ]

  const done = steps.filter((step) => step.done).length
  return {
    steps,
    done,
    total: steps.length,
    percent: steps.length === 0 ? 0 : Math.round((done / steps.length) * 100),
    next: steps.find((step) => !step.done) ?? null,
    readyToSell: steps.every((step) => !step.essential || step.done),
  }
}

/**
 * Deja solo los pasos que la persona puede hacer con su plan y sus permisos.
 * Un taller sin POS no tiene que ver «creá tu caja» como una tarea pendiente.
 * Como en el menú, un admin ve todo lo que el plan incluye.
 */
export function filterFirstSteps(
  steps: readonly FirstStep[],
  options: {
    hasPermission?: (permission: string) => boolean
    modules?: readonly string[]
    isAdmin?: boolean
  },
): FirstStep[] {
  return steps.filter((step) => {
    if (step.module && options.modules && !options.modules.includes(step.module)) return false
    if (options.isAdmin) return true
    if (step.permission && options.hasPermission && !options.hasPermission(step.permission)) return false
    return true
  })
}

/** Recalcula el resumen sobre un subconjunto de pasos ya filtrado. */
export function summarizeFirstSteps(steps: readonly FirstStep[]): FirstStepsAssessment {
  const done = steps.filter((step) => step.done).length
  return {
    steps: [...steps],
    done,
    total: steps.length,
    percent: steps.length === 0 ? 0 : Math.round((done / steps.length) * 100),
    next: steps.find((step) => !step.done) ?? null,
    readyToSell: steps.every((step) => !step.essential || step.done),
  }
}
