import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  compensationInputSchema,
  compensationUpdateSchema,
} from '@/lib/finance/schemas'
import {
  assertFinanceEmployeeMembership,
  createEmployeeCompensation,
  deleteEmployeeCompensation,
  listEmployeeCompensation,
  resolveFinanceOrganizationId,
  toFinanceApiError,
  updateEmployeeCompensation,
} from '@/lib/finance/server'

const organizationSelectionSchema = z
  .object({ organizationId: z.uuid().optional(), organizationHeader: z.uuid().optional() })
  .refine(
    (input) => !input.organizationId || !input.organizationHeader || input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organización no coinciden.' },
  )
const compensationQuerySchema = organizationSelectionSchema.extend({ employeeId: z.uuid().optional() })
const compensationDeleteSchema = organizationSelectionSchema.extend({ id: z.uuid() })

function selectionFromRequest(request: NextRequest) {
  return {
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
  }
}

function errorResponse(error: unknown) {
  const financeError = toFinanceApiError(error)
  return NextResponse.json({ error: financeError.message, code: financeError.code }, { status: financeError.status })
}

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const query = compensationQuerySchema.safeParse({
    ...selectionFromRequest(request),
    employeeId: request.nextUrl.searchParams.get('employeeId') ?? undefined,
  })
  if (!query.success) return NextResponse.json({ error: 'Consulta inválida.' }, { status: 422 })

  try {
    const organizationId = await resolveFinanceOrganizationId(context, query.data.organizationHeader ?? query.data.organizationId)
    if (query.data.employeeId) await assertFinanceEmployeeMembership({ organizationId, employeeId: query.data.employeeId })
    return NextResponse.json({ compensation: await listEmployeeCompensation(organizationId, query.data.employeeId) })
  } catch (error) {
    return errorResponse(error)
  }
}

async function postHandler(request: NextRequest, context: AdminAuthContext) {
  const body = compensationInputSchema.safeParse(await request.json().catch(() => null))
  const selection = organizationSelectionSchema.safeParse(selectionFromRequest(request))
  if (!body.success || !selection.success) return NextResponse.json({ error: 'Compensación inválida.' }, { status: 422 })

  try {
    const organizationId = await resolveFinanceOrganizationId(context, selection.data.organizationHeader ?? selection.data.organizationId)
    await assertFinanceEmployeeMembership({ organizationId, employeeId: body.data.employeeId })
    const compensation = await createEmployeeCompensation({ organizationId, userId: context.user.id, input: body.data })
    return NextResponse.json({ compensation }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

async function patchHandler(request: NextRequest, context: AdminAuthContext) {
  const body = compensationUpdateSchema.safeParse(await request.json().catch(() => null))
  const selection = organizationSelectionSchema.safeParse(selectionFromRequest(request))
  if (!body.success || !selection.success) return NextResponse.json({ error: 'Compensación inválida.' }, { status: 422 })

  try {
    const organizationId = await resolveFinanceOrganizationId(context, selection.data.organizationHeader ?? selection.data.organizationId)
    await assertFinanceEmployeeMembership({ organizationId, employeeId: body.data.employeeId })
    const { id, ...input } = body.data
    return NextResponse.json({ compensation: await updateEmployeeCompensation({ organizationId, userId: context.user.id, id, input }) })
  } catch (error) {
    return errorResponse(error)
  }
}

async function deleteHandler(request: NextRequest, context: AdminAuthContext) {
  const query = compensationDeleteSchema.safeParse({ ...selectionFromRequest(request), id: request.nextUrl.searchParams.get('id') ?? undefined })
  if (!query.success) return NextResponse.json({ error: 'Compensación inválida.' }, { status: 422 })

  try {
    const organizationId = await resolveFinanceOrganizationId(context, query.data.organizationHeader ?? query.data.organizationId)
    await deleteEmployeeCompensation({ organizationId, id: query.data.id })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}

export const GET = withAdminAuth(getHandler)
export const POST = withAdminAuth(postHandler)
export const PATCH = withAdminAuth(patchHandler)
export const DELETE = withAdminAuth(deleteHandler)
