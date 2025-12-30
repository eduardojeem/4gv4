import type { RepairOrder } from '@/types/repairs'

export type StatusKey = 'pending' | 'in_progress' | 'waiting_parts' | 'on_hold' | 'completed' | 'cancelled'

export function stageToStatus(stage: RepairOrder['stage']): StatusKey {
  switch (stage) {
    case 'received':
      return 'pending'
    case 'diagnosis':
      return 'in_progress'
    case 'awaiting_parts':
      return 'waiting_parts'
    case 'in_repair':
      return 'in_progress'
    case 'quality_check':
      return 'on_hold'
    case 'ready':
      return 'completed'
    case 'delivered':
      return 'completed'
    default:
      return 'pending'
  }
}

export function statusToStage(status: StatusKey): RepairOrder['stage'] {
  switch (status) {
    case 'pending':
      return 'received'
    case 'in_progress':
      return 'in_repair'
    case 'waiting_parts':
      return 'awaiting_parts'
    case 'on_hold':
      return 'quality_check'
    case 'completed':
      return 'ready'
    case 'cancelled':
      return 'delivered'
    default:
      return 'received'
  }
}