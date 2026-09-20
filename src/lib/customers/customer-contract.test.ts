import { describe, expect, it } from 'vitest'
import {
  buildCustomerIdentity,
  buildCustomerIdentityForUpdate,
  classificationForFormType,
  normalizeCustomerStatus,
  statusForDatabase,
} from './customer-contract'

describe('customer contract', () => {
  it.each([
    ['activo', 'active'],
    ['active', 'active'],
    ['inactivo', 'inactive'],
    ['inactive', 'inactive'],
    ['suspendido', 'suspended'],
    ['suspended', 'suspended'],
    ['pendiente', 'pending'],
    ['pending', 'pending'],
  ] as const)('normalizes database status %s to %s', (input, expected) => {
    expect(normalizeCustomerStatus(input)).toBe(expected)
  })

  it('uses a safe inactive state for unknown persisted statuses', () => {
    expect(normalizeCustomerStatus('deleted')).toBe('inactive')
  })

  it.each([
    ['active', 'activo'],
    ['inactive', 'inactivo'],
    ['suspended', 'suspendido'],
    ['pending', 'pendiente'],
  ] as const)('maps canonical status %s for Postgres', (input, expected) => {
    expect(statusForDatabase(input)).toBe(expected)
  })

  it('keeps display name, split name, and business aliases synchronized', () => {
    expect(buildCustomerIdentity({
      first_name: '  ana maría ',
      last_name: '  gÓmez ',
      company_name: '  Distribuidora Norte  ',
    })).toEqual({
      name: 'Ana María Gómez',
      first_name: 'Ana María',
      last_name: 'Gómez',
      company: 'Distribuidora Norte',
      company_name: 'Distribuidora Norte',
    })
  })

  it('preserves a legacy full name when no split fields were supplied', () => {
    expect(buildCustomerIdentity({ name: '  JUAN pÉrez  ', company: '  JP SA ' })).toEqual({
      name: 'Juan Pérez',
      first_name: 'Juan',
      last_name: 'Pérez',
      company: 'JP SA',
      company_name: 'JP SA',
    })
  })

  it('replaces stale split names when only the full name changes', () => {
    expect(buildCustomerIdentityForUpdate(
      { name: 'Ana Gómez', first_name: 'Ana', last_name: 'Gómez' },
      { name: 'Lucía Pérez' }
    )).toMatchObject({ name: 'Lucía Pérez', first_name: 'Lucía', last_name: 'Pérez' })
  })

  it('updates either company alias without restoring the previous value', () => {
    expect(buildCustomerIdentityForUpdate(
      { name: 'Ana Gómez', company: 'Anterior SA', company_name: 'Anterior SA' },
      { company: 'Nueva SA' }
    )).toMatchObject({ company: 'Nueva SA', company_name: 'Nueva SA' })
    expect(buildCustomerIdentityForUpdate(
      { name: 'Ana Gómez', company: 'Anterior SA', company_name: 'Anterior SA' },
      { company_name: null }
    )).toMatchObject({ company: null, company_name: null })
  })

  it('retains the surname when only the first name changes', () => {
    expect(buildCustomerIdentityForUpdate(
      { name: 'Ana Gómez', first_name: 'Ana', last_name: 'Gómez' },
      { first_name: 'Lucía' }
    )).toMatchObject({ name: 'Lucía Gómez', first_name: 'Lucía', last_name: 'Gómez' })
  })

  it.each([
    ['individual', { customer_type: 'regular', segment: 'regular' }],
    ['vip', { customer_type: 'premium', segment: 'vip' }],
    ['empresa', { customer_type: 'empresa', segment: 'empresa' }],
    ['mayorista', { customer_type: 'wholesale', segment: 'wholesale' }],
  ] as const)('maps form type %s without losing classification', (input, expected) => {
    expect(classificationForFormType(input)).toEqual(expected)
  })
})
