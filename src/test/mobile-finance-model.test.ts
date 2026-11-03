import { describe, expect, it } from 'vitest';
import {
  financePeriodDates,
  financeResultState,
  isEmptyFinanceSummary,
  financeReportKey,
} from '../../mobile/src/lib/finance-model';

describe('resumen financiero móvil', () => {
  it('consulta 30 fechas inclusive y respeta la zona del negocio', () => {
    const result = financePeriodDates(
      '30d',
      'America/Asuncion',
      new Date('2026-11-01T01:00:00Z'),
    );
    expect(result).toEqual({ startDate: '2026-10-02', endDate: '2026-10-31' });
    expect(
      financePeriodDates(
        'today',
        'America/Asuncion',
        new Date('2026-11-01T01:00:00Z'),
      ),
    ).toEqual({ startDate: '2026-10-31', endDate: '2026-10-31' });
  });
  it('resuelve mes y año por calendario del negocio', () => {
    expect(
      financePeriodDates(
        'month',
        'America/Asuncion',
        new Date('2026-11-01T01:00:00Z'),
      ).startDate,
    ).toBe('2026-10-01');
    expect(
      financePeriodDates(
        'year',
        'America/Asuncion',
        new Date('2026-01-01T01:00:00Z'),
      ).startDate,
    ).toBe('2025-01-01');
  });
  it('no presenta utilidad desconocida o cero como ganancia', () => {
    expect(financeResultState(null)).toBe('No calculable');
    expect(financeResultState(0)).toBe('Sin ganancia ni pérdida');
    expect(financeResultState(-10)).toBe('Pérdida neta');
    expect(financeResultState(10)).toBe('Ganancia neta');
  });
  it('no reutiliza reportes de otro comercio, permiso, período o sucursal', () => {
    const key = financeReportKey('org-a', 1, 'month', 'all');
    expect(financeReportKey('org-b', 1, 'month', 'all')).not.toBe(key);
    expect(financeReportKey('org-a', 2, 'month', 'all')).not.toBe(key);
    expect(financeReportKey('org-a', 1, 'today', 'all')).not.toBe(key);
    expect(financeReportKey('org-a', 1, 'month', 'branch')).not.toBe(key);
  });
  it('un informe incompleto nunca se presenta como vacío', () => {
    const empty = {
      accrued: {
        revenue: 0,
        directCosts: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        payrollCost: 0,
        netProfit: 0,
      },
      cash: { collected: 0, paid: 0, netCashFlow: 0 },
      overdue: [],
      upcomingDue: [],
    };
    expect(isEmptyFinanceSummary(empty)).toBe(true);
    expect(isEmptyFinanceSummary({ ...empty, complete: false })).toBe(false);
    expect(
      isEmptyFinanceSummary({
        ...empty,
        cash: { collected: 20, paid: 20, netCashFlow: 0 },
      }),
    ).toBe(false);
  });
});
