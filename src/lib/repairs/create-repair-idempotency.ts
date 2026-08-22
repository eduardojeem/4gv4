import { createHash } from 'node:crypto'

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    )
  }
  return value
}

export function fingerprintRepairCreateInput(input: unknown) {
  return createHash('sha256').update(JSON.stringify(stableValue(input))).digest('hex')
}

export function resolveRepairCreationReplay(
  existing: { creation_payload_hash?: string | null; creation_completed_at?: string | null },
  incomingHash: string
): { replayed: true } | { replayed: false; conflict: string } | { replayed: false; pending: string } {
  if (existing.creation_payload_hash === incomingHash) {
    if (existing.creation_completed_at) return { replayed: true }
    return {
      replayed: false,
      pending: 'La reparación todavía se está creando. Reintentá en unos segundos.',
    }
  }
  return {
    replayed: false,
    conflict: 'La clave de creación ya fue usada con otros datos.',
  }
}
