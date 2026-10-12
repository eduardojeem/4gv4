import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { creditFileCustomerId, creditFileErrorResponse, creditFileResponse, requireCreditFileRole } from '@/lib/credits/credit-file-server'
import { retryCreditDocumentCleanup } from '@/lib/credits/credit-file-documents'
export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'credits' }, async (_request, context, routeContext) => {
  try {
    requireCreditFileRole(context)
    return creditFileResponse({ success: true, ...await retryCreditDocumentCleanup(context, await creditFileCustomerId(routeContext)) })
  } catch (error) { return creditFileErrorResponse(error) }
})
