import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  listFinanceCategories,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const categoryQuerySchema = z
  .object({
    organizationId: z.uuid().optional(),
    organizationHeader: z.uuid().optional(),
    activeOnly: z.enum(['true', 'false']).default('true'),
  })
  .refine(
    (input) =>
      !input.organizationId ||
      !input.organizationHeader ||
      input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organizacion no coinciden.' },
  )

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const queryResult = categoryQuerySchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
    activeOnly: request.nextUrl.searchParams.get('activeOnly') ?? undefined,
  })
  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Consulta invalida.', details: queryResult.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(
      context,
      queryResult.data.organizationHeader ?? queryResult.data.organizationId,
    )
    const categories = await listFinanceCategories(
      organizationId,
      queryResult.data.activeOnly === 'true',
    )
    return NextResponse.json({ categories })
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json(
      { error: financeError.message, code: financeError.code },
      { status: financeError.status },
    )
  }
}

export const GET = withAdminAuth(getHandler)
