import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const migrationName = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
  .find((name) => name.endsWith('_server_only_cash_rpcs.sql'))

describe('server-only cash RPCs', () => {
  const cashRoutes = [
    'src/app/api/pos/cash-register/route.ts',
    'src/app/api/pos/cash-movements/route.ts',
    'src/app/api/pos/cash-counts/route.ts',
    'src/app/api/pos/electronic-payments/route.ts',
    'src/app/api/admin/cash-monitor/actions/route.ts',
  ]

  it('routes every cash mutation through the admin client and preserves the actor id', () => {
    for (const route of cashRoutes) {
      const source = read(route)
      expect(source).toContain('createAdminSupabase')
      expect(source).toContain('p_actor_user_id: user.id')
      expect(source).not.toContain(".from('cash_movements')")
    }
  })

  it('revokes authenticated execution from the original cash mutations', () => {
    expect(migrationName).toBeDefined()
    const migration = read(`supabase/migrations/${migrationName}`).toLowerCase()

    for (const rpc of [
      'open_cash_register_atomic',
      'close_cash_register_atomic',
      'record_cash_count_atomic',
      'record_cash_movement_atomic',
      'perform_cash_admin_action',
      'reconcile_sale_payment_atomic',
    ]) {
      expect(migration).toContain(`revoke all on function public.${rpc}`)
    }

    expect(migration).toContain('to service_role')
    expect(migration).toContain('request.jwt.claim.role')
  })
})
