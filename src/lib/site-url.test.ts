import { afterEach, describe, expect, it } from 'vitest'
import { getSiteUrl } from '@/lib/site-url'

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe('getSiteUrl', () => {
  it('usa el dominio canónico configurado y elimina barras finales', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.mitiendapy.com///'
    process.env.NEXT_PUBLIC_APP_URL = 'https://servix360.org'

    expect(getSiteUrl()).toBe('https://www.mitiendapy.com')
  })

  it('no recupera dominios heredados desde NEXT_PUBLIC_APP_URL', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://servix360.org'

    expect(getSiteUrl()).toBe('https://www.mitiendapy.com')
  })
})
