import { describe, expect, it } from 'vitest'
import { parseCreateRepairInput } from './create-repair-input'

const validInput = {
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
      const result = parseCreateRepairInput({ ...validInput, [field]: 'forged-value' })
      expect(result.success).toBe(false)
    }
  )

  it('rejects malformed nested rows instead of forwarding arbitrary columns', () => {
    const result = parseCreateRepairInput({
      ...validInput,
      parts: [{
        part_name: 'Pantalla',
        unit_price: 100000,
        unit_cost: 80000,
        quantity: 1,
        status: 'installed',
      }],
    })

    expect(result.success).toBe(false)
  })

  it('requires the unlock value when the access type needs it', () => {
    const result = parseCreateRepairInput({
      ...validInput,
      access_type: 'pin',
      access_password: '',
    })

    expect(result.success).toBe(false)
  })
})
