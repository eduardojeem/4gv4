import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { CreditFilePolicySchema, type CreditFilePolicy } from '@/lib/credits/credit-file-contract'
import { creditFileErrorResponse, creditFileResponse, loadCreditFilePolicy, requireCreditFileRole, saveCreditFilePolicy } from '@/lib/credits/credit-file-server'

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'credits' }, async (_request, context) => {
  try { return creditFileResponse({ success: true, policy: await loadCreditFilePolicy(context) }) }
  catch (error) { return creditFileErrorResponse(error) }
})

export const PUT = withTenantAuth({ permission: 'settings.manage', module: 'credits' }, async (request, context) => {
  try {
    requireCreditFileRole(context, 'policy-write')
    const parsed = CreditFilePolicySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return creditFileResponse({ success: false, code: 'INVALID_CREDIT_FILE_POLICY', error: 'Revisá los requisitos de crédito.' }, 400)
    return creditFileResponse({ success: true, policy: await saveCreditFilePolicy(context, parsed.data as CreditFilePolicy) })
  } catch (error) { return creditFileErrorResponse(error) }
})
