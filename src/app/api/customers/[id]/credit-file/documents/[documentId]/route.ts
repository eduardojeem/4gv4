import { z } from 'zod'
import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { CreditFileError, creditFileCustomerId, creditFileErrorResponse, creditFileResponse, requireCreditFileRole } from '@/lib/credits/credit-file-server'
import { CreditDocumentReviewSchema, CreditDocumentDeleteSchema, deleteCreditDocument, downloadCreditDocument, reviewCreditDocument } from '@/lib/credits/credit-file-documents'

async function ids(routeContext: unknown) {
  const customerId = await creditFileCustomerId(routeContext)
  const params = await (routeContext as { params: Promise<{ documentId?: unknown }> }).params
  const parsed = z.string().uuid().safeParse(params.documentId)
  if (!parsed.success) throw new CreditFileError('INVALID_DOCUMENT_ID', 400, 'Documento inválido.')
  return { customerId, documentId: parsed.data }
}
export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'credits' }, async (_request, context, routeContext) => {
  try {
    requireCreditFileRole(context)
    const { customerId, documentId } = await ids(routeContext)
    const document = await downloadCreditDocument(context, customerId, documentId)
    return new NextResponse(new Uint8Array(document.bytes), { headers: {
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(document.filename).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`)}`,
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
    } })
  } catch (error) { return creditFileErrorResponse(error) }
})
export const PATCH = withTenantAuth({ permission: 'crm.customers.manage', module: 'credits' }, async (request, context, routeContext) => {
  try {
    requireCreditFileRole(context)
    const { customerId, documentId } = await ids(routeContext)
    const parsed = CreditDocumentReviewSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return creditFileResponse({ success: false, code: 'INVALID_DOCUMENT_REVIEW', error: 'Revisá los datos de verificación.' }, 400)
    return creditFileResponse({ success: true, file: await reviewCreditDocument(context, customerId, documentId, parsed.data) })
  } catch (error) { return creditFileErrorResponse(error) }
})
export const DELETE = withTenantAuth({ permission: 'crm.customers.manage', module: 'credits' }, async (request, context, routeContext) => {
  try {
    requireCreditFileRole(context)
    const { customerId, documentId } = await ids(routeContext)
    const parsed = CreditDocumentDeleteSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return creditFileResponse({ success: false, code: 'INVALID_DOCUMENT_DELETE', error: 'Recargá la ficha y reintentá.' }, 400)
    return creditFileResponse({ success: true, ...await deleteCreditDocument(context, customerId, documentId, parsed.data.version) })
  } catch (error) { return creditFileErrorResponse(error) }
})
