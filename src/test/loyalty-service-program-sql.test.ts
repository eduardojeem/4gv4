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

beforeEach(async () => {
  db = new PGlite()
  await db.exec(`
    create role service_role bypassrls; create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function public.has_org_permission(uuid, text) returns boolean language sql as 'select true';
    create table public.organizations(id uuid primary key);
    create table public.sales(id uuid primary key, organization_id uuid, customer_id uuid, status text default 'completed', payment_status text default 'completed', total_amount numeric default 45000, created_at timestamptz not null default now());
    create table public.appointments(id uuid primary key, organization_id uuid, customer_id uuid, sale_id uuid, status text default 'completed');
    create table public.customer_credits(id uuid primary key, organization_id uuid, sale_id uuid, status text);
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
  ])
    await db.exec(sql)

  await db.exec(`
    insert into public.organizations values ('${org}');
    insert into public.customers values ('${customer}', '${org}', 0);
    insert into public.loyalty_settings (organization_id, enabled, currency_per_point, points_per_unit, rounding)
      values ('${org}', true, 1000, 1, 'floor');
  `)
  await db.exec(`alter table public.customers add column name text not null default 'Cliente'`)
  await db.exec(
    `alter table loyalty_ledger drop constraint loyalty_ledger_source_valid; alter table loyalty_ledger add constraint loyalty_ledger_source_valid check(source in ('purchase','promotion','adjustment','reversal','redemption'));`
  )
  await db.exec(
    readFileSync('supabase/migrations/20261115161607_loyalty_service_program.sql', 'utf8')
  )
}, 30000)

afterEach(async () => {
  await db?.close()
})

const sale = '00000000-0000-0000-0000-000000000003'
const appointment = '00000000-0000-0000-0000-000000000004'
async function setup(mode: string, status = 'completed', payment = 'completed') {
  await db.query('update public.loyalty_settings set earning_mode=$1, points_per_visit=2', [mode])
  await db.query(
    'insert into public.sales(id,organization_id,customer_id,payment_status) values ($1,$2,$3,$4)',
    [sale, org, customer, payment]
  )
  await db.query('insert into public.appointments values ($1,$2,$3,$4,$5)', [
    appointment,
    org,
    customer,
    sale,
    status,
  ])
}
async function award(key = 'sale:one', saleId: string | null = sale, amount = 45000) {
  return (
    await db.query<{ points: number | null }>(
      'select (r).points from (select public.award_loyalty_points_for_sale($1,$2,$3,$4,$5) r) q',
      [org, customer, amount, saleId, key]
    )
  ).rows[0].points
}
async function visits() {
  return Number(
    (await db.query<{ n: number }>('select count(*) n from public.loyalty_service_visits')).rows[0]
      .n
  )
}

describe('fidelización por turnos reales', () => {
  it('conserva el modo por monto y el saldo anterior', async () => {
    await setup('amount')
    expect(await award()).toBe(45)
    expect(await visits()).toBe(1)
    expect(await award('cuota', null, 10000)).toBe(10)
  })
  it('suma una vez por turno aunque cambie la clave de cobro', async () => {
    await setup('visits')
    expect(await award()).toBe(2)
    expect(await award()).toBe(2)
    expect(await award('otro-intento')).toBeNull()
    expect(await visits()).toBe(1)
    expect(
      (await db.query<{ balance: number }>('select balance from loyalty_accounts')).rows[0].balance
    ).toBe(2)
  })
  it('combina monto y turno, sin duplicar puntos por visita', async () => {
    await setup('both')
    expect(await award()).toBe(47)
    expect(await award('cuota', null, 10000)).toBe(10)
    expect(await visits()).toBe(1)
  })
  it.each(['pending', 'confirmed', 'cancelled', 'no_show'])(
    'no cuenta un turno %s',
    async (status) => {
      await setup('visits', status)
      expect(await award()).toBeNull()
      expect(await visits()).toBe(0)
    }
  )
  it.each(['pending', 'partial', 'refunded'])(
    'no cuenta una venta con pago %s',
    async (payment) => {
      await setup('visits', 'completed', payment)
      expect(await award()).toBeNull()
      expect(await visits()).toBe(0)
    }
  )
  it('no infiere una visita de una cuota ni de un importe sin venta', async () => {
    await setup('visits')
    expect(await award('cuota', null)).toBeNull()
    expect(await visits()).toBe(0)
  })
  it('rechaza un turno asociado a otro cliente', async () => {
    await setup('visits')
    await db.exec('update appointments set customer_id=null')
    expect(await award()).toBeNull()
    expect(await visits()).toBe(0)
  })
  it('no cuenta ventas financiadas', async () => {
    await setup('visits')
    await db.query('insert into customer_credits values ($1,$2,$3,$4)', [
      appointment,
      org,
      sale,
      'active',
    ])
    expect(await award()).toBeNull()
    expect(await visits()).toBe(0)
  })
  it('respeta el tope diario y puede registrar una visita sin otorgar más puntos', async () => {
    await setup('visits')
    await db.exec('update loyalty_settings set max_points_per_customer_per_day=1')
    expect(await award()).toBe(1)
    expect(await visits()).toBe(1)
  })
  it('mantiene el programa pausado sin acreditar ni registrar', async () => {
    await setup('visits')
    await db.exec('update loyalty_settings set enabled=false')
    expect(await award()).toBeNull()
    expect(await visits()).toBe(0)
  })
  it('consulta progreso y totales reales, sin mezclar organizaciones', async () => {
    await setup('visits')
    await award()
    const result = (
      await db.query<{
        data: {
          customers: Array<{ balance: number; visits: number }>
          summary: { visits: number; returningCustomers: number }
        }
      }>('select loyalty_program_customers($1) data', [org])
    ).rows[0].data
    expect(result.customers[0]).toMatchObject({ balance: 2, visits: 1 })
    expect(result.summary).toMatchObject({ visits: 1, returningCustomers: 0 })
    const other = (
      await db.query<{ data: { customers: unknown[] } }>(
        'select loyalty_program_customers($1) data',
        ['00000000-0000-0000-0000-000000000009']
      )
    ).rows[0].data
    expect(other.customers).toEqual([])
  })
  it('rechaza consultas y acreditaciones sin permiso', async () => {
    await setup('visits')
    await db.exec(
      'create or replace function has_org_permission(uuid,text) returns boolean language sql as $$select false$$'
    )
    await expect(award()).rejects.toThrow('permiso')
    await expect(db.query('select loyalty_program_customers($1)', [org])).rejects.toThrow('permiso')
  })
})

describe('reintegros y datos visibles', () => {
  it('el reintegro total retira la visita sin duplicar el ajuste', async () => {
    await setup('visits')
    await award()
    const refund = () =>
      db.query('select reverse_loyalty_points_for_refund($1,$2,$3,$4,$5)', [
        org,
        customer,
        sale,
        45000,
        'refund:one',
      ])
    await refund()
    await refund()
    const result = (
      await db.query<{ data: { summary: { visits: number } } }>(
        'select loyalty_program_customers($1) data',
        [org]
      )
    ).rows[0].data
    expect(result.summary.visits).toBe(0)
    expect(
      (await db.query<{ balance: number }>('select balance from loyalty_accounts')).rows[0].balance
    ).toBe(0)
    expect(
      Number(
        (
          await db.query<{ amount: number }>(
            'select refunded_amount amount from loyalty_service_visits'
          )
        ).rows[0].amount
      )
    ).toBe(45000)
    expect(await award('otra-clave')).toBeNull()
  })
  it('acumula reintegros parciales aunque el saldo ya no alcance', async () => {
    await setup('visits')
    await award()
    await db.query('select reverse_loyalty_points_for_refund($1,$2,$3,$4,$5)', [
      org,
      customer,
      sale,
      20000,
      'refund:part1',
    ])
    let result = (
      await db.query<{ data: { summary: { visits: number } } }>(
        'select loyalty_program_customers($1) data',
        [org]
      )
    ).rows[0].data
    expect(result.summary.visits).toBe(1)
    await db.query('select reverse_loyalty_points_for_refund($1,$2,$3,$4,$5)', [
      org,
      customer,
      sale,
      25000,
      'refund:part2',
    ])
    result = (
      await db.query<{ data: { summary: { visits: number } } }>(
        'select loyalty_program_customers($1) data',
        [org]
      )
    ).rows[0].data
    expect(result.summary.visits).toBe(0)
  })
  it('no permite que otro cliente u organización revierta una venta', async () => {
    await setup('visits')
    await award()
    await expect(
      db.query('select reverse_loyalty_points_for_refund($1,$2,$3,$4,$5)', [
        org,
        '00000000-0000-0000-0000-000000000099',
        sale,
        45000,
        'refund:bad',
      ])
    ).rejects.toThrow('no pertenece')
  })
  it('no expone visitas al rol authenticated por acceso directo', async () => {
    await setup('visits')
    await award()
    await db.exec('set role authenticated')
    await expect(db.query('select * from loyalty_service_visits')).rejects.toThrow(
      'permission denied'
    )
    await db.exec('reset role')
  })
  it('no transforma un producto sin turno en visita', async () => {
    await setup('visits')
    await db.exec('delete from appointments')
    expect(await award()).toBeNull()
    expect(await visits()).toBe(0)
  })
  it('conserva una única visita con campañas y aplica el hito en el turno correcto', async () => {
    await setup('visits')
    await db.query(
      `insert into loyalty_point_rules(organization_id,name,starts_at,ends_at,kind,visit_interval,bonus_points) values ($1,'Segundo turno',now()-interval '1 day',now()+interval '1 day','visit_milestone',2,10)`,
      [org]
    )
    expect(await award()).toBe(2)
    const sale2 = '00000000-0000-0000-0000-000000000005'
    const appt2 = '00000000-0000-0000-0000-000000000006'
    await db.query('insert into sales(id,organization_id,customer_id) values($1,$2,$3)', [
      sale2,
      org,
      customer,
    ])
    await db.query(`insert into appointments values($1,$2,$3,$4,'completed')`, [
      appt2,
      org,
      customer,
      sale2,
    ])
    expect(await award('sale:two', sale2)).toBe(12)
    expect(await award('retry:two', sale2)).toBeNull()
    expect(await visits()).toBe(2)
  })
})

it('no acredita turnos históricos al volver a invocar la venta', async () => {
  await setup('visits')
  await db.exec("update sales set created_at=now()-interval '10 days'")
  expect(await award()).toBeNull()
  expect(await visits()).toBe(0)
})

it('registra una sola visita al terminar de pagar un turno financiado', async () => {
  await setup('visits', 'completed', 'partial')
  await db.query('insert into customer_credits values ($1,$2,$3,$4)', [
    appointment,
    org,
    sale,
    'active',
  ])
  expect(await award('installment:one')).toBeNull()
  expect(await visits()).toBe(0)
  await db.exec("update customer_credits set status='completed'")
  expect(await award('installment:last')).toBe(2)
  expect(await award('installment:retry')).toBeNull()
  expect(await visits()).toBe(1)
})

it('las devoluciones no permiten reutilizar un hito de turnos ya cobrado', async () => {
  await setup('visits')
  await db.query(`insert into loyalty_point_rules(organization_id,name,starts_at,ends_at,kind,visit_interval,bonus_points) values ($1,'Cada dos',now()-interval '1 day',now()+interval '1 day','visit_milestone',2,10)`, [org])
  expect(await award()).toBe(2)
  const sale2 = '00000000-0000-0000-0000-000000000005'
  const appointment2 = '00000000-0000-0000-0000-000000000006'
  await db.query('insert into sales(id,organization_id,customer_id) values($1,$2,$3)', [sale2, org, customer])
  await db.query(`insert into appointments values($1,$2,$3,$4,'completed')`, [appointment2, org, customer, sale2])
  expect(await award('sale:second', sale2)).toBe(12)
  await db.query('select reverse_loyalty_points_for_refund($1,$2,$3,$4,$5)', [org, customer, sale2, 45000, 'refund:second'])
  const sale3 = '00000000-0000-0000-0000-000000000007'
  const appointment3 = '00000000-0000-0000-0000-000000000008'
  await db.query('insert into sales(id,organization_id,customer_id) values($1,$2,$3)', [sale3, org, customer])
  await db.query(`insert into appointments values($1,$2,$3,$4,'completed')`, [appointment3, org, customer, sale3])
  expect(await award('sale:third', sale3)).toBe(2)
  const data = (await db.query<{ data: { summary: { visits: number } } }>('select loyalty_program_customers($1) data', [org])).rows[0].data
  expect(data.summary.visits).toBe(2)
})

it('consume el cupo de campaña solo por el bonus efectivamente acreditado', async () => {
  await setup('both')
  await db.query(`insert into loyalty_point_rules(organization_id,name,starts_at,ends_at,kind,bonus_points) values ($1,'Regalo',now()-interval '1 day',now()+interval '1 day','bonus_per_purchase',20)`, [org])
  await db.exec('update loyalty_settings set max_points_per_customer_per_day=46')
  expect(await award()).toBe(46)
  expect((await db.query<{ awarded_bonus_points: number }>('select awarded_bonus_points from loyalty_point_rules')).rows[0].awarded_bonus_points).toBe(0)
})