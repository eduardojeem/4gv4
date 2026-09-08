export type NormalizedMovementType =
  | 'entrada'
  | 'salida'
  | 'ajuste'
  | 'transferencia'
  | 'devolucion'

/**
 * `movement_type` llega de varios escritores con nombres distintos: la RPC de
 * ajuste manda `in`/`out`/`adjustment`, la de transferencia `transfer`, el
 * trigger de venta `sale`, y hay historia con nombres en castellano.
 *
 * Habia dos traducciones separadas —una en `stock-control`, otra en
 * `stock-movements`— con reglas propias. Cuando apareciera un tipo nuevo, una
 * de las dos lo iba a clasificar como «ajuste» sin que nadie se diera cuenta.
 */
const MOVEMENT_TYPE_ALIASES: Record<NormalizedMovementType, readonly string[]> = {
  entrada: ['entrada', 'entry', 'in', 'purchase'],
  salida: ['salida', 'exit', 'out', 'sale'],
  ajuste: ['ajuste', 'adjustment', 'adjust'],
  transferencia: ['transferencia', 'transfer', 'branch_transfer'],
  devolucion: ['devolucion', 'devolución', 'return', 'refund'],
}

const BY_ALIAS = new Map<string, NormalizedMovementType>(
  Object.entries(MOVEMENT_TYPE_ALIASES).flatMap(([normalized, aliases]) =>
    aliases.map((alias) => [alias, normalized as NormalizedMovementType] as const)
  )
)

export function normalizeMovementType(raw: unknown): NormalizedMovementType {
  const value = String(raw ?? '').trim().toLowerCase()
  return BY_ALIAS.get(value) ?? 'ajuste'
}

/** Los valores crudos que hay que pedirle a la base para un tipo normalizado. */
export function movementTypeAliases(type: NormalizedMovementType): string[] {
  return [...MOVEMENT_TYPE_ALIASES[type]]
}

export const MOVEMENT_TYPE_LABELS: Record<NormalizedMovementType, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  transferencia: 'Transferencia',
  devolucion: 'Devolución',
}
