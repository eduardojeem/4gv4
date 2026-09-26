import { describe, expect, it } from 'vitest'

import {
  isSamePhone,
  normalizePhone,
  validateCustomerContact,
  hasContactErrors,
} from './contact-rules'

const valid = { name: 'Ana Duarte', phone: '0981123456' }

describe('normalizePhone', () => {
  it('keeps only digits so the same number is not stored three ways', () => {
    expect(normalizePhone('0981-123 456')).toBe('0981123456')
    expect(normalizePhone('(0981) 123456')).toBe('0981123456')
    expect(normalizePhone(null)).toBe('')
  })
})

describe('isSamePhone', () => {
  it('matches a number written with and without country prefix', () => {
    expect(isSamePhone('+595981123456', '0981123456')).toBe(true)
  })

  it('does not match different numbers', () => {
    expect(isSamePhone('0981123456', '0982999999')).toBe(false)
  })

  it('never matches on too few digits', () => {
    expect(isSamePhone('123', '123')).toBe(false)
  })
})

describe('validateCustomerContact', () => {
  it('accepts a customer with name and phone', () => {
    expect(hasContactErrors(validateCustomerContact(valid))).toBe(false)
  })

  // El motivo del cambio: un cliente sin telefono no se puede contactar y la
  // mitad de las funciones quedan inutiles.
  it('requires the phone', () => {
    expect(validateCustomerContact({ name: 'Ana' }).phone).toContain('obligatorio')
  })

  it('rejects a phone that is too short', () => {
    expect(validateCustomerContact({ ...valid, phone: '123' }).phone).toContain('dígitos')
  })

  // Una empresa no tiene apellido: exigirlo obligaba a inventar uno.
  it('does not require a surname', () => {
    expect(hasContactErrors(validateCustomerContact({ name: 'Ferretería del Sur', phone: '0981123456' }))).toBe(false)
  })

  it('accepts an empty email but rejects an invalid one', () => {
    expect(validateCustomerContact({ ...valid, email: '' }).email).toBeUndefined()
    expect(validateCustomerContact({ ...valid, email: 'no-es-un-mail' }).email).toBeDefined()
  })
})

describe('teléfono alternativo', () => {
  it('is optional', () => {
    expect(hasContactErrors(validateCustomerContact(valid))).toBe(false)
  })

  it('requires saying whose phone it is', () => {
    const errors = validateCustomerContact({ ...valid, alternatePhone: '0982999999' })
    expect(errors.alternatePhoneLabel).toContain('quién')
  })

  it('accepts it when the owner is stated', () => {
    const errors = validateCustomerContact({
      ...valid,
      alternatePhone: '0982999999',
      alternatePhoneLabel: 'Hermana',
    })
    expect(hasContactErrors(errors)).toBe(false)
  })

  // El punto del alternativo es tener otra via: repetir el principal no sirve,
  // porque ese aparato es justamente el que quedo en el taller.
  it('rejects an alternate equal to the main phone', () => {
    const errors = validateCustomerContact({
      ...valid,
      alternatePhone: '+595981123456',
      alternatePhoneLabel: 'Hermana',
    })
    expect(errors.alternatePhone).toContain('mismo que el principal')
  })

  it('rejects an alternate that is too short', () => {
    const errors = validateCustomerContact({ ...valid, alternatePhone: '99', alternatePhoneLabel: 'Jefe' })
    expect(errors.alternatePhone).toContain('dígitos')
  })
})
