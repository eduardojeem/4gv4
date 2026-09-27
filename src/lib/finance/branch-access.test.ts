import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `assertFinanceBranchAccess` es la compuerta de la que dependen todas las
 * rutas de finanzas y nomina con alcance por sucursal. Hasta ahora la unica
 * "cobertura" era buscar su nombre como texto dentro del archivo de la ruta,
 * asi que una comparacion invertida (`!==` -> `===`) pasaba sin que fallara
 * ningun test. Estos casos la ejecutan de verdad.
 */

const resolveBranchScopeForUser = vi.fn()

vi.mock('@/lib/branches/server', () => ({
  resolveBranchScopeForUser: (...args: unknown[]) => resolveBranchScopeForUser(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => {
    throw new Error('no debe consultarse la base para resolver el alcance de sucursal')
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('no debe consultarse la base para resolver el alcance de sucursal')
  },
}))

const { assertFinanceBranchAccess, FinanceApiError } = await import('./server')

const context = {
  user: { id: 'user-1', role: 'admin' },
  organizationId: 'org-1',
} as Parameters<typeof assertFinanceBranchAccess>[0]['context']

const params = {
  context,
  organizationId: 'org-1',
  branchId: 'branch-1',
}

describe('assertFinanceBranchAccess', () => {
  beforeEach(() => {
    resolveBranchScopeForUser.mockReset()
  })

  it('permite operar sobre la sucursal que el usuario tiene asignada', async () => {
    const branch = { id: 'branch-1', name: 'Casa central' }
    resolveBranchScopeForUser.mockResolvedValue({ branchId: 'branch-1', branch })

    await expect(assertFinanceBranchAccess(params)).resolves.toBe(branch)
  })

  it('pide el alcance en modo estricto para la sucursal solicitada', async () => {
    resolveBranchScopeForUser.mockResolvedValue({ branchId: 'branch-1', branch: null })

    await assertFinanceBranchAccess(params)

    expect(resolveBranchScopeForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
        requestedBranchId: 'branch-1',
        strict: true,
      }),
    )
  })

  it('rechaza cuando el alcance resuelto es otra sucursal', async () => {
    resolveBranchScopeForUser.mockResolvedValue({ branchId: 'branch-2', branch: null })

    await expect(assertFinanceBranchAccess(params)).rejects.toMatchObject({
      status: 403,
      code: 'FINANCE_BRANCH_PERMISSION_DENIED',
    })
  })

  it('rechaza cuando el usuario no tiene ninguna sucursal accesible', async () => {
    resolveBranchScopeForUser.mockResolvedValue({ branchId: null, branch: null })

    await expect(assertFinanceBranchAccess(params)).rejects.toBeInstanceOf(FinanceApiError)
  })

  it('falla cerrado si no se puede resolver el alcance', async () => {
    resolveBranchScopeForUser.mockRejectedValue(new Error('base caida'))

    await expect(assertFinanceBranchAccess(params)).rejects.toMatchObject({
      status: 403,
      code: 'FINANCE_BRANCH_PERMISSION_DENIED',
    })
  })
})
