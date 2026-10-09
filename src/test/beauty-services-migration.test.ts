// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('beauty profile migration SQL behavior', () => {
  it('preserves old organizations and enforces specialty and mode constraints', async () => {
    const db = new PGlite()
    try {
      await db.exec(`create table organizations(id int primary key, business_vertical text);
        create table global_categories(verticals text[]);
        insert into organizations values(1,'barbershop'),(2,'cosmetics');`)
      const sql = readFileSync('supabase/migrations/20261009225451_beauty_services_profile.sql', 'utf8')
      await db.exec(sql)
      await db.exec(sql)
      const { rows } = await db.query('select business_vertical, service_specialties, attention_mode, appointment_mode from organizations order by id')
      expect(rows).toEqual([
        { business_vertical: 'barbershop', service_specialties: [], attention_mode: 'local', appointment_mode: 'booking' },
        { business_vertical: 'cosmetics', service_specialties: [], attention_mode: 'local', appointment_mode: 'booking' },
      ])
      await db.exec(`insert into organizations values(3,'beauty_services','{nails,lashes}','home','both')`)
      for (const values of ["'{nails,nails}'", "'{invalid}'", "array['nails',null]"]) {
        await expect(db.exec(`update organizations set service_specialties=${values} where id=3`)).rejects.toThrow()
      }
      await expect(db.exec("update organizations set attention_mode='invalid' where id=3")).rejects.toThrow()
      await expect(db.exec("update organizations set appointment_mode='invalid' where id=3")).rejects.toThrow()
      await db.exec("update organizations set service_specialties='{}' where id=3")
    } finally { await db.close() }
  }, 30000)
})
