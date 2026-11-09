import { describe, expect, it } from 'vitest'
import { PLATFORM_DEFAULTS_KEYS, PlatformDefaultsUpdateSchema, SystemSettingsPartialSchema } from '@/lib/validations/system-settings'
import { mergeTenantAdminSettings, getTenantAdminSettings } from '@/lib/organization/admin-settings'

describe('partial organization settings updates', () => {
  it.each(['', '   '])('accepts an optional blank company email: %j', companyEmail => {
    expect(SystemSettingsPartialSchema.parse({ companyEmail })).toEqual({ companyEmail: '' })
  })

  it('trims a supplied company email and rejects invalid addresses', () => {
    expect(SystemSettingsPartialSchema.parse({ companyEmail: '  tienda@example.com  ' })).toEqual({ companyEmail: 'tienda@example.com' })
    expect(SystemSettingsPartialSchema.safeParse({ companyEmail: 'correo-invalido' }).success).toBe(false)
  })

  it('does not inject empty defaults for fields omitted by the client', () => {
    expect(SystemSettingsPartialSchema.parse({ companyAddress: 'Nueva dirección' })).toEqual({
      companyAddress: 'Nueva dirección',
    })
  })

  it('preserves contact fields across consecutive partial updates', () => {
    const initial = {
      admin_settings: {
        companyPhone: '0981 000000',
        companyAddress: 'Dirección anterior',
        city: 'Encarnación',
      },
    }

    const afterAddress = mergeTenantAdminSettings(
      initial,
      SystemSettingsPartialSchema.parse({ companyAddress: 'Nueva dirección' }),
    )
    const afterPhone = mergeTenantAdminSettings(
      afterAddress,
      SystemSettingsPartialSchema.parse({ companyPhone: '0982 000000' }),
    )

    expect(getTenantAdminSettings(afterPhone)).toMatchObject({
      companyPhone: '0982 000000',
      companyAddress: 'Nueva dirección',
      city: 'Encarnación',
    })
  })

  it('recorta espacios del RUC y la dirección', () => {
    expect(SystemSettingsPartialSchema.parse({ companyRuc: '  80012345-6 ', companyAddress: '  Mcal. López 123  ' })).toEqual({
      companyRuc: '80012345-6',
      companyAddress: 'Mcal. López 123',
    })
  })
})

describe('lista blanca de la configuración global (PlatformDefaultsUpdateSchema)', () => {
  it('acepta solo las claves que edita /superadmin/settings', () => {
    expect([...PLATFORM_DEFAULTS_KEYS].sort()).toEqual(
      ['companyAddress', 'companyEmail', 'companyName', 'companyPhone', 'companyRuc', 'currency', 'taxRate', 'timeZone'],
    )
    expect(PlatformDefaultsUpdateSchema.parse({ taxRate: 5, currency: 'BRL', timeZone: 'America/Sao_Paulo' })).toEqual({
      taxRate: 5, currency: 'BRL', timeZone: 'America/Sao_Paulo',
    })
  })

  it.each([
    [{ features: {} }],
    [{ socialLinks: { instagram: 'x' } }],
    [{ maintenanceMode: true }],
    [{ taxRate: 10, requireTwoFactor: true }],
  ])('rechaza claves fuera de la lista: %j', (input) => {
    const result = PlatformDefaultsUpdateSchema.safeParse(input)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
  })

  it('no inventa valores para lo que no llegó y recorta textos', () => {
    expect(PlatformDefaultsUpdateSchema.parse({ companyRuc: ' 80012345-6 ', companyAddress: ' Centro ' })).toEqual({
      companyRuc: '80012345-6', companyAddress: 'Centro',
    })
  })

  it.each([-1, 101, Number.NaN])('rechaza un IVA fuera de 0–100: %s', (taxRate) => {
    expect(PlatformDefaultsUpdateSchema.safeParse({ taxRate }).success).toBe(false)
  })

  it('acepta email vacío y rechaza uno inválido', () => {
    expect(PlatformDefaultsUpdateSchema.parse({ companyEmail: '  ' })).toEqual({ companyEmail: '' })
    expect(PlatformDefaultsUpdateSchema.safeParse({ companyEmail: 'no-es-email' }).success).toBe(false)
  })
})
