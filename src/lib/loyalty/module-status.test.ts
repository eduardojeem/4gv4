import { describe, expect, it } from 'vitest'
import { isLoyaltyModuleMissing } from './module-status'

describe('isLoyaltyModuleMissing', () => {
  it('reconoce el código de tabla inexistente', () => {
    expect(isLoyaltyModuleMissing({ code: '42P01', message: 'relation does not exist' })).toBe(true)
  })

  it('reconoce el código de función inexistente', () => {
    expect(isLoyaltyModuleMissing({ code: '42883' })).toBe(true)
  })

  it('reconoce cuando PostgREST no encuentra la tabla en su cache', () => {
    expect(isLoyaltyModuleMissing({
      code: 'PGRST205',
      message: "Could not find the table 'public.raffles' in the schema cache",
    })).toBe(true)
  })

  it('reconoce el mensaje sin código, que es como llega a veces', () => {
    expect(isLoyaltyModuleMissing({
      message: 'relation "public.loyalty_ledger" does not exist',
    })).toBe(true)
  })

  it('NO confunde un error real con una migración faltante', () => {
    // Este es el caso peligroso: si diera true, la UI diria "corré la
    // migración" cuando en realidad el problema es un permiso.
    expect(isLoyaltyModuleMissing({
      code: '42501',
      message: 'permission denied for table loyalty_ledger',
    })).toBe(false)
  })

  it('tampoco confunde un error de otra tabla que sí existe', () => {
    expect(isLoyaltyModuleMissing({
      code: '42P01',
      message: 'relation "public.otra_cosa" does not exist',
    })).toBe(true) // el código es inequívoco
    expect(isLoyaltyModuleMissing({
      message: 'relation "public.otra_cosa" does not exist',
    })).toBe(false) // sin código y sin mencionar lo nuestro, no se asume nada
  })

  it('sin error no hay módulo faltante', () => {
    expect(isLoyaltyModuleMissing(null)).toBe(false)
    expect(isLoyaltyModuleMissing(undefined)).toBe(false)
    expect(isLoyaltyModuleMissing({})).toBe(false)
  })
})
