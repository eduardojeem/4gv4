import { describe, expect, it } from 'vitest'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { WebsiteSettings } from '@/types/website-settings'

describe('applyWebsiteSettingsDefaults', () => {
  it('deep merges nested company info fields', () => {
    const result = applyWebsiteSettingsDefaults({
      company_info: {
        name: '4G',
        hours: {
          weekdays: '08:00 - 18:00',
          saturday: ''
        }
      }
    } as Partial<WebsiteSettings>)

    expect(result.company_info.name).toBe('4G')
    expect(result.company_info.phone).toBe('')
    expect(result.company_info.hours.weekdays).toBe('08:00 - 18:00')
    expect(result.company_info.hours.saturday).toBe('')
    expect(result.company_info.hours.sunday).toBe('')
    expect(result.company_info.showTopBar).toBe(true)
  })

  it('preserves provided maintenance fields while backfilling missing ones', () => {
    const result = applyWebsiteSettingsDefaults({
      maintenance_mode: {
        enabled: true,
        title: 'Mantenimiento programado'
      }
    } as Partial<WebsiteSettings>)

    expect(result.maintenance_mode.enabled).toBe(true)
    expect(result.maintenance_mode.title).toBe('Mantenimiento programado')
    expect(result.maintenance_mode.message).toBe('Estamos realizando mejoras en nuestro sitio. Volveremos pronto.')
    expect(result.maintenance_mode.estimatedEnd).toBe('')
  })
})
