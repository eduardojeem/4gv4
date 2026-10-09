import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildVerticalWebsitePreset } from '@/lib/website/vertical-website-preset'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { BusinessVertical, OperatingModel, OrganizationModule } from '@/lib/organization/business-profile'
import type { WebsiteSettings } from '@/types/website-settings'

function prepare(vertical: BusinessVertical, model: OperatingModel, modules: OrganizationModule[], current: Partial<WebsiteSettings> = {}) {
  const capabilities = resolveStorefrontCapabilities({ businessVertical: vertical, operatingModel: model, effectiveModules: modules })
  return buildVerticalWebsitePreset({ vertical, model, capabilities, effectiveModules: modules, current })
}

const base = getWebsiteSettingsDefaults()
const myStore = {
  company_info: { ...base.company_info, name: 'Mi Tienda', logoUrl: '/logo.png', phone: '0981123456', storefrontStyle: 'tech' as const },
}

describe('preparar la página web para el rubro', () => {
  it('una barbería con agenda: portada de turnos, reservas y recorrido de turnos', () => {
    const { values, summary } = prepare('barbershop', 'service', ['services', 'pos', 'crm'], myStore)
    expect(values.hero_content?.ctaPrimaryText).toBe('Reservar turno')
    expect(values.booking_section?.enabled).toBe(true)
    expect(values.process_flows?.[0].title).toBe('Turnos')
    expect(values.company_info?.servicesPageEnabled).toBe(true)
    expect(summary).toContain('Reservas online en el inicio')
  })

  it('una cosmética no habla de reparaciones ni ofrece seguimiento de reparaciones', () => {
    const { values } = prepare('cosmetics', 'retail', ['inventory', 'pos', 'crm', 'orders', 'ecommerce'], myStore)
    const text = JSON.stringify([values.hero_content, values.trust_bar, values.process_flows])
    expect(text).not.toMatch(/reparaci|servicio técnico|diagnóstico/i)
    expect(values.company_info?.repairTrackingEnabled).toBe(false)
    expect(values.booking_section).toBeUndefined()
  })

  it('la plantilla vuelve a «Automático» y se conservan nombre, logo y contacto', () => {
    const { values } = prepare('clothing', 'retail', ['inventory', 'orders'], myStore)
    expect(values.company_info).toMatchObject({ storefrontStyle: 'auto', name: 'Mi Tienda', logoUrl: '/logo.png', phone: '0981123456' })
  })

  it('los números de ejemplo quedan apagados', () => {
    expect(prepare('food', 'retail', ['orders'], myStore).values.hero_stats?.enabled).toBe(false)
  })

  it('el cobro respeta el plan: sin pedidos no hay carrito, sin entregas no hay delivery', () => {
    const sinPedidos = prepare('food', 'retail', ['inventory'], myStore).values.checkout!
    expect(sinPedidos.commerceMode).toBe('whatsapp')
    const conPedidos = prepare('food', 'retail', ['orders'], myStore).values.checkout!
    expect(conPedidos.commerceMode).toBe('cart')
    expect(conPedidos.delivery.enabled).toBe(false)
    expect(prepare('food', 'retail', ['orders', 'delivery'], myStore).values.checkout!.delivery.enabled).toBe(true)
  })

  it('no deja activa una transferencia sin cuentas, y conserva las cuentas cargadas', () => {
    const conCuenta = {
      ...myStore,
      checkout: { ...base.checkout!, payment: { ...base.checkout!.payment, transfer: { ...base.checkout!.payment.transfer, enabled: true, transferOptions: [{ id: 'a', bankName: 'Itaú', alias: '80012345-6' }] } } },
    }
    expect(prepare('clothing', 'retail', ['orders'], conCuenta).values.checkout!.payment.transfer).toMatchObject({ enabled: true, transferOptions: [{ alias: '80012345-6' }] })
    const sinCuenta = { ...myStore, checkout: { ...base.checkout!, payment: { ...base.checkout!.payment, transfer: { ...base.checkout!.payment.transfer, enabled: true, transferOptions: [] } } } }
    expect(prepare('clothing', 'retail', ['orders'], sinCuenta).values.checkout!.payment.transfer.enabled).toBe(false)
  })

  it('el perfil prepara la página solo si se pide, y refresca el marketplace', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/admin/organization-profile/route.ts'), 'utf8')
    expect(route).toContain('(body as { prepareWebsite?: unknown }).prepareWebsite === true')
    expect(route).toContain("revalidateTag('marketplace:organizations', 'max')")
  })
})
