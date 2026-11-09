/**
 * Qué caja abierta usa un cobro, una entrega o una compra de repuesto de una
 * reparación.
 *
 * Antes se buscaba `register_id === 'principal'`, pero `register_id` es el uuid
 * de la caja: nunca coincidía y se tomaba la última caja abierta de la
 * sucursal. Con dos cajas abiertas, el cobro de la caja 2 caía en la caja 1 y
 * las dos cerraban con diferencia. Ahora se usa la caja que abrió quien cobra;
 * si no abrió ninguna, la única abierta o, si hay varias, la más reciente.
 */
type OpenSession = { id: string; opened_by?: string | null }

type CashSessionQuery = {
  from: (table: 'cash_closures') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          is: (column: string, value: null) => {
            order: (column: string, options: { ascending: boolean }) => PromiseLike<{ data: unknown[] | null; error: unknown }>
          }
        }
      }
    }
  }
}

export function pickCashSession(sessions: OpenSession[], userId: string | null | undefined): string | null {
  if (sessions.length === 0) return null
  const own = userId ? sessions.find((session) => session.opened_by === userId) : undefined
  return (own ?? sessions[0]).id
}

export async function resolveRepairCashSessionId(
  supabase: unknown,
  scope: { organizationId: string; branchId: string; userId?: string | null },
): Promise<string | null> {
  const { data, error } = await (supabase as CashSessionQuery)
    .from('cash_closures')
    .select('id, opened_by')
    .eq('organization_id', scope.organizationId)
    .eq('branch_id', scope.branchId)
    .is('date', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return pickCashSession((data ?? []) as OpenSession[], scope.userId)
}
