import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const fixture = vi.hoisted(() => ({
  sales: [
    { branch_id: 'branch-1', total_amount: 100, status: 'completed' },
    { branch_id: 'branch-1', total_amount: 200, status: 'cancelled' },
    { branch_id: 'branch-1', total_amount: 300, status: 'pending' },
  ],
}));
vi.mock('@/lib/api/withAdminAuth', () => ({ withAdminAuth: (handler: (request: NextRequest, context: unknown) => unknown) => (request: NextRequest) => handler(request, { organizationId: 'org-1', user: { id: 'user-1', role: 'admin' } }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({
  rpc: async () => ({ data: null, error: { message: 'RPC no disponible en fixture' } }),
  from: (table: string) => {
    let rows: Record<string, unknown>[] = table === 'branches' ? [{ id: 'branch-1', organization_id: 'org-1', name: 'Central' }] : table === 'sales' ? fixture.sales : [];
    const query = {
      select: () => query,
      order: () => query,
      eq: () => query,
      gte: () => query,
      in: (field: string, values: string[]) => { if (field === 'status') rows = rows.filter(row => values.includes(String(row.status))); return query; },
      maybeSingle: async () => ({ data: { time_zone: 'America/Asuncion' }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
    };
    return query;
  },
}) }));
import { GET } from '@/app/api/admin/branches/route';
describe('métricas alternativas de sucursales', () => {
  it('excluye ventas pendientes y anuladas del importe y contador', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/branches'));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.branches[0].sales_count).toBe(1);
    expect(result.branches[0].revenue_total).toBe(100);
  });
});