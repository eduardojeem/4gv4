import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export interface AutoRaffleEntryResult {
  raffleName: string
  ticketNumbers: number[]
  drawDate?: string
}

/**
 * Verifica si hay sorteos activos y asigna automáticamente tickets al cliente
 * tras completar una compra calificada en el POS / tienda.
 */
export async function tryAutoRaffleEntryForSale(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
  saleAmount: number
): Promise<AutoRaffleEntryResult | null> {
  try {
    if (!organizationId || !customerId || saleAmount <= 0) return null

    // 1. Buscar sorteos abiertos actualmente
    const nowIso = new Date().toISOString()
    const { data: activeRaffles, error: raffleError } = await supabase
      .from('raffles')
      .select('id, name, points_per_ticket, max_tickets_per_customer, ends_at, requirements')
      .eq('organization_id', organizationId)
      .eq('status', 'published')
      .lte('starts_at', nowIso)
      .gte('ends_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)

    if (raffleError || !activeRaffles || activeRaffles.length === 0) {
      return null
    }

    const raffle = activeRaffles[0]

    // Validar monto mínimo si está definido en los requisitos del sorteo
    if (raffle.requirements) {
      const match = raffle.requirements.match(/desde Gs\.?\s*([\d\.]+)/i)
      if (match && match[1]) {
        const minAmount = Number(match[1].replace(/\./g, ''))
        if (minAmount > 0 && saleAmount < minAmount) {
          return null // La compra no alcanza el monto mínimo configurado
        }
      }
    }

    // 2. Consultar el saldo de puntos disponible del cliente
    const { data: account } = await supabase
      .from('loyalty_accounts')
      .select('balance, self_excluded_until')
      .eq('customer_id', customerId)
      .maybeSingle()

    if (!account || (account.self_excluded_until && new Date(account.self_excluded_until) > new Date())) {
      return null
    }

    // 3. Calcular cuántos tickets puede canjear con los puntos disponibles de la compra
    const pointsPerTicket = raffle.points_per_ticket || 50
    const affordableTickets = Math.floor((account.balance || 0) / pointsPerTicket)

    if (affordableTickets <= 0) {
      return null
    }

    // Cantidad a canjear automáticamente (por defecto 1 o los que alcancen hasta 5)
    const quantityToRedeem = Math.min(affordableTickets, 5)

    // 4. Ejecutar el canje oficial atómico en la base de datos
    const { data: tickets, error: redeemError } = await supabase.rpc('redeem_raffle_tickets', {
      p_raffle_id: raffle.id,
      p_customer_id: customerId,
      p_quantity: quantityToRedeem,
    })

    if (redeemError || !tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return null
    }

    const ticketNumbers = tickets
      .map((t: { ticket_number?: number }) => t.ticket_number)
      .filter((n): n is number => typeof n === 'number')

    if (ticketNumbers.length === 0) return null

    logger.info('Auto raffle entry assigned on sale', {
      customerId,
      raffleId: raffle.id,
      ticketsCount: ticketNumbers.length,
    })

    return {
      raffleName: raffle.name,
      ticketNumbers,
      drawDate: new Date(raffle.ends_at).toLocaleDateString('es-PY'),
    }
  } catch (err) {
    logger.warn('Error in tryAutoRaffleEntryForSale', { error: err })
    return null
  }
}
