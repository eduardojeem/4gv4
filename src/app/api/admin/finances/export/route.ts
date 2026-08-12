import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  assertFinanceBranchAccess,
  financeSummaryQuerySchema,
  getFinanceProfitability,
  getFinanceSummary,
  resolveFinanceOrganizationId,
  toFinanceApiError,
} from '@/lib/finance/server'

const exportKindSchema = z.enum(['summary', 'profitability'])
const exportGroupSchema = z.enum(['sale', 'repair', 'product', 'employee', 'branch'])

function parseQuery(request: NextRequest) {
  return financeSummaryQuerySchema.safeParse({
    organizationId: request.nextUrl.searchParams.get('organizationId') ?? undefined,
    organizationHeader: request.headers.get('x-organization-id') ?? undefined,
    startDate: request.nextUrl.searchParams.get('startDate') ?? undefined,
    endDate: request.nextUrl.searchParams.get('endDate') ?? undefined,
    branchId: request.nextUrl.searchParams.get('branchId') ?? undefined,
  })
}

function csvCell(value: string | number | boolean | null): string {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

function summaryCsv(summary: Awaited<ReturnType<typeof getFinanceSummary>>) {
  const rows = [
    ['periodo_inicio', summary.filters.startDate],
    ['periodo_fin', summary.filters.endDate],
    ['sucursal_id', summary.filters.branchId ?? ''],
    ['ingresos_devengados', summary.accrued.revenue],
    ['costos_directos_devengados', summary.accrued.directCosts],
    ['utilidad_bruta_devengada', summary.accrued.grossProfit],
    ['gastos_operativos_devengados', summary.accrued.operatingExpenses],
    ['nomina_devengada', summary.accrued.payrollCost],
    ['ganancia_neta_devengada', summary.accrued.netProfit],
    ['cobrado_efectivo', summary.cash.collected],
    ['pagado_efectivo', summary.cash.paid],
    ['flujo_neto_efectivo', summary.cash.netCashFlow],
    ['cobertura_completa', summary.complete],
  ]
  return ['metrica,valor', ...rows.map(([key, value]) => `${csvCell(key)},${csvCell(value as string | number | boolean | null)}`)].join('\n')
}

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const query = parseQuery(request)
  const kind = exportKindSchema.safeParse(request.nextUrl.searchParams.get('kind') ?? 'summary')
  const group = exportGroupSchema.safeParse(request.nextUrl.searchParams.get('group') ?? 'sale')
  if (!query.success || !kind.success || !group.success) {
    return NextResponse.json({ error: 'Exportacion financiera invalida.' }, { status: 422 })
  }

  try {
    const organizationId = await resolveFinanceOrganizationId(
      context,
      query.data.organizationHeader ?? query.data.organizationId,
    )
    if (query.data.branchId) {
      await assertFinanceBranchAccess({
        context,
        organizationId,
        branchId: query.data.branchId,
      })
    }
    const csv = kind.data === 'summary'
      ? summaryCsv(await getFinanceSummary(organizationId, query.data))
      : [
          'id,grupo,etiqueta,ingresos,costos_directos,utilidad_bruta,cobertura_completa',
          ...(await getFinanceProfitability(organizationId, query.data, group.data)).map((row) =>
            [row.id, row.group, row.label, row.revenue, row.directCosts, row.grossProfit, row.complete]
              .map(csvCell)
              .join(','),
          ),
        ].join('\n')
    const fileName = `finanzas-${kind.data}-${query.data.startDate}-${query.data.endDate}.csv`
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    const financeError = toFinanceApiError(error)
    return NextResponse.json(
      { error: financeError.message, code: financeError.code },
      { status: financeError.status },
    )
  }
}

export const GET = withAdminAuth(getHandler)
