import type { OperatingModel } from '@/lib/organization/business-profile'

export type EvidenceState = boolean | null
export interface StartGuideEvidence {
  businessVertical: string
  operatingModel: OperatingModel
  effectiveModules: string[]
  permissions: string[]
  basics: EvidenceState
  activeBranch: EvidenceState
  sellableProduct: EvidenceState
  activeService: EvidenceState
  serviceAvailability: EvidenceState
  teamConfigured: EvidenceState
  firstSale: EvidenceState
  firstReservation: EvidenceState
  firstService: EvidenceState
  firstRepair: EvidenceState
  firstCollection: EvidenceState
}
export interface StartGuidePreferences {
  version: 1
  teamMode: 'solo' | 'team' | null
  postponed: boolean
}
export interface StartGuideTask {
  id: string
  label: string
  description: string
  href: string
  required: boolean
  state: 'ready' | 'pending' | 'unknown'
}
export interface StartGuideResult {
  tasks: StartGuideTask[]
  completed: number
  total: number
  nextTaskId: string | null
  operationMilestones: Record<string, EvidenceState>
}

export function evaluateStartGuide(evidence: StartGuideEvidence, preferences: StartGuidePreferences): StartGuideResult {
  const tasks: StartGuideTask[] = []
  const allowed = (permission: string) => evidence.permissions.includes(permission)
  const moduleEnabled = (module: string) => evidence.effectiveModules.includes(module)
  const add = (id: string, label: string, description: string, href: string, value: EvidenceState, required: boolean) => {
    tasks.push({ id, label, description, href, required, state: value === null ? 'unknown' : value ? 'ready' : 'pending' })
  }
  if (allowed('settings.manage')) {
    add('basics', 'Datos básicos del negocio', 'Nombre, moneda y zona horaria; no necesitás logo ni web para comenzar.', '/admin/onboarding', evidence.basics, true)
    add('branch', 'Sucursal operativa', 'Confirmá desde qué sucursal vas a trabajar.', '/admin/branches', evidence.activeBranch, true)
  }
  const model = evidence.operatingModel
  if (['retail', 'wholesale', 'mixed'].includes(model) && moduleEnabled('inventory') && allowed('products.create')) {
    add('catalog', 'Prepará tu primer producto', 'Agregá un producto vendible con precio y disponibilidad válidos.', '/dashboard/products', evidence.sellableProduct, model !== 'mixed')
  }
  if (['service', 'mixed'].includes(model) && moduleEnabled('services') && allowed('settings.manage')) {
    add('service', 'Prepará tu primer servicio', 'Configurá servicio, precio y duración. No requiere stock.', '/dashboard/agenda/configuracion#servicios', evidence.activeService, model !== 'mixed')
    add('availability', 'Horarios y disponibilidad', 'Configurá cuándo atendés y profesionales cuando corresponda.', '/dashboard/agenda/configuracion#reservas', evidence.serviceAvailability, model !== 'mixed')
  }
  if (preferences.teamMode === 'team' && allowed('users.manage')) {
    add('team', 'Prepará tu equipo', 'Invitá o configurá al personal autorizado. Podés hacerlo después.', '/admin/users', evidence.teamConfigured, false)
  }
  if (moduleEnabled('ecommerce') && allowed('settings.manage')) {
    add('website', 'Prepará tu página pública', 'Es opcional para comenzar a operar; publicala solo cuando esté lista.', '/admin/website', null, false)
  }
  if (['retail', 'wholesale', 'mixed'].includes(model) && moduleEnabled('pos') && allowed('pos.sales.create')) {
    add('first-sale', 'Tu primera venta', 'Revisá productos, importe y forma de cobro antes de confirmar.', '/dashboard/pos?guide=first-sale', evidence.firstSale, false)
  }
  if (['service', 'mixed'].includes(model) && moduleEnabled('services') && allowed('settings.manage')) {
    add('first-reservation', 'Tu primera reserva', 'Reservar no significa haber realizado ni cobrado el servicio.', '/dashboard/agenda?guide=first-reservation', evidence.firstReservation, false)
  }
  if (['repair', 'mixed'].includes(model) && moduleEnabled('repairs') && allowed('repairs.orders.create')) {
    add('first-repair', 'Tu primera recepción de taller', 'Registrá el equipo y las condiciones. La recepción no equivale a entrega o cobro.', '/dashboard/repairs?guide=first-repair', evidence.firstRepair, false)
  }
  const required = tasks.filter(task => task.required)
  const next = tasks.find(task => task.required && task.state !== 'ready') ?? tasks.find(task => task.state !== 'ready')
  return {
    tasks,
    completed: required.filter(task => task.state === 'ready').length,
    total: required.length,
    nextTaskId: next?.id ?? null,
    operationMilestones: { sale: evidence.firstSale, reservation: evidence.firstReservation, service: evidence.firstService, repair: evidence.firstRepair, collection: evidence.firstCollection },
  }
}
