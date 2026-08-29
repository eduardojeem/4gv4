import { describe, expect, it } from 'vitest'
import { SystemSettingsPartialSchema } from '@/lib/validations/system-settings'
import { mergeTenantAdminSettings, getTenantAdminSettings } from '@/lib/organization/admin-settings'

describe('partial organization settings updates', () => {
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
})
