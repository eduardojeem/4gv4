import { randomUUID } from 'node:crypto'
import { after } from 'next/server'
import { notifyTransferReceiptSubmitted } from '@/lib/saas/bank-transfer-notifications'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { BANK_TRANSFER_RECEIPT_BUCKET } from '@/lib/saas/bank-transfer-contract'
import { requireTransferMutation, requireTransferTenant, TransferApiError, transferError, transferIdSchema, transferJson } from '@/lib/saas/bank-transfer-api'
import { BankTransferError, getBankTransferRequest, submitBankTransferReceipt } from '@/lib/saas/bank-transfers'
import { detectTransferReceiptType, MAX_TRANSFER_MULTIPART_BYTES, MAX_TRANSFER_RECEIPT_BYTES, readBoundedBody } from '@/lib/saas/bank-transfer-upload'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const { organization } = await requireTransferTenant()
    const id = transferIdSchema.parse((await context.params).id)
    const transfer = await getBankTransferRequest(organization.id, id)
    if (!transfer?.receipt_path) throw new TransferApiError('Comprobante no encontrado.', 404)
    const { data, error } = await createAdminSupabase().storage.from(BANK_TRANSFER_RECEIPT_BUCKET).createSignedUrl(transfer.receipt_path, 60, { download: true })
    if (error || !data?.signedUrl) throw new Error('Receipt signing failed')
    return transferJson({ url: data.signedUrl })
  } catch (error) { return transferError(error) }
}

export async function POST(request: Request, context: Context) {
  let uploadedPath: string | null = null
  let uploadedOrganizationId: string | null = null
  let uploadedRequestId: string | null = null
  try {
    const { organization, user } = await requireTransferTenant()
    requireTransferMutation(request)
    const id = transferIdSchema.parse((await context.params).id)
    const transfer = await getBankTransferRequest(organization.id, id)
    if (!transfer) throw new TransferApiError('Solicitud no encontrada.', 404)
    if (transfer.status !== 'awaiting_receipt') throw new TransferApiError('Esta solicitud ya fue enviada o revisada.', 409)
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) throw new TransferApiError('Adjuntá un comprobante.', 415)
    if (Number(request.headers.get('content-length') || 0) > MAX_TRANSFER_MULTIPART_BYTES) throw new TransferApiError('El comprobante debe pesar hasta 3 MB.', 413)
    let bytes: Uint8Array
    try { bytes = await readBoundedBody(request.body, MAX_TRANSFER_MULTIPART_BYTES) }
    catch { throw new TransferApiError('El comprobante debe pesar hasta 3 MB.', 413) }
    const body = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(body).set(bytes)
    const form = await new Request(request.url, { method: 'POST', headers: request.headers, body }).formData()
    const file = form.get('file')
    const operationReference = z.string().trim().max(160).parse(form.get('operationReference') ?? '')
    if (!file || typeof file === 'string' || file.size === 0 || file.size > MAX_TRANSFER_RECEIPT_BYTES) throw new TransferApiError('Adjuntá un archivo de hasta 3 MB.', 400)
    const content = new Uint8Array(await file.arrayBuffer())
    const format = detectTransferReceiptType(content)
    if (!format) throw new TransferApiError('El comprobante debe ser PDF, JPG o PNG.', 400)
    const path = `${organization.id}/${id}/${randomUUID()}.${format.extension}`
    const storage = createAdminSupabase().storage.from(BANK_TRANSFER_RECEIPT_BUCKET)
    const upload = await storage.upload(path, content, { contentType: format.mimeType, upsert: false, cacheControl: '0' })
    if (upload.error) throw new Error('Receipt upload failed')
    uploadedPath = path
    uploadedOrganizationId = organization.id
    uploadedRequestId = id
    const updated = await submitBankTransferReceipt(organization.id, user.id, id, { path, mimeType: format.mimeType as 'image/jpeg' | 'image/png' | 'application/pdf', size: file.size, operationReference })
    uploadedPath = null
    after(() => notifyTransferReceiptSubmitted(updated))
    return transferJson({ request: updated })
  } catch (error) {
    if (uploadedPath && uploadedOrganizationId && uploadedRequestId && error instanceof BankTransferError && error.code !== 'TRANSFER_UNAVAILABLE') {
      // Only a definitive database rejection proves rollback. A timeout can
      // leave a transaction still in flight, so a subsequent stale SELECT is
      // not evidence that this object is safe to remove.
      try {
        const current = await getBankTransferRequest(uploadedOrganizationId, uploadedRequestId)
        if (current?.receipt_path !== uploadedPath) await createAdminSupabase().storage.from(BANK_TRANSFER_RECEIPT_BUCKET).remove([uploadedPath])
      } catch { /* Keep private orphan rather than risk deleting accepted proof. */ }
    }
    return transferError(error)
  }
}
