import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  invalidateAdminMfaPolicy,
  organizationRequiresAdminMfa,
  resetAdminMfaPolicyCache,
  type AdminMfaPolicyClient,
} from './admin-mfa-policy'

function clientReturning(result: { data: { require_admin_mfa?: boolean | null } | null; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })) }
  return { client: client as unknown as AdminMfaPolicyClient, maybeSingle, eq }
}

describe('exigencia de 2FA para administradores', () => {
  beforeEach(() => resetAdminMfaPolicyCache())

  it('lee la columna de la organización', async () => {
    const { client, eq } = clientReturning({ data: { require_admin_mfa: true }, error: null })
    await expect(organizationRequiresAdminMfa(client, 'org-1')).resolves.toBe(true)
    expect(eq).toHaveBeenCalledWith('organization_id', 'org-1')
  })

  it('sin fila o con la columna en null no se exige', async () => {
    await expect(organizationRequiresAdminMfa(clientReturning({ data: null, error: null }).client, 'org-1')).resolves.toBe(false)
    resetAdminMfaPolicyCache()
    await expect(
      organizationRequiresAdminMfa(clientReturning({ data: { require_admin_mfa: null }, error: null }).client, 'org-1')
    ).resolves.toBe(false)
  })

  it('un error (la migración todavía no llegó) no deja a todos afuera y no se guarda', async () => {
    const failing = clientReturning({ data: null, error: { code: '42703', message: 'column does not exist' } })
    await expect(organizationRequiresAdminMfa(failing.client, 'org-1')).resolves.toBe(false)
    const ok = clientReturning({ data: { require_admin_mfa: true }, error: null })
    await expect(organizationRequiresAdminMfa(ok.client, 'org-1')).resolves.toBe(true)
  })

  it('guarda el valor un minuto y se puede invalidar al cambiarlo', async () => {
    const first = clientReturning({ data: { require_admin_mfa: false }, error: null })
    await organizationRequiresAdminMfa(first.client, 'org-1', 1_000)
    const second = clientReturning({ data: { require_admin_mfa: true }, error: null })

    await expect(organizationRequiresAdminMfa(second.client, 'org-1', 30_000)).resolves.toBe(false)
    expect(second.maybeSingle).not.toHaveBeenCalled()
    await expect(organizationRequiresAdminMfa(second.client, 'org-1', 62_000)).resolves.toBe(true)

    const third = clientReturning({ data: { require_admin_mfa: false }, error: null })
    invalidateAdminMfaPolicy('org-1')
    await expect(organizationRequiresAdminMfa(third.client, 'org-1', 63_000)).resolves.toBe(false)
  })
})
