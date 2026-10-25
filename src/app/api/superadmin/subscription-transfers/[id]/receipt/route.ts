import { createAdminSupabase } from '@/lib/supabase/admin'
import { BANK_TRANSFER_RECEIPT_BUCKET } from '@/lib/saas/bank-transfer-contract'
import { requireTransferSuperAdmin, TransferApiError, transferError, transferIdSchema, transferJson } from '@/lib/saas/bank-transfer-api'
import { getBankTransferRequest } from '@/lib/saas/bank-transfers'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireTransferSuperAdmin()
    const id = transferIdSchema.parse((await context.params).id)
    const request = await getBankTransferRequest(null, id)
    if (!request?.receipt_path) throw new TransferApiError('Comprobante no encontrado.', 404)
    const { data, error } = await createAdminSupabase().storage.from(BANK_TRANSFER_RECEIPT_BUCKET).createSignedUrl(request.receipt_path, 60, { download: true })
    if (error || !data?.signedUrl) throw new Error('Receipt signing failed')
    return transferJson({ url: data.signedUrl })
  } catch (error) { return transferError(error) }
}
