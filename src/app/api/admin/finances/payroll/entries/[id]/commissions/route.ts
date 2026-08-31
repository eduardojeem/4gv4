import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  assertFinanceBranchAccess,
  getPayrollEntryBranch,
  getPayrollEntryCommissions,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const payrollEntryIdSchema = z.uuid()

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
  // Se valida como uuid igual que en las rutas hermanas: sin esto un id con
  // formato invalido llega a Postgres y vuelve como 500 en vez de 422.
  const entryId = payrollEntryIdSchema.safeParse(resolvedParams?.id)
  if (!entryId.success) {
    return NextResponse.json({ error: 'Identificador de entrada de nómina inválido.' }, { status: 422 })
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
    // Mismo alcance por sucursal que la ruta hermana de pagos: leer el desglose
    // de comisiones de un empleado es tan sensible como pagarle.
    const entry = await getPayrollEntryBranch(organizationId, entryId.data)
    if (entry.branch_id) {
      await assertFinanceBranchAccess({ context, organizationId, branchId: entry.branch_id })
    }
    const data = await getPayrollEntryCommissions(organizationId, entryId.data)
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
