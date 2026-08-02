export type BranchInventoryInitialization =
  | { mode: 'empty' }
  | { mode: 'copy'; sourceBranchId: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseBranchInventoryInitialization(value: unknown): BranchInventoryInitialization {
  if (value === undefined || value === null) return { mode: 'empty' }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Modo de inventario inicial invalido.')
  }

  const input = value as Record<string, unknown>
  if (input.mode === 'empty') return { mode: 'empty' }

  if (input.mode === 'copy') {
    const sourceBranchId = typeof input.source_branch_id === 'string'
      ? input.source_branch_id.trim()
      : ''

    if (!UUID_RE.test(sourceBranchId)) {
      throw new Error('Selecciona una sucursal de origen valida.')
    }

    return { mode: 'copy', sourceBranchId }
  }

  throw new Error('Modo de inventario inicial invalido.')
}
