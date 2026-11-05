import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261103232929_commerce_payment_control_guards.sql'), 'utf8')
describe('commerce direct-write protection migration contract', () => {
  it('guards new sales without intercepting historical updates or deletes', () => {
    expect(sql).toContain('commerce_sale_payment_control before insert on public.sales')
    expect(sql).not.toMatch(/before (update|delete).*on public.sales/i)
    expect(sql).toContain("auth.jwt()->>'role', '') = 'service_role'")
  })
  it('fails closed for unknown mixed components when restrictions exist', () => {
    expect(sql).toContain("if method is null then")
    expect(sql).toContain("if disabled then raise exception 'PAYMENT_METHOD_REQUIRES_SERVER'")
    expect(sql).toContain("method = 'qr' and controls->'transfer' = 'false'::jsonb")
    expect(sql).toContain("jsonb_typeof(c.value) <> 'boolean'")
  })
  it('merges one flag under row lock and protects both scopes from stale JSON writers', () => {
    expect(sql).toContain("for update;")
    expect(sql).toContain("revision is distinct from p_revision")
    expect(sql).toContain("flags || jsonb_build_object(p_method,p_enabled)")
    expect(sql).toContain("new.modules := new.modules || jsonb_build_object('payment_controls', previous_policy)")
    expect(sql).toContain("new.features := new.features || jsonb_build_object('payment_controls', previous_policy)")
    expect(sql).toContain("current_setting('mitiendapy.payment_controls_write', true) = 'on'")
    expect(sql).toContain("perform set_config('mitiendapy.payment_controls_write', coalesce(previous_flag,''), true)")
    expect(sql).toContain("security invoker")
    expect(sql).toContain("select 2")
  })
  it('limits settings writes to active tenant administrators and readiness to service role', () => {
    expect(sql).toContain("m.organization_id = new.organization_id and m.user_id = auth.uid()")
    expect(sql).toContain("m.status = 'active' and m.role::text in ('owner','admin')")
    expect(sql).toContain('commerce_payment_controls_version() from public, anon, authenticated')
    expect(sql).toContain('commerce_payment_controls_version() to service_role')
  })
})
