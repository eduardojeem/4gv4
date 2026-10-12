// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const org = '00000000-0000-0000-0000-000000000001'
const customer = '00000000-0000-0000-0000-000000000002'
const sale = '00000000-0000-0000-0000-000000000003'

const BASE = readFileSync('supabase/migrations/20260927000000_baseline_schema.sql', 'utf8')

/** Un bloque del esquema base, desde `start` hasta el primer `end` posterior. */
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
    -- El permiso real depende de la sesión; acá se prueba la contabilidad.
    create function public.has_org_permission(uuid, text) returns boolean language sql as 'select true';
    create table public.sales(id uuid primary key, organization_id uuid, total_amount numeric(10,2) not null);
  `)
  // Tablas y disparadores reales del historial de puntos.
  await db.exec(bloque('CREATE TABLE IF NOT EXISTS "public"."loyalty_ledger"', ');'))
  await db.exec(bloque('CREATE TABLE IF NOT EXISTS "public"."loyalty_accounts"', ');'))
  await db.exec('alter table public.loyalty_accounts add primary key (customer_id)')
  await db.exec(bloque('CREATE UNIQUE INDEX "loyalty_ledger_idempotency_unique"', ';'))
  await db.exec(bloque('CREATE OR REPLACE FUNCTION "public"."compute_loyalty_balance_after"()', '$$;'))
  await db.exec(bloque('CREATE OR REPLACE FUNCTION "public"."sync_loyalty_account_from_ledger"()', '$$;'))
  await db.exec(bloque('CREATE OR REPLACE TRIGGER "loyalty_ledger_compute_balance"', ';'))
  await db.exec(bloque('CREATE OR REPLACE TRIGGER "loyalty_ledger_sync_account"', ';'))
  await db.exec(readFileSync('supabase/migrations/20261016120000_loyalty_reversal_and_expiration.sql', 'utf8'))
  await db.exec(`insert into public.sales values ('${sale}', '${org}', 200000)`)
}, 30000)

afterEach(async () => { await db?.close() })

const sumar = (points: number, extra = '') =>
  db.exec(`insert into public.loyalty_ledger (organization_id, customer_id, points, balance_after, source, description, sale_id${extra ? ', expires_at' : ''})
    values ('${org}', '${customer}', ${points}, 0, 'purchase', 'Compra', '${sale}'${extra ? `, ${extra}` : ''})`)
const gastar = (points: number) =>
  db.exec(`insert into public.loyalty_ledger (organization_id, customer_id, points, balance_after, source, description)
    values ('${org}', '${customer}', ${-points}, 0, 'raffle_entry', 'Sorteo')`)
const saldo = async () => (await db.query<{ balance: number }>(`select balance from public.loyalty_accounts where customer_id = '${customer}'`)).rows[0]?.balance
const revertir = async (refund: number, key: string) =>
  (await db.query<{ points: number | null }>(`select (public.reverse_loyalty_points_for_refund($1, $2, $3, $4, $5)).points`, [org, customer, sale, refund, key])).rows[0]?.points
const vencer = async (now: string) =>
  (await db.query<{ total: number }>(`select public.expire_loyalty_points($1::timestamptz) as total`, [now])).rows[0].total

describe('devolución con reintegro', () => {
  it('descuenta la parte proporcional, una sola vez por caso', async () => {
    await sumar(200)
    expect(await revertir(50000, 'refund:caso-1')).toBe(-50)
    expect(await saldo()).toBe(150)
    // El mismo caso otra vez: devuelve el asiento anterior, no descuenta de nuevo.
    expect(await revertir(50000, 'refund:caso-1')).toBe(-50)
    expect(await saldo()).toBe(150)
  })

  it('nunca descuenta más de lo que sumó la venta', async () => {
    await sumar(200)
    await revertir(150000, 'refund:a')
    expect(await revertir(150000, 'refund:b')).toBe(-50)
    expect(await saldo()).toBe(0)
  })

  it('lo ya canjeado no se le saca: el saldo no queda en negativo', async () => {
    await sumar(200)
    await gastar(180)
    expect(await revertir(200000, 'refund:c')).toBe(-20)
    expect(await saldo()).toBe(0)
  })

  it('una venta que no sumó puntos no descuenta nada', async () => {
    expect(await revertir(50000, 'refund:d')).toBeNull()
  })
})

describe('vencimiento', () => {
  it('vence lo que no se usó, considerando gastados primero los más viejos', async () => {
    await sumar(100, "'2026-01-01'")
    await sumar(100, "'2027-01-01'")
    await gastar(30)
    // Vencieron 100, ya se gastaron 30 (de los más viejos): vencen 70.
    expect(await vencer('2026-06-01')).toBe(1)
    expect(await saldo()).toBe(100)
  })

  it('correrlo dos veces no vence dos veces', async () => {
    await sumar(100, "'2026-01-01'")
    await vencer('2026-06-01')
    await vencer('2026-06-01')
    await vencer('2026-06-02')
    expect(await saldo()).toBe(0)
    expect((await db.query<{ total: number }>(`select count(*)::int as total from public.loyalty_ledger where source = 'expiration'`)).rows[0].total).toBe(1)
  })

  it('los puntos sin vencimiento no vencen nunca', async () => {
    await sumar(100)
    expect(await vencer('2099-01-01')).toBe(0)
    expect(await saldo()).toBe(100)
  })
})
