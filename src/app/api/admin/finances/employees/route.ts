import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  listFinanceEmployees,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const organizationSelectionSchema = z
  .object({ organizationId: z.uuid().optional(), organizationHeader: z.uuid().optional() })
  .refine(
    (input) => !input.organizationId || !input.organizationHeader || input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organización no coinciden.' },
  )

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const selection = organizationSelectionSchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
  })
  if (!selection.success) {
    return NextResponse.json({ error: 'Consulta inválida.' }, { status: 422 })
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(
      context,
      selection.data.organizationHeader ?? selection.data.organizationId,
    )
    return NextResponse.json({ employees: await listFinanceEmployees(organizationId) })
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json({ error: financeError.message, code: financeError.code }, { status: financeError.status })
  }
}

export const GET = withAdminAuth(getHandler)
