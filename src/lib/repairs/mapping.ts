import type { RepairOrder } from '@/types/repairs'

export type StatusKey = 'pending' | 'in_progress' | 'waiting_parts' | 'on_hold' | 'completed' | 'cancelled'

export function stageToStatus(stage: RepairOrder['stage']): StatusKey {
  // Manejo de estados en español (DB) y inglés (Legacy)
  const normalizedStage = String(stage).toLowerCase()

  switch (normalizedStage) {
    // Pendiente
    case 'recibido':
    case 'received':
    case 'pending':
      return 'pending'
    
    // En Progreso
    case 'diagnostico':
    case 'diagnosis':
    case 'reparacion':
    case 'in_repair':
      return 'in_progress'
    
    // Esperando Repuestos
    case 'esperando_repuestos':
    case 'awaiting_parts':
    case 'waiting_parts':
      return 'waiting_parts'
    
    // En Espera
    case 'pausado':
    case 'on_hold':
    case 'quality_check':
      return 'on_hold'
    
    // Completado
    case 'listo':
    case 'ready':
    case 'entregado':
    case 'delivered':
    case 'completed':
      return 'completed'
    
    // Cancelado
    case 'cancelado':
    case 'cancelled':
      return 'cancelled'
      
    default:
      return 'pending'
  }
}

export function statusToStage(status: StatusKey): RepairOrder['stage'] {
  // Retornamos los estados en español que espera la DB
  switch (status) {
    case 'pending':
      return 'recibido'
    case 'in_progress':
      return 'diagnostico' // O 'reparacion', dependiendo del flujo. Por defecto diagnostico.
    case 'waiting_parts':
      return 'esperando_repuestos'
    case 'on_hold':
      return 'pausado'
    case 'completed':
      return 'listo'
    case 'cancelled':
      return 'cancelado'
    default:
      return 'recibido'
  }
}