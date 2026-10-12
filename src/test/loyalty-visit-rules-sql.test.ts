// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const org = '00000000-0000-0000-0000-000000000001'
const customer = '00000000-0000-0000-0000-000000000002'

const BASE = readFileSync('supabase/migrations/20260927000000_baseline_schema.sql', 'utf8')
function bloque(start: string, end: string) {
  const from = BASE.indexOf(start)
  if (from < 0) throw new Error(`no está en el esquema base: ${start}`)
  return BASE.slice(from, BASE.indexOf(end, from) + end.length)
}

let db: PGlite
let compra = 0

beforeEach(async () => {
  compra = 0
  db = new PGlite()
  await db.exec(`
    create role service_role bypassrls; create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function public.has_org_permission(uuid, text) returns boolean language sql as 'select true';
    create table public.customers(id uuid primary key, organization_id uuid, store_credit numeric default 0);
  `)
  for (const sql of [
    bloque('CREATE TABLE IF NOT EXISTS "public"."loyalty_settings"', ');'),
    bloque('CREATE TABLE IF NOT EXISTS "public"."loyalty_point_rules"', ');'),
    bloque('CREATE TABLE IF NOT EXISTS "public"."loyalty_ledger"', ');'),
    bloque('CREATE TABLE IF NOT EXISTS "public"."loyalty_accounts"', ');'),
    'alter table public.loyalty_accounts add primary key (customer_id)',
    'alter table public.loyalty_settings add primary key (organization_id)',
    'alter table public.loyalty_point_rules add primary key (id)',
    bloque('CREATE UNIQUE INDEX "loyalty_ledger_idempotency_unique"', ';'),
    bloque('CREATE OR REPLACE FUNCTION "public"."calculate_base_loyalty_points"(', '$$;'),
    bloque('CREATE OR REPLACE FUNCTION "public"."compute_loyalty_balance_after"()', '$$;'),
    bloque('CREATE OR REPLACE FUNCTION "public"."sync_loyalty_account_from_ledger"()', '$$;'),
    bloque('CREATE OR REPLACE TRIGGER "loyalty_ledger_compute_balance"', ';'),
    bloque('CREATE OR REPLACE TRIGGER "loyalty_ledger_sync_account"', ';'),
    readFileSync('supabase/migrations/20261016180000_loyalty_visit_milestone_rules.sql', 'utf8'),
  ]) await db.exec(sql)

  await db.exec(`
    insert into public.customers values ('${customer}', '${org}', 0);
    insert into public.loyalty_settings (organization_id, enabled, currency_per_point, points_per_unit, rounding)
      values ('${org}', true, 1000, 1, 'floor');
  `)
}, 30000)

afterEach(async () => { await db?.close() })

const comprar = async (amount: number) => {
  compra += 1
  return (await db.query<{ points: number | null; description: string | null }>(
    'select (r).points, (r).description from (select public.award_loyalty_points_for_sale($1, $2, $3, null, $4) as r) x',
    [org, customer, amount, `sale:${compra}`],
  )).rows[0]
}
const promo = (sql: string) => db.exec(`insert into public.loyalty_point_rules (organization_id, name, starts_at, ends_at, ${sql}`)

describe('promoción «cada N visitas»', () => {
  it('regala los puntos en cada visita N, contando desde que empezó', async () => {
    await promo(`kind, visit_interval, bonus_points) values ('${org}', 'Cada 3 visitas', now() - interval '1 day', now() + interval '1 day', 'visit_milestone', 3, 100)`)
    expect((await comprar(20000)).points).toBe(20)
    expect((await comprar(20000)).points).toBe(20)
    const tercera = await comprar(20000)
    expect(tercera.points).toBe(120)
    expect(tercera.description).toBe('Visita 3: 20 puntos + 100 de regalo (Cada 3 visitas)')
    expect((await comprar(20000)).points).toBe(20)
  })

  it('compite con las demás: se aplica la que más le conviene al cliente', async () => {
    await promo(`kind, visit_interval, bonus_points) values ('${org}', 'Cada 2 visitas', now() - interval '1 day', now() + interval '1 day', 'visit_milestone', 2, 10)`)
    await promo(`kind, multiplier) values ('${org}', 'Triple', now() - interval '1 day', now() + interval '1 day', 'multiplier', 3)`)
    await comprar(50000)
    // Visita 2: el regalo (10) pierde contra el triple (+100).
    expect((await comprar(50000)).points).toBe(150)
  })

  it('no acepta una promoción por visitas sin cada cuántas ni regalo', async () => {
    await expect(promo(`kind, visit_interval, bonus_points) values ('${org}', 'Mal', now(), now() + interval '1 day', 'visit_milestone', null, 100)`)).rejects.toThrow()
    await expect(promo(`kind, visit_interval, bonus_points) values ('${org}', 'Mal', now(), now() + interval '1 day', 'visit_milestone', 5, 0)`)).rejects.toThrow()
  })
})

describe('tope total de una promoción', () => {
  it('cuenta lo otorgado: el «×2» deja de dar al llegar al tope', async () => {
    await promo(`kind, multiplier, max_bonus_points_total) values ('${org}', 'Doble', now() - interval '1 day', now() + interval '1 day', 'multiplier', 2, 50)`)
    expect((await comprar(40000)).points).toBe(80)
    // Quedan 10 de bonificación en la promoción.
    expect((await comprar(40000)).points).toBe(50)
    expect((await comprar(40000)).points).toBe(40)
    expect((await db.query<{ awarded: number }>('select awarded_bonus_points as awarded from public.loyalty_point_rules')).rows[0].awarded).toBe(50)
  })
})

describe('«canjeados» en la ficha del cliente', () => {
  it('cuenta solo lo que el cliente usó, no los vencimientos', async () => {
    await comprar(100000)
    await db.exec(`insert into public.loyalty_ledger (organization_id, customer_id, points, balance_after, source, description)
      values ('${org}', '${customer}', -30, 0, 'raffle_entry', 'Sorteo')`)
    // Uno por uno, como la app: en un insert de varias filas el saldo se calcula con el anterior.
    await db.exec(`insert into public.loyalty_ledger (organization_id, customer_id, points, balance_after, source, description)
      values ('${org}', '${customer}', -20, 0, 'expiration', 'Vencimiento')`)
    const cuenta = (await db.query<{ balance: number; lifetime_redeemed: number }>(`select balance, lifetime_redeemed from public.loyalty_accounts where customer_id = '${customer}'`)).rows[0]
    expect(cuenta).toEqual({ balance: 50, lifetime_redeemed: 30 })
  })
})
