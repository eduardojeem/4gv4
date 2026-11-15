import type { FinanceSummaryData } from './admin';
import type { FinanceScope } from './finance-admin';
import { assertFinanceSummaryIntegrity } from '../../../src/lib/finance/summary-integrity';
function cell(value: string | number) {
  const text=typeof value==='string'&&/^[=+\-@\t\r]/.test(value)?`'${value}`:String(value);
  return `"${text.replace(/"/g,'""')}"`;
}
export function financeSummaryCsv(data: FinanceSummaryData, scope: FinanceScope): string {
  assertFinanceSummaryIntegrity(data);
  const rows:(string|number)[][]=[['Empresa',scope.organizationId],['Sucursal',scope.branchId??'Todas'],['Desde',scope.startDate],['Hasta',scope.endDate],['Moneda',scope.currency],['Generado',data.generatedAt??'No informado'],['Métrica','Importe'],['Ingresos',data.accrued.revenue],['Costos directos',data.accrued.directCosts],['Gastos',data.accrued.operatingExpenses],['Nómina',data.accrued.payrollCost],['Ganancia neta',data.accrued.netProfit??'No disponible: faltan datos'],['Cobrado',data.cash.collected],['Pagado',data.cash.paid],['Flujo neto',data.cash.netCashFlow],['Por cobrar',data.receivables?.total??'No disponible']];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
