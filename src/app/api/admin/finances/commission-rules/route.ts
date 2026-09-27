import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  commissionRuleInputSchema,
  commissionRuleUpdateSchema,
} from '@/lib/finance/schemas'
import {
  assertFinanceBranchAccess,
  assertFinanceEmployeeMembership,
  createCommissionRule,
  deleteCommissionRule,
  getCommissionRuleBranch,
  listCommissionRules,
  resolveFinanceOrganizationId,
  toFinanceApiError,
  updateCommissionRule,
} from '@/lib/finance/server'

const organizationSelectionSchema = z
  .object({ organizationId: z.uuid().optional(), organizationHeader: z.uuid().optional() })
  .refine(
    (input) => !input.organizationId || !input.organizationHeader || input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organización no coinciden.' },
  )
const querySchema = organizationSelectionSchema.extend({ employeeId: z.uuid().optional(), branchId: z.uuid().optional() })
const deleteSchema = organizationSelectionSchema.extend({ id: z.uuid() })

function selectionFromRequest(request: NextRequest) {
  return { organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined, organizationHeader: request.headers.get('x-organization-id') ?? undefined }
}

function errorResponse(error: unknown) {
  const financeError = toFinanceApiError(error)
  return NextResponse.json({ error: financeError.message, code: financeError.code }, { status: financeError.status })
}

async function assertRuleScope(context: AdminAuthContext, organizationId: string, input: { employeeId?: string; branchId?: string }) {
  if (input.employeeId) await assertFinanceEmployeeMembership({ organizationId, employeeId: input.employeeId })
  if (input.branchId) await assertFinanceBranchAccess({ context, organizationId, branchId: input.branchId })
}

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const query = querySchema.safeParse({ ...selectionFromRequest(request), employeeId: request.nextUrl.searchParams.get('employeeId') ?? undefined, branchId: request.nextUrl.searchParams.get('branchId') ?? undefined })
  if (!query.success) return NextResponse.json({ error: 'Consulta inválida.' }, { status: 422 })
  try {
    const organizationId = await resolveFinanceOrganizationId(context, query.data.organizationHeader ?? query.data.organizationId)
    await assertRuleScope(context, organizationId, query.data)
    return NextResponse.json({ rules: await listCommissionRules(organizationId, query.data) })
  } catch (error) {
    return errorResponse(error)
  }
}

async function postHandler(request: NextRequest, context: AdminAuthContext) {
  const body = commissionRuleInputSchema.safeParse(await request.json().catch(() => null))
  const selection = organizationSelectionSchema.safeParse(selectionFromRequest(request))
  if (!body.success || !selection.success) return NextResponse.json({ error: 'Regla de comisión inválida.' }, { status: 422 })
  try {
    const organizationId = await resolveFinanceOrganizationId(context, selection.data.organizationHeader ?? selection.data.organizationId)
    await assertRuleScope(context, organizationId, body.data)
    return NextResponse.json({ rule: await createCommissionRule({ organizationId, userId: context.user.id, input: body.data }) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

async function patchHandler(request: NextRequest, context: AdminAuthContext) {
  const body = commissionRuleUpdateSchema.safeParse(await request.json().catch(() => null))
  const selection = organizationSelectionSchema.safeParse(selectionFromRequest(request))
  if (!body.success || !selection.success) return NextResponse.json({ error: 'Regla de comisión inválida.' }, { status: 422 })
  try {
    const organizationId = await resolveFinanceOrganizationId(context, selection.data.organizationHeader ?? selection.data.organizationId)
    const existingRule = await getCommissionRuleBranch(organizationId, body.data.id)
    if (existingRule.branch_id) await assertFinanceBranchAccess({ context, organizationId, branchId: existingRule.branch_id })
    await assertRuleScope(context, organizationId, body.data)
    const { id, ...input } = body.data
    return NextResponse.json({ rule: await updateCommissionRule({ organizationId, userId: context.user.id, id, input }) })
  } catch (error) {
    return errorResponse(error)
  }
}

async function deleteHandler(request: NextRequest, context: AdminAuthContext) {
  const query = deleteSchema.safeParse({ ...selectionFromRequest(request), id: request.nextUrl.searchParams.get('id') ?? undefined })
  if (!query.success) return NextResponse.json({ error: 'Regla de comisión inválida.' }, { status: 422 })
  try {
    const organizationId = await resolveFinanceOrganizationId(context, query.data.organizationHeader ?? query.data.organizationId)
    const existingRule = await getCommissionRuleBranch(organizationId, query.data.id)
    if (existingRule.branch_id) await assertFinanceBranchAccess({ context, organizationId, branchId: existingRule.branch_id })
    await deleteCommissionRule({ organizationId, id: query.data.id })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}

export const GET = withAdminAuth(getHandler)
export const POST = withAdminAuth(postHandler)
export const PATCH = withAdminAuth(patchHandler)
export const DELETE = withAdminAuth(deleteHandler)
