import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927111905_harden_database_function_access.sql'),
  'utf8',
)

const posRoute = readFileSync(resolve(process.cwd(), 'src/app/api/pos/process-sale/route.ts'), 'utf8')
const monitoringCollector = readFileSync(
  resolve(process.cwd(), 'src/lib/superadmin/database-monitoring/collector.ts'),
  'utf8',
)

describe('Supabase RPC security hardening', () => {
  it('keeps POS mutations behind the authenticated server route', () => {
    expect(posRoute).toContain("import { createAdminSupabase } from '@/lib/supabase/admin'")
    expect(posRoute).toContain('const supabase = createAdminSupabase()')
    expect(posRoute).toContain("supabase.rpc('process_pos_sale_atomic_v5'")
    expect(migration).toContain('revoke all on function public.process_pos_sale_atomic_v5')
    expect(migration).toContain('grant execute on function public.process_pos_sale_atomic_v5')
    expect(migration).toContain('to service_role')
  })

  it('limits database monitoring RPCs to the protected service client', () => {
    expect(monitoringCollector).toContain("import { createAdminSupabase } from '@/lib/supabase/admin'")
    expect(monitoringCollector).toContain('const supabase = createAdminSupabase()')
    expect(migration).toContain('revoke all on function public.get_database_size_info() from public, anon, authenticated')
  })

  it('binds session management RPCs to the authenticated user', () => {
    expect(migration.match(/auth\.uid\(\) is distinct from p_user_id/g)).toHaveLength(4)
    expect(migration).toContain("raise exception 'SESSION_USER_MISMATCH'")
  })

  it('removes public execution from internal trigger and maintenance functions', () => {
    expect(migration).toContain('revoke all on function public.capture_customer_order_item_cost() from public, anon, authenticated')
    expect(migration).toContain('revoke all on function public.open_plan_downgrade_grace(uuid, text, integer) from public, anon, authenticated')
    expect(migration).toContain('revoke all on function public.sync_product_total_stock(uuid) from public, anon, authenticated')
  })

  it('fixes mutable search paths and removes broad grants from closed tables', () => {
    expect(migration).toContain('alter function public.check_long_open_sessions() set search_path = pg_catalog, public')
    expect(migration).toContain('alter function public.pos_first_installment_payment_version() set search_path = pg_catalog')
    expect(migration).toContain('revoke all on table public.email_logs from anon, authenticated')
    expect(migration).toContain('revoke all on table public.storefront_daily_visits from anon, authenticated')
    expect(migration).toContain('revoke all on table public.support_sessions from anon, authenticated')
    expect(migration).toContain('revoke all on table public.user_stats_cache from public, anon, authenticated')
  })
})
