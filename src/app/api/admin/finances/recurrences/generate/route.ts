import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'
import { createClient } from '@/lib/supabase/server'

const recurrenceGenerationSchema = z.object({
  generationDate: z.iso.date(),
})
const organizationSelectionSchema = z
  .object({
    organizationId: z.uuid().optional(),
    organizationHeader: z.uuid().optional(),
  })
  .refine(
    (input) =>
      !input.organizationId ||
      !input.organizationHeader ||
      input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organizacion no coinciden.' },
  )

async function postHandler(request: NextRequest, context: AdminAuthContext) {
  const bodyResult = recurrenceGenerationSchema.safeParse(
    await request.json().catch(() => null),
  )
  const organizationResult = organizationSelectionSchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
  })
  if (!bodyResult.success || !organizationResult.success) {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 422 })
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(
      context,
      organizationResult.data.organizationHeader ??
        organizationResult.data.organizationId,
    )
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
      'generate_recurring_finance_obligations',
      {
        p_generation_date: bodyResult.data.generationDate,
        p_organization_id: organizationId,
      },
    )
    if (error) throw error

    return NextResponse.json({ generatedCount: Number(data ?? 0) })
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json(
      { error: financeError.message, code: financeError.code },
      { status: financeError.status },
    )
  }
}

export const POST = withAdminAuth(postHandler)
