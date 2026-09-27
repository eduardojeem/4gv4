import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export interface AutoRaffleEntryResult {
  raffleName: string
  ticketNumbers: number[]
  drawDate?: string
}

/**
 * Canje automático de puntos al cerrar una venta.
 *
 * OJO con el nombre: esto **no** regala números por comprar. Lo que hace es
 * gastar el saldo de puntos del cliente —hasta cinco números— en el sorteo
 * abierto que cierre primero, sin preguntarle. La pantalla de alta decía
 * «cada Gs. 100.000 de compra = +1 número» y mostraba un simulador con tres
 * números distintos: nada de eso pasaba. El texto ya está corregido en
 * `RafflesManager`, y el interruptor viene apagado.
 *
 * Requisitos para que corra: el sorteo tiene `auto_entry_on_sale`, la venta
 * llega a `min_purchase_amount`, y al cliente le alcanzan los puntos.
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
      .select('id, name, points_per_ticket, max_tickets_per_customer, ends_at, requirements, min_purchase_amount, auto_entry_on_sale')
      .eq('organization_id', organizationId)
      .eq('status', 'published')
      .lte('starts_at', nowIso)
      .gte('ends_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(20)

    if (raffleError || !activeRaffles || activeRaffles.length === 0) {
      return null
    }

    const eligibleRaffles = activeRaffles.filter((candidate) => {
      if (candidate.auto_entry_on_sale === false) return false
      if (candidate.min_purchase_amount != null) return saleAmount >= Number(candidate.min_purchase_amount)
      // Compatibilidad con sorteos creados antes del campo estructurado.
      const match = candidate.requirements?.match(/desde Gs\.?\s*([\d\.]+)/i)
      if (!match?.[1]) return true
      return saleAmount >= Number(match[1].replace(/\./g, ''))
    })

    if (eligibleRaffles.length === 0) return null
    if (eligibleRaffles.length > 1) {
      logger.warn('Multiple eligible raffles found; using the one closing first', {
        organizationId,
        raffleIds: eligibleRaffles.map((item) => item.id),
      })
    }
    const raffle = [...eligibleRaffles].sort((a, b) => a.ends_at.localeCompare(b.ends_at))[0]


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
