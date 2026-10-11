import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { creditFileCustomerId, creditFileErrorResponse, creditFileResponse, requireCreditFileRole } from '@/lib/credits/credit-file-server'
import { readCreditDocumentForm, uploadCreditDocument } from '@/lib/credits/credit-file-documents'

const uploadInput = z.object({ type: z.enum(['identity','address','income','other']), version: z.coerce.number().int().min(0) }).strict()
export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'credits' }, async (request, context, routeContext) => {
  try {
    requireCreditFileRole(context)
    const customerId = await creditFileCustomerId(routeContext)
    const form = await readCreditDocumentForm(request)
    const parsed = uploadInput.safeParse({ type: form.get('type'), version: form.get('version') })
    const file = form.get('file')
    if (!parsed.success || !(file instanceof File) || form.getAll('file').length !== 1 || form.getAll('type').length !== 1 || form.getAll('version').length !== 1
      || [...form.keys()].some(key => !['type','version','file'].includes(key))) {
      return creditFileResponse({ success: false, code: 'INVALID_CREDIT_DOCUMENT', error: 'Seleccioná un tipo y una única imagen válida.' }, 400)
    }
    return creditFileResponse({ success: true, file: await uploadCreditDocument(context, customerId, file, parsed.data.type, parsed.data.version) })
  } catch (error) { return creditFileErrorResponse(error) }
})
