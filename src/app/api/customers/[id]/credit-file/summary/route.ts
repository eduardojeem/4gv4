import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { creditFileCustomerId, creditFileErrorResponse, creditFileResponse, loadCreditFileSummary } from '@/lib/credits/credit-file-server'

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'credits' }, async (_request, context, routeContext) => {
  try {
    return creditFileResponse({ success: true, summary: await loadCreditFileSummary(context, await creditFileCustomerId(routeContext)) })
  } catch (error) { return creditFileErrorResponse(error) }
})
