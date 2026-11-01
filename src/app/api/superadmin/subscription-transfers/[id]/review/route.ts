import { after } from 'next/server'
import { z } from 'zod'
import { notifyTransferReviewed } from '@/lib/saas/bank-transfer-notifications'
import { readTransferJson, requireTransferSuperAdmin, transferError, transferIdSchema, transferJson } from '@/lib/saas/bank-transfer-api'
import { reviewBankTransferRequest } from '@/lib/saas/bank-transfers'

const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']), reason: z.string().trim().max(2000).optional(), bankOperationReference: z.string().trim().max(160).optional(),
}).strict().refine(value => value.decision === 'approve' ? Boolean(value.bankOperationReference) : Boolean(value.reason), { message: 'Indicá la referencia bancaria para aprobar o el motivo para rechazar.' })

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireTransferSuperAdmin()
    const id = transferIdSchema.parse((await context.params).id)
    const body = reviewSchema.parse(await readTransferJson(request))
    const result = await reviewBankTransferRequest(actor.id, id, { ...body, decision: body.decision === 'approve' ? 'approved' : 'rejected' })
    after(() => notifyTransferReviewed(result.request))
    return transferJson(result)
  } catch (error) { return transferError(error) }
}
