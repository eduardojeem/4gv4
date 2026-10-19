import { bankTransferSettingsSchema } from '@/lib/saas/bank-transfer-contract'
import { readTransferJson, requireTransferSuperAdmin, transferError, transferJson } from '@/lib/saas/bank-transfer-api'
import { getBankTransferSettings, updateBankTransferSettings } from '@/lib/saas/bank-transfers'

export async function GET() {
  try {
    await requireTransferSuperAdmin()
    return transferJson({ settings: await getBankTransferSettings() })
  } catch (error) { return transferError(error) }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireTransferSuperAdmin()
    const settings = bankTransferSettingsSchema.parse(await readTransferJson(request))
    return transferJson({ settings: await updateBankTransferSettings(actor.id, settings) })
  } catch (error) { return transferError(error) }
}
