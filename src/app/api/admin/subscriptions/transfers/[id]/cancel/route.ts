import { requireTransferMutation, requireTransferTenant, transferError, transferIdSchema, transferJson } from '@/lib/saas/bank-transfer-api'
import { cancelBankTransferRequest } from '@/lib/saas/bank-transfers'

/** Cancela una solicitud que todavía espera el comprobante, para poder pedir otra. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { organization, user } = await requireTransferTenant()
    requireTransferMutation(request)
    const id = transferIdSchema.parse((await context.params).id)
    const updated = await cancelBankTransferRequest(organization.id, user.id, id)
    return transferJson({ request: updated })
  } catch (error) { return transferError(error) }
}
