import type { SupabaseClient } from '@supabase/supabase-js'

export type CustomerPointsMovement = {
  id: string
  points: number
  description: string
  createdAt: string
}

export type CustomerPoints = {
  balance: number
  /** Cuánto vale el saldo si la tienda ofrece canje; null si no. */
  redemption: { value: number; min: number | null; balanceValue: number } | null
  /** Cómo se ganan: «1 punto cada Gs. 10.000». */
  earning: { currencyPerPoint: number; pointsPerUnit: number }
  movements: CustomerPointsMovement[]
}

/**
 * Los puntos del cliente en esta tienda, para su perfil.
 *
 * Hasta acá el cliente no podía ver sus puntos en ningún lado: ni en el perfil
 * ni en el comprobante. Si la tienda no tiene puntos prendidos, o el cliente
 * no tiene ficha, el perfil sigue sin la sección (null).
 */
export async function loadCustomerPoints(admin: SupabaseClient, organizationId: string, userId: string): Promise<CustomerPoints | null> {
  try {
    const [{ data: customer }, { data: settings }] = await Promise.all([
      admin.from('customers').select('id').eq('organization_id', organizationId).eq('profile_id', userId).maybeSingle(),
      admin.from('loyalty_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
    ])
    const config = settings as {
      enabled?: boolean
      currency_per_point?: number | string
      points_per_unit?: number | string
      redemption_value?: number | string | null
      min_redemption_points?: number | null
    } | null
    if (!customer || !config?.enabled) return null
    const customerId = (customer as { id: string }).id

    const [{ data: account }, { data: ledger }] = await Promise.all([
      admin.from('loyalty_accounts').select('balance').eq('organization_id', organizationId).eq('customer_id', customerId).maybeSingle(),
      admin
        .from('loyalty_ledger')
        .select('id, points, description, created_at')
        .eq('organization_id', organizationId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    const balance = Number((account as { balance?: number } | null)?.balance ?? 0)
    const value = Number(config.redemption_value)
    return {
      balance,
      redemption: Number.isFinite(value) && value > 0
        ? { value, min: config.min_redemption_points ?? null, balanceValue: Math.round(balance * value) }
        : null,
      earning: { currencyPerPoint: Number(config.currency_per_point) || 0, pointsPerUnit: Number(config.points_per_unit) || 1 },
      movements: ((ledger ?? []) as Array<{ id: string; points: number; description: string; created_at: string }>).map((row) => ({
        id: row.id,
        points: Number(row.points),
        description: row.description,
        createdAt: row.created_at,
      })),
    }
  } catch {
    return null
  }
}
