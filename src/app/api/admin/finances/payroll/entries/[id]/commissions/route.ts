import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  getPayrollEntryCommissions,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const organizationSelectionSchema = z
  .object({ organizationId: z.uuid().optional(), organizationHeader: z.uuid().optional() })
  .refine(
    (input) => !input.organizationId || !input.organizationHeader || input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organización no coinciden.' },
  )

function selectionFromRequest(request: NextRequest) {
  return {
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
  }
}

async function getHandler(
  request: NextRequest,
  context: AdminAuthContext,
  paramsPromise?: Promise<{ id: string }> | { id: string },
) {
  const resolvedParams = paramsPromise instanceof Promise ? await paramsPromise : paramsPromise
  const entryId = resolvedParams?.id
  if (!entryId) {
    return NextResponse.json({ error: 'Falta el identificador de la entrada de nómina.' }, { status: 400 })
  }

  const selection = organizationSelectionSchema.safeParse(selectionFromRequest(request))
  if (!selection.success) {
    return NextResponse.json({ error: 'Selector de organización inválido.' }, { status: 422 })
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(
      context,
      selection.data.organizationHeader ?? selection.data.organizationId,
    )
    const data = await getPayrollEntryCommissions(organizationId, entryId)
    return NextResponse.json(data)
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json(
      { error: financeError.message, code: financeError.code },
      { status: financeError.status },
    )
  }
}

export function GET(
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> },
) {
  return withAdminAuth((req, authContext) =>
    getHandler(req, authContext, routeContext.params),
  )(request)
}
