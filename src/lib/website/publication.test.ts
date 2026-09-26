import { describe, expect, it } from 'vitest'
import { getPublicationIssues, resolvePublicationUpdate } from './publication'

describe('store publication', () => {
  it('preserves existing publication flags when editing unrelated information', () => {
    expect(resolvePublicationUpdate({ storefront_public: false, marketplace_public: false }, {}))
      .toEqual({ storefrontPublic: false, marketplacePublic: false })
    expect(resolvePublicationUpdate({ storefront_public: true, marketplace_public: true }, {}))
      .toEqual({ storefrontPublic: true, marketplacePublic: true })
  })
  it('unpublishing also removes the store from the marketplace', () => {
    expect(resolvePublicationUpdate({ storefront_public: true, marketplace_public: true }, { storefrontPublic: false }))
      .toEqual({ storefrontPublic: false, marketplacePublic: false })
  })
  it('allows publishing the direct link without joining the marketplace', () => {
    expect(resolvePublicationUpdate({ storefront_public: false, marketplace_public: false }, { storefrontPublic: true }))
      .toEqual({ storefrontPublic: true, marketplacePublic: false })
  })
  it('requires contact details and a WhatsApp number for WhatsApp commerce', () => {
    expect(getPublicationIssues({ name: 'Mi tienda', phone: '0981123456' }, 'whatsapp')).toContain('Configurá un WhatsApp válido con código de país para recibir consultas.')
    expect(getPublicationIssues({ name: 'Mi tienda', phone: '0981123456', whatsapp: '595981123456' }, 'whatsapp')).toEqual([])
    expect(getPublicationIssues({ name: 'Mi tienda', phone: '0981123456' }, 'catalog')).toEqual([])
  })
})
