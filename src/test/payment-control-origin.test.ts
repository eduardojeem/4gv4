// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: vi.fn() }))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: vi.fn() }))
vi.mock('@/lib/superadmin/auth', () => ({ getSuperAdminUser: vi.fn() }))
vi.mock('@/lib/saas/bank-transfers', () => ({ BankTransferError: class extends Error {} }))
import { requireTransferMutation } from '@/lib/saas/bank-transfer-api'
describe('payment mutation origin behind the development server and proxy', () => {
  it.each(['localhost:3000', '192.168.1.10:3000'])('accepts the browser host %s instead of the internal listening address', host => {
    expect(() => requireTransferMutation(new Request('http://0.0.0.0:3000/api/superadmin/payment-controls', { headers: { host, origin: `http://${host}`, 'sec-fetch-site': 'same-origin' } }))).not.toThrow()
  })
  it('accepts the original https host forwarded by the reverse proxy', () => {
    expect(() => requireTransferMutation(new Request('http://internal:3000/api', { headers: { host: 'internal:3000', 'x-forwarded-host': 'app.example.com', 'x-forwarded-proto': 'https', origin: 'https://app.example.com' } }))).not.toThrow()
  })
  it('rejects foreign origins and cross-site browser requests', () => {
    expect(() => requireTransferMutation(new Request('http://0.0.0.0:3000/api', { headers: { host: 'localhost:3000', origin: 'https://foreign.example' } }))).toThrow('El origen')
    expect(() => requireTransferMutation(new Request('http://localhost:3000/api', { headers: { origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' } }))).toThrow('El origen')
  })
})
