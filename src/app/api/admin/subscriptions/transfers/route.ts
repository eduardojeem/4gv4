import { createBankTransferSchema } from '@/lib/saas/bank-transfer-contract'
import { readTransferJson, requireTransferTenant, transferError, transferJson } from '@/lib/saas/bank-transfer-api'
import { createBankTransferRequest, getBankTransferSettings, getEligibleBankTransferPlans, listBankTransferRequests } from '@/lib/saas/bank-transfers'

export async function GET(request: Request) {
  try {
    const { organization, user } = await requireTransferTenant()
    const page = Math.max(1, Math.min(10000, Number.parseInt(new URL(request.url).searchParams.get('page') || '1', 10) || 1))
    const [settings, plans, list] = await Promise.all([
      getBankTransferSettings(), getEligibleBankTransferPlans(organization.id, user.id), listBankTransferRequests({ organizationId: organization.id, page }),
    ])
    return transferJson({ settings, plans, requests: list.requests, pagination: list.pagination })
  } catch (error) { return transferError(error) }
}

export async function POST(request: Request) {
  try {
    const { organization, user } = await requireTransferTenant()
    const { planCode } = createBankTransferSchema.parse(await readTransferJson(request))
    const created = await createBankTransferRequest(organization.id, user.id, planCode)
    return transferJson({ request: created })
  } catch (error) { return transferError(error) }
}
