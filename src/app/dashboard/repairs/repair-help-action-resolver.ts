import type { RepairHelpActionId } from '@/components/help/repair-help-actions'

export type RepairHelpCommand = 'new' | 'detail' | 'payment' | 'delivery'

export type RepairHelpActionContext = {
  hasSelectedRepair: boolean
  balance: number
  hasPrice: boolean
  canDeliver: boolean
}

export type RepairHelpDecision = {
  command?: RepairHelpCommand
  message?: string
}

export function resolveRepairHelpAction(
  actionId: RepairHelpActionId,
  context: RepairHelpActionContext,
): RepairHelpDecision {
  if (actionId === 'open-new-repair') return { command: 'new' }

  if (!context.hasSelectedRepair) {
    return { message: 'Elegí una reparación primero.' }
  }

  if (actionId === 'open-repair-detail') return { command: 'detail' }

  if (actionId === 'open-repair-payment') {
    if (context.balance <= 0) return { message: 'Esta reparación ya está pagada.' }
    if (!context.hasPrice) return { message: 'Definí el precio antes de cobrar.' }
    return { command: 'payment' }
  }

  if (actionId === 'open-repair-delivery') {
    if (!context.canDeliver) {
      return { message: 'Esta reparación todavía no está lista para entregar.' }
    }
    return { command: 'delivery' }
  }

  if (actionId === 'open-cash-register') {
    return { message: 'Abrí primero el pago; allí vas a encontrar el botón Abrir caja.' }
  }

  return { message: 'Elegí una reparación de la lista para continuar el recorrido.' }
}
