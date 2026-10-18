import { apiFetch, ApiError } from './api';
import type { PosSession } from './pos';

/** Caja: historial de cierres y arqueos, con las mismas APIs que /dashboard/pos/caja. */

export type Closure = {
  id: string;
  registerName: string;
  openedAt: string | null;
  closedAt: string;
  openingBalance: number;
  countedCash: number;
  expectedCash: number;
  difference: number;
  salesTotal: number;
  cash: number;
  card: number;
  transfer: number;
  mixed: number;
  cashIn: number;
  cashOut: number;
  movements: number;
  notes: string | null;
};

export async function fetchClosures(branchId?: string) {
  const result = await apiFetch<{ data: Closure[] }>('/api/mobile/cash-register/history?limit=40', {
    headers: branchId ? { 'x-branch-id': branchId } : undefined,
  });
  return result.data ?? [];
}

/** Billetes y monedas en circulación en Paraguay, de mayor a menor. */
export const BILLS = [100000, 50000, 20000, 10000, 5000, 2000];
export const COINS = [1000, 500, 100, 50];

/** Arqueo sin cerrar: queda registrado con su diferencia contra lo esperado. */
export async function recordCashCount(input: { session: PosSession; total: number; bills: Record<string, number>; coins: Record<string, number> }) {
  if (!input.session.session) throw new Error('No hay una caja abierta.');
  try {
    return await apiFetch<{ data: unknown }>('/api/pos/cash-counts', {
      method: 'POST',
      headers: { 'x-branch-id': input.session.branch.id },
      body: JSON.stringify({ sessionId: input.session.session.id, total: Math.round(input.total), bills: input.bills, coins: input.coins, branchId: input.session.branch.id }),
    });
  } catch (error) {
    throw new Error(error instanceof ApiError || error instanceof Error ? error.message || 'No se pudo registrar el arqueo.' : 'No se pudo registrar el arqueo.');
  }
}
