/**
 * Detección de "la migración todavía no se corrió".
 *
 * Las tablas de puntos y sorteos llegan en una migración que hay que aplicar a
 * mano. Hasta que eso pase, PostgREST responde que la relación no existe. Sin
 * este chequeo la sección mostraría "Error al cargar" y nadie sabría que lo
 * único que falta es correr un SQL.
 */

/** Códigos con los que Postgres/PostgREST avisan que la tabla o función no existe. */
const MISSING_SCHEMA_CODES = new Set([
  '42P01', // undefined_table
  '42883', // undefined_function
  'PGRST202', // la función no está en el schema cache
  'PGRST205', // la tabla no está en el schema cache
])

export const LOYALTY_MIGRATION_HINT =
  'El módulo de puntos y sorteos todavía no está instalado. Aplicá las migraciones ' +
  '20260827090000_create_loyalty_and_raffles.sql y 20260827090100_loyalty_and_raffles_operations.sql.'

export interface SupabaseLikeError {
  code?: string | null
  message?: string | null
  details?: string | null
}

/** true cuando el error es "falta la migración", no un fallo real. */
export function isLoyaltyModuleMissing(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false

  const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()

  // Si falla una función interna de Postgres (como gen_random_bytes de una extensión),
  // es un error de ejecución/configuración interna, no que falte la migración del módulo.
  if (text.includes('gen_random_bytes')) return false

  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true

  // El mensaje varía entre PostgREST y el driver; se busca el nombre de alguna
  // de las relaciones nuevas junto con la frase de "no existe".
  const mentionsOurTables = [
    'loyalty_settings',
    'loyalty_point_rules',
    'loyalty_ledger',
    'loyalty_accounts',
    'raffles',
    'raffle_tickets',
    'raffle_winners',
    'award_loyalty_points_for_sale',
    'redeem_points_for_raffle_tickets',
    'draw_raffle_winners',
    'adjust_loyalty_points',
  ].some((name) => text.includes(name))

  if (!mentionsOurTables) return false

  // «Could not find the 'x' column of 'raffles'» (PGRST204) o «relationship
  // between» (PGRST200) hablan de una columna o de un vínculo que falta, no de
  // la migración: mandar a correr un SQL que ya se corrió manda a la persona a
  // buscar donde no es.
  if (text.includes('column') || text.includes('columna') || text.includes('relationship')) return false

  return text.includes('does not exist') || text.includes('no existe') || text.includes('could not find')
}
