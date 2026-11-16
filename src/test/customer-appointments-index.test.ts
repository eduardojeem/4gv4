// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('crea un índice reutilizable para turnos por cliente sin modificar registros', async () => {
  const db = new PGlite()
  try {
    await db.exec(
      `create table appointments(id integer primary key,customer_id integer,starts_at timestamptz);insert into appointments values(1,10,now()),(2,null,now());`,
    )
    const sql = readFileSync(
      'supabase/migrations/20261115210719_customer_appointments_lookup_index.sql',
      'utf8',
    )
    await db.exec(sql)
    await db.exec(sql)
    expect((await db.query('select * from appointments order by id')).rows).toHaveLength(2)
    const index = (
      await db.query<{ indexdef: string }>(
        "select indexdef from pg_indexes where indexname='idx_appointments_customer_timeline'",
      )
    ).rows[0]
    expect(index.indexdef).toContain('(customer_id, starts_at, id)')
    await db.exec('set enable_seqscan=off')
    const plan = await db.query<Record<string, string>>(
      'explain select * from appointments where customer_id=10 order by starts_at,id',
    )
    expect(plan.rows.map((row) => row['QUERY PLAN']).join(' ')).toContain(
      'idx_appointments_customer_timeline',
    )
  } finally {
    await db.close()
  }
}, 30000)
