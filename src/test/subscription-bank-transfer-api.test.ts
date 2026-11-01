// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  authenticated: true, role: 'admin', organizationRole: 'owner', superAdmin: false,
  record: { id: '00000000-0000-4000-8000-000000000001', organization_id: 'org-one', status: 'awaiting_receipt', receipt_path: null as string | null },
  create: vi.fn(), submit: vi.fn(), review: vi.fn(), lookup: vi.fn(), upload: vi.fn(), remove: vi.fn(), sign: vi.fn(), list: vi.fn(), settings: vi.fn(), plans: vi.fn(), updateSettings: vi.fn(),
  // after() corre el callback en el acto para poder verificar el aviso.
  after: vi.fn((callback: () => unknown) => { void callback() }), notifySubmitted: vi.fn(), notifyReviewed: vi.fn(), cancel: vi.fn(),
}))
vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: async () => state.authenticated ? { authenticated: true, user: { id: 'actor', role: state.role } } : { authenticated: false, reason: 'unauthenticated' } }))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: async () => ({ id: 'org-one', role: state.organizationRole }) }))
vi.mock('@/lib/superadmin/auth', () => ({ getSuperAdminUser: async () => state.superAdmin ? { id: 'actor', role: 'super_admin' } : null }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ storage: { from: () => ({ upload: state.upload, remove: state.remove, createSignedUrl: state.sign }) } }) }))
vi.mock('next/server', async (importOriginal) => ({ ...await importOriginal<typeof import('next/server')>(), after: state.after }))
vi.mock('@/lib/saas/bank-transfer-notifications', () => ({ notifyTransferReceiptSubmitted: state.notifySubmitted, notifyTransferReviewed: state.notifyReviewed }))
vi.mock('@/lib/saas/bank-transfers', () => ({
  BankTransferError: class extends Error { constructor(readonly code: string, message: string, readonly status: number) { super(message) } },
  createBankTransferRequest: state.create, submitBankTransferReceipt: state.submit, cancelBankTransferRequest: state.cancel, reviewBankTransferRequest: state.review,
  getBankTransferRequest: state.lookup, listBankTransferRequests: state.list, getBankTransferSettings: state.settings, getEligibleBankTransferPlans: state.plans, updateBankTransferSettings: state.updateSettings,
}))
import { BankTransferError } from '@/lib/saas/bank-transfers'
import { GET as listTenant, POST as create } from '@/app/api/admin/subscriptions/transfers/route'
import { POST as cancel } from '@/app/api/admin/subscriptions/transfers/[id]/cancel/route'
import { GET as receipt, POST as submit } from '@/app/api/admin/subscriptions/transfers/[id]/receipt/route'
import { POST as review } from '@/app/api/superadmin/subscription-transfers/[id]/review/route'
import { GET as superReceipt } from '@/app/api/superadmin/subscription-transfers/[id]/receipt/route'
import { PUT as saveSettings } from '@/app/api/superadmin/subscription-transfer-settings/route'
import { GET as listGlobal } from '@/app/api/superadmin/subscription-transfers/route'
const url = 'https://example.test/api/admin/subscriptions/transfers'
const context = () => ({ params: Promise.resolve({ id: state.record.id }) })
const json = (body: unknown, origin?: string) => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) })
function multipart(content = '%PDF-1.7\nfixture', filename = 'proof.pdf') {
  const boundary = 'transfer-test-boundary'
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n${content}\r\n--${boundary}--\r\n`
  return new Request(url, { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body })
}
beforeEach(() => {
  vi.clearAllMocks(); state.authenticated = true; state.role = 'admin'; state.organizationRole = 'owner'; state.superAdmin = false
  state.record.status = 'awaiting_receipt'; state.record.receipt_path = null
  state.lookup.mockImplementation(async (org, id) => (org === null || org === 'org-one') && id === state.record.id ? { ...state.record } : null)
  state.create.mockResolvedValue(state.record); state.submit.mockResolvedValue({ ...state.record, status: 'pending_review' })
  state.upload.mockResolvedValue({ error: null }); state.remove.mockResolvedValue({ error: null }); state.sign.mockResolvedValue({ data: { signedUrl: 'https://private.test/signed' }, error: null })
  state.settings.mockResolvedValue({ enabled: true }); state.plans.mockResolvedValue([])
  state.list.mockResolvedValue({ requests: [], pagination: { page: 1, hasMore: false } })
  state.review.mockResolvedValue({ request: { ...state.record, status: 'approved' }, applied: true })
})

describe('límites de confianza de pagos por transferencia', () => {
  it('cancela una solicitud propia y respeta el rol y el origen', async () => {
    state.cancel.mockResolvedValue({ ...state.record, status: 'cancelled' })
    expect((await cancel(json({}, 'https://evil.test'), context())).status).toBe(403)
    state.organizationRole = 'cashier'
    expect((await cancel(json({}), context())).status).toBe(403)
    expect(state.cancel).not.toHaveBeenCalled()
    state.organizationRole = 'owner'
    const response = await cancel(json({}), context())
    expect(response.status).toBe(200)
    expect(state.cancel).toHaveBeenCalledWith('org-one', 'actor', state.record.id)
    state.cancel.mockRejectedValue(new BankTransferError('TRANSFER_INVALID_STATE', 'Ya procesada', 409))
    expect((await cancel(json({}), context())).status).toBe(409)
  })
  it('rechaza usuarios sin sesión o sin rol de facturación antes de crear', async () => {
    state.authenticated = false; expect((await create(json({ planCode: 'PRO' }))).status).toBe(401)
    state.authenticated = true; state.organizationRole = 'cashier'; expect((await create(json({ planCode: 'PRO' }))).status).toBe(403)
    expect(state.create).not.toHaveBeenCalled()
  })
  it('no acepta importe, organización o aprobaciones enviadas por el cliente', async () => {
    expect((await create(json({ planCode: 'PRO', amount: 1, organizationId: 'other', status: 'approved' }))).status).toBe(400)
    expect(state.create).not.toHaveBeenCalled()
    expect((await create(json({ planCode: 'PRO' }))).status).toBe(200)
    expect(state.create).toHaveBeenCalledWith('org-one', 'actor', 'PRO')
  })
  it('rechaza mutaciones cross-origin', async () => {
    expect((await create(json({ planCode: 'PRO' }, 'https://other.test'))).status).toBe(403)
    expect(state.create).not.toHaveBeenCalled()
  })
  it('lista únicamente la organización autorizada y declara paginación', async () => {
    const response = await listTenant(new Request(`${url}?organizationId=other&page=2`))
    expect(state.list).toHaveBeenCalledWith({ organizationId: 'org-one', page: 2 })
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it('firma sólo comprobantes de la organización autorizada y con vencimiento corto', async () => {
    state.record.receipt_path = 'org-one/request/proof.pdf'
    expect((await receipt(new Request(url), context())).status).toBe(200)
    expect(state.lookup).toHaveBeenCalledWith('org-one', state.record.id)
    expect(state.sign).toHaveBeenCalledWith(state.record.receipt_path, 60, { download: true })
    state.lookup.mockResolvedValue(null)
    expect((await receipt(new Request(url), context())).status).toBe(404)
  })
  it('rechaza archivos ejecutables disfrazados y solicita revisión sin activar al adjuntar PDF', async () => {
    expect((await submit(multipart('<svg onload="alert(1)">'), context())).status).toBe(400)
    expect(state.upload).not.toHaveBeenCalled()
    expect((await submit(multipart(), context())).status).toBe(200)
    expect(state.submit).toHaveBeenCalledWith('org-one', 'actor', state.record.id, expect.objectContaining({ mimeType: 'application/pdf' }))
    expect(state.notifySubmitted).toHaveBeenCalledTimes(1)
    expect(state.review).not.toHaveBeenCalled()
  })
  it('no borra el comprobante confirmado si se pierde la respuesta tras commit', async () => {
    state.submit.mockImplementation(async (_org, _actor, _id, input) => { state.record.receipt_path = input.path; state.record.status = 'pending_review'; throw new Error('response lost') })
    expect((await submit(multipart(), context())).status).toBe(503)
    expect(state.remove).not.toHaveBeenCalled()
  })
  it('conserva el archivo en un timeout aunque la lectura aún muestre el estado anterior al commit', async () => {
    state.submit.mockRejectedValue(new BankTransferError('TRANSFER_UNAVAILABLE', 'Temporalmente no disponible', 503))
    expect((await submit(multipart(), context())).status).toBe(503)
    expect(state.record.status).toBe('awaiting_receipt')
    expect(state.remove).not.toHaveBeenCalled()
  })
  it('limpia un archivo huérfano sólo después de un rechazo definitivo de la base', async () => {
    state.submit.mockRejectedValue(new BankTransferError('TRANSFER_INVALID_STATE', 'Ya procesada', 409))
    expect((await submit(multipart(), context())).status).toBe(409)
    expect(state.remove).toHaveBeenCalledWith([expect.stringContaining(`org-one/${state.record.id}/`)])
  })
  it('sólo superadmin puede revisar o leer archivos globales', async () => {
    expect((await review(json({ decision: 'approve', bankOperationReference: 'BANK-1' }), context())).status).toBe(403)
    expect((await superReceipt(new Request(url), context())).status).toBe(403)
    expect(state.review).not.toHaveBeenCalled()
  })
  it('exige referencia verificada para aprobar y motivo para rechazar', async () => {
    state.superAdmin = true; state.role = 'super_admin'
    expect((await review(json({ decision: 'approve' }), context())).status).toBe(400)
    expect((await review(json({ decision: 'reject', reason: '' }), context())).status).toBe(400)
    expect((await review(json({ decision: 'approve', bankOperationReference: 'BANK-1' }), context())).status).toBe(200)
    expect(state.review).toHaveBeenCalledWith('actor', state.record.id, expect.objectContaining({ decision: 'approved', bankOperationReference: 'BANK-1' }))
    expect(state.notifyReviewed).toHaveBeenCalledTimes(1)
  })
  it('protege configuración bancaria y valida los datos antes de guardarlos', async () => {
    const settings = { enabled: true, bankName: 'Banco', accountHolder: 'Titular', accountNumber: '123', accountAlias: '', currency: 'PYG', instructions: '' }
    expect((await saveSettings(json(settings))).status).toBe(403)
    expect(state.updateSettings).not.toHaveBeenCalled()
    state.superAdmin = true; state.role = 'super_admin'
    expect((await saveSettings(json({ ...settings, accountNumber: '' }))).status).toBe(400)
    expect((await saveSettings(json({ ...settings, currency: 'USD' }))).status).toBe(400)
    state.updateSettings.mockResolvedValue(settings)
    expect((await saveSettings(json(settings))).status).toBe(200)
    expect(state.updateSettings).toHaveBeenCalledWith('actor', settings)
  })
  it('pagina la cola global sólo para superadmin', async () => {
    expect((await listGlobal(new Request(`${url}?page=3`))).status).toBe(403)
    state.superAdmin = true; state.role = 'super_admin'
    expect((await listGlobal(new Request(`${url}?page=3&status=pending_review`))).status).toBe(200)
    expect(state.list).toHaveBeenCalledWith({ status: 'pending_review', page: 3 })
  })
})
