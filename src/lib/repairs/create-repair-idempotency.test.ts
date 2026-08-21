import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  fingerprintRepairCreateInput,
  resolveRepairCreationReplay,
} from './create-repair-idempotency'

const base = {
  customer_id: '5defef0c-f1a0-42a6-a077-25398acb21f9',
  device_brand: 'Samsung',
  labor_cost: 100_000,
  parts: [{ product_id: 'part-1', quantity: 1, unit_price: 50_000 }],
}

describe('repair creation idempotency', () => {
  it('produces the same fingerprint regardless of object key order', () => {
    expect(fingerprintRepairCreateInput(base)).toBe(fingerprintRepairCreateInput({
      parts: base.parts,
      labor_cost: base.labor_cost,
      device_brand: base.device_brand,
      customer_id: base.customer_id,
    }))
  })

  it('changes the fingerprint when a financial or inventory value changes', () => {
    expect(fingerprintRepairCreateInput(base)).not.toBe(fingerprintRepairCreateInput({
      ...base, labor_cost: 120_000,
    }))
    expect(fingerprintRepairCreateInput(base)).not.toBe(fingerprintRepairCreateInput({
      ...base, parts: [{ ...base.parts[0], quantity: 2 }],
    }))
  })

  it('replays equal payloads and rejects reuse with changed data', () => {
    const hash = fingerprintRepairCreateInput(base)
    expect(resolveRepairCreationReplay({ creation_payload_hash: hash }, hash)).toEqual({ replayed: true })
    expect(resolveRepairCreationReplay({ creation_payload_hash: 'other' }, hash)).toEqual({
      replayed: false,
      conflict: 'La clave de creación ya fue usada con otros datos.',
    })
  })

  it('adds a tenant-scoped partial unique creation key', () => {
    const sql = readFileSync(resolve(
      process.cwd(),
      'supabase/migrations/20260821032117_add_repair_creation_idempotency.sql'
    ), 'utf8').toLowerCase()

    expect(sql).toContain('creation_idempotency_key text')
    expect(sql).toContain('creation_payload_hash text')
    expect(sql).toContain('(organization_id, creation_idempotency_key)')
    expect(sql).toContain('where creation_idempotency_key is not null')
    expect(sql).toContain('creation_payload_hash is not null')
  })
})
