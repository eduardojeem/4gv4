import { describe, expect, it } from 'vitest'
import { parseBranchInventoryInitialization } from './inventory-initialization'

describe('parseBranchInventoryInitialization', () => {
  it('defaults new branches to an empty inventory', () => {
    expect(parseBranchInventoryInitialization(undefined)).toEqual({ mode: 'empty' })
  })

  it('accepts a source branch when inventory must be copied', () => {
    const sourceBranchId = '11111111-1111-4111-8111-111111111111'

    expect(parseBranchInventoryInitialization({
      mode: 'copy',
      source_branch_id: sourceBranchId,
    })).toEqual({ mode: 'copy', sourceBranchId })
  })

  it('rejects copy mode without a valid source branch', () => {
    expect(() => parseBranchInventoryInitialization({ mode: 'copy' }))
      .toThrow('Selecciona una sucursal de origen')
    expect(() => parseBranchInventoryInitialization({ mode: 'copy', source_branch_id: 'invalid' }))
      .toThrow('Selecciona una sucursal de origen')
  })

  it('rejects unknown initialization modes', () => {
    expect(() => parseBranchInventoryInitialization({ mode: 'duplicate' }))
      .toThrow('Modo de inventario inicial invalido')
  })
})
