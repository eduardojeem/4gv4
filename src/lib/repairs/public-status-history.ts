/**
 * Historial de estados que ve el cliente en /mis-reparaciones.
 *
 * repair_status_history tiene `new_status` y `notes`; las consultas públicas
 * pedían `status` y `note`, columnas inexistentes, así que PostgREST devolvía
 * error y la línea de tiempo nunca se mostraba.
 *
 * - Las notas NO se exponen: son del taller ("Fallo la prueba funcional: ...").
 * - Se colapsan estados repetidos consecutivos: hasta 2026-09 cada cambio se
 *   registraba varias veces (triggers + inserción explícita).
 */
export const PUBLIC_STATUS_HISTORY_COLUMNS = 'new_status, created_at'

export type StatusHistoryRow = { new_status: string | null; created_at: string }
export type PublicStatusHistoryEntry = { status: string; created_at: string }

export function toPublicStatusHistory(rows: StatusHistoryRow[] | null | undefined): PublicStatusHistoryEntry[] {
  const entries: PublicStatusHistoryEntry[] = []
  for (const row of rows ?? []) {
    if (!row.new_status) continue
    if (entries[entries.length - 1]?.status === row.new_status) continue
    entries.push({ status: row.new_status, created_at: row.created_at })
  }
  return entries
}
