import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { payrollRunIdSchema } from '@/lib/finance/schemas'
import {
  approvePayrollRun,
  assertFinanceBranchAccess,
  getPayrollRunBranch,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const organizationSelectionSchema = z
  .object({ organizationId: z.uuid().optional(), organizationHeader: z.uuid().optional() })
  .refine(
    (input) => !input.organizationId || !input.organizationHeader || input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organización no coinciden.' },
  )

async function postHandler(request: NextRequest, context: AdminAuthContext, params: Promise<{ id: string }>) {
  const payrollRunId = payrollRunIdSchema.safeParse((await params).id)
  const selection = organizationSelectionSchema.safeParse({ organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined, organizationHeader: request.headers.get('x-organization-id') ?? undefined })
  if (!payrollRunId.success || !selection.success) {
    return NextResponse.json({ error: 'Aprobación de nómina inválida.' }, { status: 422 })
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(context, selection.data.organizationHeader ?? selection.data.organizationId)
    const run = await getPayrollRunBranch(organizationId, payrollRunId.data)
    if (run.branch_id) await assertFinanceBranchAccess({ context, organizationId, branchId: run.branch_id })
    const payroll = await approvePayrollRun({
      rpcName: 'approve_payroll_run_atomic',
      organizationId,
      payrollRunId: payrollRunId.data,
    })
    return NextResponse.json(payroll)
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json({ error: financeError.message, code: financeError.code }, { status: financeError.status })
  }
}

export function POST(request: NextRequest, routeContext: { params: Promise<{ id: string }> }) {
  return withAdminAuth((req, authContext) => postHandler(req, authContext, routeContext.params))(request)
}
