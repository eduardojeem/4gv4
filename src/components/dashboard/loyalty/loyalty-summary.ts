import type { RaffleRow } from '@/hooks/use-loyalty'

export function getRaffleOperationalSummary(raffles: RaffleRow[]) {
  const now = Date.now()
  const soon = now + 7 * 24 * 60 * 60 * 1000

  return {
    open: raffles.filter((raffle) => raffle.status === 'published').length,
    closingSoon: raffles.filter((raffle) => {
      const end = Date.parse(raffle.ends_at)
      return raffle.status === 'published' && Number.isFinite(end) && end >= now && end <= soon
    }).length,
    tickets: raffles.reduce((total, raffle) => total + (raffle.tickets?.[0]?.count ?? 0), 0),
    pendingDraw: raffles.filter((raffle) => raffle.status === 'closed').length,
    completed: raffles.filter((raffle) => raffle.status === 'completed').length,
  }
}
