// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const org = '00000000-0000-0000-0000-000000000001'
const customer = '00000000-0000-0000-0000-000000000002'
const otherOrg = '00000000-0000-0000-0000-000000000009'

const BASE = readFileSync('supabase/migrations/20260927000000_baseline_schema.sql', 'utf8')
function bloque(start: string, end: string) {
  const from = BASE.indexOf(start)
  if (from < 0) throw new Error(`no está en el esquema base: ${start}`)
  return BASE.slice(from, BASE.indexOf(end, from) + end.length)
}

let db: PGlite

beforeEach(async () => {
  db = new PGlite()
  await db.exec(`
    create role service_role bypassrls; create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function public.has_org_permission(uuid, text) returns boolean language sql as 'select true';
    create table public.customers(id uuid primary key, organization_id uuid, store_credit numeric default 0);
    create table public.sales(id uuid primary key, organization_id uuid, total_amount numeric(10,2) not null);
  `)
  for (const sql of [
    bloque('CREATE TABLE IF NOT EXISTS "public"."loyalty_settings"', ');'),
    bloque('CREATE TABLE IF NOT EXISTS "public"."loyalty_ledger"', ');'),
    bloque('CREATE TABLE IF NOT EXISTS "public"."loyalty_accounts"', ');'),
    'alter table public.loyalty_accounts add primary key (customer_id)',
    'alter table public.loyalty_settings add primary key (organization_id)',
    bloque('CREATE UNIQUE INDEX "loyalty_ledger_idempotency_unique"', ';'),
    bloque('CREATE OR REPLACE FUNCTION "public"."compute_loyalty_balance_after"()', '$$;'),
    bloque('CREATE OR REPLACE FUNCTION "public"."sync_loyalty_account_from_ledger"()', '$$;'),
    bloque('CREATE OR REPLACE TRIGGER "loyalty_ledger_compute_balance"', ';'),
    bloque('CREATE OR REPLACE TRIGGER "loyalty_ledger_sync_account"', ';'),
    bloque('CREATE TABLE IF NOT EXISTS "public"."customer_store_credits"', ');'),
    bloque('CREATE OR REPLACE FUNCTION "public"."sync_customer_store_credit_balance"()', '$$;'),
    bloque('CREATE OR REPLACE TRIGGER "trg_sync_customer_store_credit_balance"', ';'),
    readFileSync('supabase/migrations/20261016120000_loyalty_reversal_and_expiration.sql', 'utf8'),
    readFileSync('supabase/migrations/20261016150000_loyalty_redemption_to_store_credit.sql', 'utf8'),
  ]) await db.exec(sql)

  await db.exec(`
    insert into public.customers values ('${customer}', '${org}', 0);
    insert into public.loyalty_settings (organization_id, enabled, redemption_value, min_redemption_points) values ('${org}', true, 10, 100);
    insert into public.loyalty_ledger (organization_id, customer_id, points, balance_after, source, description)
      values ('${org}', '${customer}', 500, 0, 'purchase', 'Compra');
  `)
}, 30000)

afterEach(async () => { await db?.close() })

const canjear = async (points: number, key: string, organizationId = org) =>
  (await db.query<{ result: { points: number; amount: string; replayed: boolean } }>(
    'select public.redeem_loyalty_points_to_store_credit($1, $2, $3, $4) as result', [organizationId, customer, points, key],
  )).rows[0].result
const saldoPuntos = async () => (await db.query<{ balance: number }>(`select balance from public.loyalty_accounts where customer_id = '${customer}'`)).rows[0].balance
const saldoAFavor = async () => Number((await db.query<{ store_credit: string }>(`select store_credit from public.customers where id = '${customer}'`)).rows[0].store_credit)

describe('canje de puntos por saldo a favor', () => {
  it('descuenta los puntos y suma el saldo a favor que el POS ya acepta como pago', async () => {
    const result = await canjear(300, 'redeem:1')
    expect(result).toMatchObject({ points: 300, replayed: false })
    expect(Number(result.amount)).toBe(3000)
    expect(await saldoPuntos()).toBe(200)
    expect(await saldoAFavor()).toBe(3000)
  })

  it('el mismo canje reintentado no se repite', async () => {
    await canjear(300, 'redeem:1')
    expect(await canjear(300, 'redeem:1')).toMatchObject({ points: 300, replayed: true })
    expect(await saldoPuntos()).toBe(200)
    expect(await saldoAFavor()).toBe(3000)
  })

  it('no deja canjear más de lo que tiene, ni menos del mínimo', async () => {
    await expect(canjear(600, 'redeem:2')).rejects.toThrow('INSUFFICIENT_POINTS')
    await expect(canjear(50, 'redeem:3')).rejects.toThrow('BELOW_MIN_REDEMPTION')
    expect(await saldoPuntos()).toBe(500)
    expect(await saldoAFavor()).toBe(0)
  })

  it('sin valor de canje configurado está apagado', async () => {
    await db.exec(`update public.loyalty_settings set redemption_value = null`)
    await expect(canjear(300, 'redeem:4')).rejects.toThrow('REDEMPTION_DISABLED')
  })

  it('no canjea un cliente de otra organización', async () => {
    await db.exec(`insert into public.loyalty_settings (organization_id, enabled, redemption_value) values ('${otherOrg}', true, 10)`)
    await expect(canjear(300, 'redeem:5', otherOrg)).rejects.toThrow('no pertenece')
  })
})
