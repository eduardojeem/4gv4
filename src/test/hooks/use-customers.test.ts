import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(process.cwd(), 'src/hooks/use-customers.ts'), 'utf8')

describe('useCustomers tenant contract', () => {
  it('obtiene la organización activa y no acepta organization_id del consumidor', () => {
    expect(SOURCE).toContain('useActiveOrganization()')
    expect(SOURCE).toContain(".eq('organization_id', organization.id)")
    expect(SOURCE).toContain("{ ...customerData, organization_id: organization.id }")
  })

  it('expone estado, metadatos y acciones mediante el contrato vigente', () => {
    expect(SOURCE).toContain('isLoading,')
    expect(SOURCE).toContain('paginatedCustomers,')
    expect(SOURCE).toContain('metadata: {')
    expect(SOURCE).toContain('actions')
  })

  it('mantiene crear, actualizar y eliminar dentro de la organización', () => {
    expect(SOURCE).toContain('createCustomer: async')
    expect(SOURCE).toContain('updateCustomer: async')
    expect(SOURCE).toContain('deleteCustomer: async')
    expect(SOURCE.match(/\.eq\('organization_id', organization\.id\)/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('no activa refresco periódico salvo que se solicite', () => {
    expect(SOURCE).toContain('autoRefresh = false')
    expect(SOURCE).toContain('if (autoRefresh)')
  })
})
