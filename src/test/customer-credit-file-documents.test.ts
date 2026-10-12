// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantAuthContext } from '@/lib/api/withTenantAuth'
const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(), download: vi.fn(), foreign: false, lifecycle: 'ready' }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: mocks.admin }))
import { validateCreditDocument, readCreditDocumentForm, uploadCreditDocument, deleteCreditDocument, downloadCreditDocument } from '@/lib/credits/credit-file-documents'

const context = { user: { id: 'cf040000-0000-4000-8000-000000000001' }, organization: { id: 'cf140000-0000-4000-8000-000000000001', role: 'owner' } } as TenantAuthContext
const customerId = 'cf240000-0000-4000-8000-000000000001'
const documentId = 'cf440000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks(); mocks.foreign = false; mocks.lifecycle = 'ready'
  mocks.admin.mockImplementation(() => ({
    from: (table: string) => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: mocks.foreign ? null : table === 'customers' ? { id: customerId, credit_limit: 0 } : { id: documentId, lifecycle: mocks.lifecycle, object_path: 'server-only-path.jpg', filename: 'fixture.jpg', mime_type: 'image/jpeg', byte_size: 8 }, error: null }) }
      return query
    }, rpc: mocks.rpc,
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, download: mocks.download }) },
  }))
  mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'reserve_customer_credit_document') return { data: { id: documentId, objectPath: 'server-only-path.jpg' }, error: null }
    if (args.p_action === 'delete') mocks.lifecycle = 'deleted'
    return { data: { version: 2, status: 'draft', documents: [] }, error: null }
  })
  mocks.upload.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null })
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array([255,216,255])]), error: null })
})

const jpeg = new Uint8Array([255,216,255,224,1,2,255,217])
describe('private credit document validation', () => {
  it('accepts JPEG signature with matching MIME', () => {
    expect(validateCreditDocument(jpeg, 'image/jpeg')).toEqual({ mimeType: 'image/jpeg', extension: 'jpg' })
  })
  it.each([
    [new Uint8Array(), 'image/jpeg'], [new Uint8Array(4194305), 'image/jpeg'],
    [jpeg, 'image/png'], [new TextEncoder().encode('<svg/>'), 'image/svg+xml'],
    [new TextEncoder().encode('<html/>'), 'image/jpeg'], [new TextEncoder().encode('%PDF-1.4'), 'application/pdf'],
  ])('rejects empty, oversized or mismatched content %#', (bytes, mime) => {
    expect(() => validateCreditDocument(bytes, mime)).toThrow()
  })
  it('rejects multipart bodies over the limit without depending on Content-Length', async () => {
    const request = new Request('http://localhost/upload', { method: 'POST', body: new Uint8Array(4300001) })
    await expect(readCreditDocumentForm(request)).rejects.toMatchObject({ status: 413 })
  })
  it.each(['image/png', 'image/webp'])('accepts modern and PNG signatures %s', mime => {
    const bytes = mime === 'image/png' ? new Uint8Array([137,80,78,71,13,10,26,10,0]) : new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80,0])
    expect(validateCreditDocument(bytes, mime).mimeType).toBe(mime)
  })
  it('denies sellers before loading documents', async () => {
    await expect(downloadCreditDocument({ ...context, organization: { ...context.organization, role: 'seller' } }, customerId, documentId)).rejects.toMatchObject({ status: 403 })
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it('denies a customer from another organization', async () => {
    mocks.foreign = true
    await expect(downloadCreditDocument(context, customerId, documentId)).rejects.toMatchObject({ status: 404 })
    expect(mocks.download).not.toHaveBeenCalled()
  })
  it('compensates a failed upload without ever finalizing it', async () => {
    mocks.upload.mockResolvedValue({ error: { message: 'Storage unavailable' } })
    await expect(uploadCreditDocument(context, customerId, new File([jpeg], 'fixture.jpg', { type: 'image/jpeg' }), 'identity', 1)).rejects.toMatchObject({ code: 'DOCUMENT_UPLOAD_FAILED' })
    expect(mocks.lifecycle).toBe('deleted')
    expect(mocks.rpc.mock.calls.some(([, args]) => args.p_action === 'ready')).toBe(false)
    expect(mocks.remove).toHaveBeenCalledWith(['server-only-path.jpg'])
  })
  it('retires access before physical cleanup and reports cleanup failures', async () => {
    mocks.remove.mockImplementation(async () => { expect(mocks.lifecycle).toBe('deleted'); return { error: { message: 'Retry later' } } })
    expect(await deleteCreditDocument(context, customerId, documentId, 1)).toMatchObject({ cleanupPending: true })
    await expect(downloadCreditDocument(context, customerId, documentId)).rejects.toMatchObject({ status: 404 })
  })
  it('keeps logical deletion successful when Storage throws during cleanup', async () => {
    mocks.remove.mockRejectedValue(new Error('Connection interrupted'))
    expect(await deleteCreditDocument(context, customerId, documentId, 1)).toMatchObject({ cleanupPending: true })
  })
  it('rejects an oversized stored object even if its metadata says it is small', async () => {
    mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(4194305)]), error: null })
    await expect(downloadCreditDocument(context, customerId, documentId)).rejects.toMatchObject({ status: 413 })
  })
})
