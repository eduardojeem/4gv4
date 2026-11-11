import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cashBalance,
  cashSources,
  isEmptyFinanceSummary,
  financeBreakdown,
  financeHeadline,
  groupFinanceWarnings,
  sumDue,
} from '../../mobile/src/lib/finance-model';

const report = (accrued: Partial<Record<string, number | null>>) => ({
  accrued: { revenue: 1000, directCosts: 400, grossProfit: 600, operatingExpenses: 100, payrollCost: 100, netProfit: 400, ...accrued },
  cash: { collected: 0, paid: 0, netCashFlow: 0 },
  overdue: [],
  upcomingDue: [],
}) as Parameters<typeof financeHeadline>[0];

describe('finanzas en la app, en claro', () => {
  it('usa la ganancia del servidor y dice cuánto queda de cada 100', () => {
    expect(financeHeadline(report({}))).toEqual({ profit: 400, estimated: false, marginPct: 40 });
  });

  it('si faltan costos la ganancia se muestra igual, marcada como estimada', () => {
    const headline = financeHeadline(report({ grossProfit: null, netProfit: null, directCosts: 300 }));
    expect(headline).toEqual({ profit: 500, estimated: true, marginPct: 50 });
  });

  it('sin ventas no hay margen', () => {
    expect(financeHeadline(report({ revenue: 0, directCosts: 0, grossProfit: 0, netProfit: -200 })).marginPct).toBeNull();
  });

  it('agrupa las advertencias por tipo y cuenta ventas y reparaciones en palabras', () => {
    const groups = groupFinanceWarnings([
      { code: 'MISSING_DIRECT_COST', message: 'x', sourceType: 'sale' },
      { code: 'MISSING_DIRECT_COST', message: 'x', sourceType: 'sale' },
      { code: 'MISSING_DIRECT_COST', message: 'x', sourceType: 'repair' },
      { code: 'MISSING_CASH_TIMING', message: 'x', sourceType: 'repair' },
      { code: 'OTRO', message: 'Revisá esto' },
    ]);
    expect(groups.map((group) => group.title)).toEqual([
      '2 ventas, 1 reparación sin costo cargado',
      '1 reparación con cobros sin fecha',
      '1 dato para revisar',
    ]);
    expect(groups[2].hint).toBe('Revisá esto');
    expect(groupFinanceWarnings(undefined)).toEqual([]);
  });

  it('la barra reparte lo vendido y no se dibuja con pérdida', () => {
    expect(financeBreakdown(report({}), 400)).toEqual({ goods: 0.4, expenses: 0.1, payroll: 0.1, profit: 0.4 });
    expect(financeBreakdown(report({}), -10)).toBeNull();
    expect(financeBreakdown(report({ revenue: 0 }), 0)).toBeNull();
  });

  it('suma lo que se debe', () => {
    expect(sumDue([{ id: 'a', dueDate: '2026-11-01', amount: 100 }, { id: 'b', dueDate: '2026-11-02', amount: 50 }])).toBe(150);
  });

  it('la pantalla no muestra «No calculable» ni la zona horaria, y oculta sucursales si hay una sola', () => {
    const screen = readFileSync(join(__dirname, '../../mobile/src/app/admin/finances.tsx'), 'utf8');
    expect(screen).not.toContain('No calculable');
    expect(screen).not.toContain('Zona horaria');
    expect(screen).toContain('branches.length > 1 &&');
    expect(screen).toContain("router.push('/panel/products' as never)");
  });

  it('dice de dónde sale lo cobrado y lo pagado, solo con lo que tuvo movimiento', () => {
    const parts = cashSources({
      collected: { sales: 1000, installments: 150, repairs: 0, orders: 0, cashOverage: 0 },
      paid: { expenses: 300, payroll: 0, technicians: 0, refunds: 200, paymentFees: 12, cashShortages: 0 },
    })!;
    expect(parts.collected.map((part) => [part.label, part.amount])).toEqual([['Ventas', 1000], ['Cuotas de créditos', 150]]);
    expect(parts.paid.map((part) => part.label)).toEqual(['Gastos y cuentas pagadas', 'Devoluciones a clientes', 'Comisiones de tarjeta y cobros']);
    // Un servidor viejo no manda la apertura: la pantalla queda con los totales.
    expect(cashSources(undefined)).toBeNull();
  });

  it('la apertura de cobros no impide mostrar «Sin movimientos»', () => {
    const empty = {
      ...report({ revenue: 0, directCosts: 0, grossProfit: 0, operatingExpenses: 0, payrollCost: 0, netProfit: 0 }),
      complete: true,
      coverageWarnings: [],
      cash: {
        collected: 0, paid: 0, netCashFlow: 0,
        breakdown: {
          collected: { sales: 0, installments: 0, repairs: 0, orders: 0, cashOverage: 0 },
          paid: { expenses: 0, payroll: 0, technicians: 0, refunds: 0, paymentFees: 0, cashShortages: 0 },
        },
      },
    } as Parameters<typeof isEmptyFinanceSummary>[0];
    expect(isEmptyFinanceSummary(empty)).toBe(true);
  });

  it('el saldo de cobros y pagos sale una sola vez, con signo y en palabras', () => {
    expect(cashBalance(1500)).toEqual({ sign: '+', tone: 'good', text: 'Entró más plata de la que salió.' });
    expect(cashBalance(-200)).toEqual({ sign: '−', tone: 'bad', text: 'Salió más plata de la que entró.' });
    expect(cashBalance(0).sign).toBe('');
    expect(cashBalance(Number.NaN).tone).toBe('neutral');

    const screen = readFileSync(join(__dirname, '../../mobile/src/app/admin/finances.tsx'), 'utf8');
    expect(screen).not.toContain('Entró menos salió');
    expect(screen).not.toContain('label="Diferencia"');
    expect(screen).toContain('Cobros y pagos');
    expect(screen).toContain('¿Por qué no coincide con la ganancia?');
  });
});
