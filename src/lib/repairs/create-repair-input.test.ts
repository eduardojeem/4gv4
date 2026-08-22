import { describe, expect, it } from 'vitest'
import { parseCreateRepairInput } from './create-repair-input'

const validInput = {
  idempotency_key: 'repair-create-123',
  customer_id: '11111111-1111-4111-8111-111111111111',
  device_brand: 'Samsung',
  device_model: 'Galaxy S23',
  device_type: 'smartphone',
  problem_description: 'No enciende',
  diagnosis: '',
  access_type: 'none',
  access_password: null,
  priority: 'medium',
  urgency: 'normal',
  technician_id: null,
  estimated_cost: 150000,
  labor_cost: 50000,
  final_cost: null,
  pricing_mode: 'automatic',
  discount_amount: 0,
  price_override_reason: null,
  warranty_months: 3,
  warranty_type: 'full',
  warranty_notes: '',
  warranty_expires_at: null,
  parts: [],
  notes: [],
  images: [],
}

describe('parseCreateRepairInput', () => {
  it('accepts and normalizes the repair creation contract', () => {
    const result = parseCreateRepairInput(validInput)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.diagnosis).toBeNull()
    expect(result.data.warranty_notes).toBeNull()
    expect(result.data.status).toBeUndefined()
  })

  it.each(['status', 'branch_id', 'organization_id', 'received_at', 'paid_amount', 'ticket_number']) (
    'rejects server-controlled field %s',
    (field) => {
      expect(parseCreateRepairInput({ ...validInput, [field]: 'forged-value' }).success).toBe(false)
    }
  )

  it('rejects malformed nested rows instead of forwarding arbitrary columns', () => {
    expect(parseCreateRepairInput({
      ...validInput,
      parts: [{ part_name: 'Pantalla', unit_price: 100000, unit_cost: 80000, quantity: 1, status: 'installed' }],
    }).success).toBe(false)
  })

  it('defaults legacy lines and accepts only classified repair line types', () => {
    const legacy = parseCreateRepairInput({
      ...validInput,
      parts: [{ part_name: 'Pantalla', unit_price: 100000, unit_cost: 80000, quantity: 1 }],
    })
    expect(legacy.success).toBe(true)
    if (legacy.success) expect(legacy.data.parts[0].line_type).toBe('charged_part')

    expect(parseCreateRepairInput({
      ...validInput,
      parts: [{ part_name: 'Servicio', unit_price: 250000, quantity: 1, line_type: 'service' }],
    }).success).toBe(true)
    expect(parseCreateRepairInput({
      ...validInput,
      parts: [{ part_name: 'Servicio', unit_price: 250000, quantity: 1, line_type: 'forged' }],
    }).success).toBe(false)
  })

  it('requires the unlock value when the access type needs it', () => {
    expect(parseCreateRepairInput({ ...validInput, access_type: 'pin', access_password: '' }).success).toBe(false)
  })

  it('requires a retry-safe creation key', () => {
    const withoutKey = { ...validInput, idempotency_key: undefined }
    expect(parseCreateRepairInput(withoutKey).success).toBe(false)
  })

  it('rejects creation keys outside the supported length', () => {
    expect(parseCreateRepairInput({ ...validInput, idempotency_key: 'short' }).success).toBe(false)
    expect(parseCreateRepairInput({ ...validInput, idempotency_key: 'x'.repeat(121) }).success).toBe(false)
  })
})
