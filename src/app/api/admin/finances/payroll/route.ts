import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  payrollAdjustmentInputSchema,
  payrollGenerationInputSchema,
  payrollPreviewQuerySchema,
} from '@/lib/finance/schemas'
import {
  assertFinanceBranchAccess,
  createPayrollAdjustment,
  generatePayrollRun,
  getPayrollEntryBranch,
  getPayrollPreview,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .refine((key) => !key.toLowerCase().startsWith('payroll-system:'))
const organizationSelectionSchema = z
  .object({ organizationId: z.uuid().optional(), organizationHeader: z.uuid().optional() })
  .refine(
    (input) => !input.organizationId || !input.organizationHeader || input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organización no coinciden.' },
  )

function selectionFromRequest(request: NextRequest) {
  return { organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined, organizationHeader: request.headers.get('x-organization-id') ?? undefined }
}

function errorResponse(error: unknown) {
  const financeError = toFinanceApiError(error)
  return NextResponse.json({ error: financeError.message, code: financeError.code }, { status: financeError.status })
}

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const preview = payrollPreviewQuerySchema.safeParse({
    periodFrom: request.nextUrl.searchParams.get('periodFrom') ?? undefined,
    periodTo: request.nextUrl.searchParams.get('periodTo') ?? undefined,
    branchId: request.nextUrl.searchParams.get('branchId') ?? undefined,
  })
  const selection = organizationSelectionSchema.safeParse(selectionFromRequest(request))
  if (!preview.success || !selection.success) {
    return NextResponse.json({ error: 'Vista previa de nómina inválida.' }, { status: 422 })
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(context, selection.data.organizationHeader ?? selection.data.organizationId)
    if (preview.data.branchId) await assertFinanceBranchAccess({ context, organizationId, branchId: preview.data.branchId })
    return NextResponse.json({ preview: await getPayrollPreview(organizationId, preview.data) })
  } catch (error) {
    return errorResponse(error)
  }
}

async function postHandler(request: NextRequest, context: AdminAuthContext) {
  const body = payrollGenerationInputSchema.safeParse(await request.json().catch(() => null))
  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get('x-idempotency-key'))
  const selection = organizationSelectionSchema.safeParse(selectionFromRequest(request))
  if (!body.success || !idempotencyKey.success || !selection.success) {
    return NextResponse.json({ error: 'Generación de nómina inválida o sin clave de idempotencia válida.' }, { status: 422 })
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(context, selection.data.organizationHeader ?? selection.data.organizationId)
    if (body.data.branchId) await assertFinanceBranchAccess({ context, organizationId, branchId: body.data.branchId })
    const payroll = await generatePayrollRun({ organizationId, input: body.data, idempotencyKey: idempotencyKey.data })
    return NextResponse.json(payroll, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

async function patchHandler(request: NextRequest, context: AdminAuthContext) {
  const body = payrollAdjustmentInputSchema.safeParse(await request.json().catch(() => null))
  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get('x-idempotency-key'))
  const selection = organizationSelectionSchema.safeParse(selectionFromRequest(request))
  if (!body.success || !idempotencyKey.success || !selection.success) {
    return NextResponse.json({ error: 'Ajuste de nómina inválido o sin clave de idempotencia válida.' }, { status: 422 })
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(context, selection.data.organizationHeader ?? selection.data.organizationId)
    const entry = await getPayrollEntryBranch(organizationId, body.data.payrollEntryId)
    if (entry.branch_id) await assertFinanceBranchAccess({ context, organizationId, branchId: entry.branch_id })
    const adjustment = await createPayrollAdjustment({ organizationId, userId: context.user.id, input: body.data, idempotencyKey: idempotencyKey.data })
    return NextResponse.json({ adjustment }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export const GET = withAdminAuth(getHandler)
export const POST = withAdminAuth(postHandler)
export const PATCH = withAdminAuth(patchHandler)
