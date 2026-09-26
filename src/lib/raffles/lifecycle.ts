export type RaffleLifecycleStatus = 'draft' | 'published' | 'closed' | 'completed' | 'cancelled'

const transitions: Record<RaffleLifecycleStatus, readonly RaffleLifecycleStatus[]> = {
  draft: ['draft', 'published', 'cancelled'],
  published: ['published', 'closed', 'cancelled'],
  closed: ['closed'],
  completed: ['completed'],
  cancelled: ['cancelled'],
}

export function canTransitionRaffleStatus(from: RaffleLifecycleStatus, to: RaffleLifecycleStatus) {
  return transitions[from].includes(to)
}

export function raffleTransitionMessage(from: RaffleLifecycleStatus, to: RaffleLifecycleStatus) {
  if (canTransitionRaffleStatus(from, to)) return null
  if (from === 'completed' || from === 'cancelled') return 'Un sorteo finalizado o cancelado no se puede reactivar.'
  if (from === 'closed') return 'Un sorteo cerrado solo puede completarse mediante el sorteo oficial.'
  return `No se puede pasar un sorteo de ${from} a ${to}.`
}
