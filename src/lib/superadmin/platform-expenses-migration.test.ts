import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SQL = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929230000_platform_expenses.sql'),
  'utf8',
)

// Son los costos del operador de la plataforma: ninguna tienda, admin de
// tienda ni visitante anónimo puede leerlos.
describe('migración de gastos de la plataforma', () => {
  it('activa RLS y solo deja pasar a super_admin', () => {
    expect(SQL).toContain('alter table public.platform_expenses enable row level security')
    expect(SQL).toContain("using ((select public.get_jwt_role()) = 'super_admin')")
    expect(SQL).toContain("with check ((select public.get_jwt_role()) = 'super_admin')")
    expect(SQL.match(/create policy/g)).toHaveLength(1)
  })

  it('no le deja nada al rol anónimo', () => {
    expect(SQL).toContain('revoke all on public.platform_expenses from anon')
  })

  it('valida montos, monedas y tipo de cambio en la base', () => {
    expect(SQL).toContain('check (amount >= 0)')
    expect(SQL).toContain("check (currency in ('PYG', 'USD'))")
    expect(SQL).toContain("check (currency <> 'PYG' or fx_rate_pyg = 1)")
  })
})
