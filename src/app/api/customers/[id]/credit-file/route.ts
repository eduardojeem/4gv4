import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { CreditFileInputSchema } from '@/lib/credits/credit-file-contract'
import { creditFileCustomerId, creditFileErrorResponse, creditFileResponse, loadCreditFile, loadCreditFilePolicy, requireCreditFileRole, saveCreditFile } from '@/lib/credits/credit-file-server'

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'credits' }, async (_request, context, routeContext) => {
  try {
    requireCreditFileRole(context)
    const customerId = await creditFileCustomerId(routeContext)
    const file = await loadCreditFile(context, customerId)
    const policy = await loadCreditFilePolicy(context)
    return creditFileResponse({ success: true, file, policy })
  } catch (error) { return creditFileErrorResponse(error) }
})

export const PUT = withTenantAuth({ permission: 'crm.customers.manage', module: 'credits' }, async (request, context, routeContext) => {
  try {
    requireCreditFileRole(context)
    const customerId = await creditFileCustomerId(routeContext)
    const parsed = CreditFileInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return creditFileResponse({ success: false, code: 'INVALID_CREDIT_FILE', error: 'Revisá los datos de la ficha.' }, 400)
    return creditFileResponse({ success: true, file: await saveCreditFile(context, customerId, parsed.data) })
  } catch (error) { return creditFileErrorResponse(error) }
})
