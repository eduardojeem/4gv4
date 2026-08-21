import { describe, expect, it } from 'vitest'
import { validateRepairForm } from '../repair.schema'

describe('RepairFormSchema validation', () => {
  it('validates a standard repair form with mandatory fields', () => {
    const validData = {
      existingCustomerId: 'cust-123',
      customerName: 'Juan Pérez & Cía (Sucursal 1)',
      customerPhone: '0981-123456 / 0982-654321',
      customerEmail: '',
      customerDocument: '1234567-8',
      customerAddress: '',
      customerCity: '',
      customerCountry: '',
      priority: 'medium',
      urgency: 'medium',
      devices: [
        {
          deviceType: 'smartphone',
          brand: 'Samsung',
          model: 'Galaxy A05',
          issue: 'Pin',
          serialNumber: '',
          description: '',
          accessType: 'none',
          accessPassword: '',
          technician: '',
          estimatedCost: 0,
        },
      ],
      parts: [],
      notes: [],
      laborCost: 0,
      finalCost: null,
      pricingMode: 'automatic',
      discountAmount: 0,
      priceOverrideReason: '',
      warrantyMonths: 3,
      warrantyType: 'full',
      warrantyNotes: '',
      depositAmount: null,
      depositMethod: null,
      depositReference: '',
    }

    const result = validateRepairForm(validData)
    expect(result.success).toBe(true)
  })

  it('rejects empty customer selection', () => {
    const invalidData = {
      existingCustomerId: '',
      customerName: 'Juan',
      priority: 'medium',
      urgency: 'medium',
      devices: [
        {
          deviceType: 'smartphone',
          brand: 'Samsung',
          model: 'A05',
          issue: 'No enciende',
        },
      ],
    }

    const result = validateRepairForm(invalidData)
    expect(result.success).toBe(false)
  })

  it('rejects empty brand or model or issue', () => {
    const invalidData = {
      existingCustomerId: 'cust-123',
      customerName: 'Juan',
      priority: 'medium',
      urgency: 'medium',
      devices: [
        {
          deviceType: 'smartphone',
          brand: '',
          model: '',
          issue: '',
        },
      ],
    }

    const result = validateRepairForm(invalidData)
    expect(result.success).toBe(false)
  })

  it('requires PIN when accessType is pin', () => {
    const invalidData = {
      existingCustomerId: 'cust-123',
      priority: 'medium',
      urgency: 'medium',
      devices: [
        {
          deviceType: 'smartphone',
          brand: 'Samsung',
          model: 'A05',
          issue: 'Pantalla rota',
          accessType: 'pin',
          accessPassword: '',
        },
      ],
    }

    const result = validateRepairForm(invalidData)
    expect(result.success).toBe(false)
  })

  it('allows PIN with numbers and separators when accessType is pin', () => {
    const validData = {
      existingCustomerId: 'cust-123',
      priority: 'medium',
      urgency: 'medium',
      devices: [
        {
          deviceType: 'smartphone',
          brand: 'Samsung',
          model: 'A05',
          issue: 'Pantalla rota',
          accessType: 'pin',
          accessPassword: '1234, 0000',
        },
      ],
    }

    const result = validateRepairForm(validData)
    expect(result.success).toBe(true)
  })
})
