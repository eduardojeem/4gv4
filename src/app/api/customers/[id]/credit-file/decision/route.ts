import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { CreditFileDecisionSchema } from '@/lib/credits/credit-file-contract'
import { creditFileCustomerId, creditFileErrorResponse, creditFileResponse, decideCreditFile, requireCreditFileRole } from '@/lib/credits/credit-file-server'

export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'credits' }, async (request, context, routeContext) => {
  try {
    requireCreditFileRole(context)
    const customerId = await creditFileCustomerId(routeContext)
    const parsed = CreditFileDecisionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || (parsed.data.limit ?? 0) > 9_999_999_999.99) return creditFileResponse({ success: false, code: 'INVALID_CREDIT_FILE_DECISION', error: 'Ingresá un motivo y un límite válido para la decisión.' }, 400)
    return creditFileResponse({ success: true, file: await decideCreditFile(context, customerId, parsed.data) })
  } catch (error) { return creditFileErrorResponse(error) }
})
