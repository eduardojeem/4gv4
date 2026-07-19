/**
 * Repair Status State Machine
 *
 * Define transiciones válidas entre estados de reparación.
 * Ningún cambio de estado puede ocurrir fuera de estas reglas.
 */

import type { RepairStatus } from '@/types/repairs'

/** Mapa de transiciones: estado actual → estados permitidos */
const ALLOWED_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  recibido: ['diagnostico', 'cancelado'],
  diagnostico: ['reparacion', 'pausado', 'cancelado'],
  reparacion: ['listo', 'pausado', 'cancelado'],
  pausado: ['diagnostico', 'reparacion'],
  listo: ['entregado', 'reparacion'],
  entregado: [],
  cancelado: ['recibido'],
}

/** Precondiciones para transicionar a un estado específico */
type RepairContext = {
  technician_id?: string | null
}

const PRECONDITIONS: Partial<Record<RepairStatus, (ctx: RepairContext) => string | null>> = {
  reparacion: (ctx) => {
    if (!ctx.technician_id) return 'Se requiere un técnico asignado para pasar a reparación'
    return null
  },
}

export interface TransitionValidation {
  allowed: boolean
  reason?: string
}

/**
 * Verifica si una transición de estado es válida.
 */
export function canTransition(
  from: RepairStatus,
  to: RepairStatus,
  context?: RepairContext
): TransitionValidation {
  // Mismo estado → no-op
  if (from === to) {
    return { allowed: true }
  }

  const allowedTargets = ALLOWED_TRANSITIONS[from]

  if (!allowedTargets || !allowedTargets.includes(to)) {
    return {
      allowed: false,
      reason: `No se puede cambiar de "${statusLabel(from)}" a "${statusLabel(to)}"`,
    }
  }

  // Verificar precondiciones del estado destino
  const precondition = PRECONDITIONS[to]
  if (precondition && context) {
    const error = precondition(context)
    if (error) {
      return { allowed: false, reason: error }
    }
  }

  return { allowed: true }
}

/**
 * Devuelve los estados a los que se puede transicionar desde el estado actual.
 */
export function getAvailableTransitions(from: RepairStatus): RepairStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? []
}

/**
 * Indica si un estado es terminal (no puede cambiar más).
 */
export function isTerminalStatus(status: RepairStatus): boolean {
  return (ALLOWED_TRANSITIONS[status] ?? []).length === 0
}

/**
 * Indica si un estado permite edición del formulario.
 */
export function isEditableStatus(status: RepairStatus): boolean {
  return status !== 'entregado' && status !== 'cancelado'
}

/** Labels para mensajes de error */
const STATUS_LABELS: Record<RepairStatus, string> = {
  recibido: 'Recibido',
  diagnostico: 'Diagnóstico',
  reparacion: 'Reparación',
  pausado: 'Pausado',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export function statusLabel(status: RepairStatus): string {
  return STATUS_LABELS[status] ?? status
}
