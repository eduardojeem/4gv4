import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  MAIN_CASH_REGISTER_NAME,
  STARTER_CATEGORIES,
  buildStarterCheckout,
  buildStarterTrustBar,
  ensureMainCashRegister,
  planStarterCategories,
} from '@/lib/organization/starter-kit'
import { BUSINESS_VERTICALS } from '@/lib/organization/business-profile'
import { getWebsiteDefaultsForVertical, getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { validateSetting } from '@/lib/validation/website-settings'
import { registerCompanySchema } from '@/lib/validation/saas'

vi.mock('@/lib/saas/subscription-service', () => ({
  canCreateResource: vi.fn(async () => ({ allowed: true })),
}))

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const CATALOGO = [
  { id: 'g-cel', name: 'Celulares', slug: 'celulares', is_active: true },
  { id: 'g-acc', name: 'Accesorios', slug: 'accesorios', is_active: true },
  { id: 'g-car', name: 'Cargadores', slug: 'cargadores', is_active: true },
]

describe('categorías de arranque', () => {
  it('cada rubro tiene las suyas', () => {
    for (const vertical of BUSINESS_VERTICALS) expect(STARTER_CATEGORIES[vertical].length, vertical).toBeGreaterThan(0)
  })

  /** Así la tienda aparece agrupada en el marketplace desde el primer producto. */
  it('en tecnología se vinculan a la taxonomía global por nombre', () => {
    const plan = planStarterCategories('electronics', [], CATALOGO)
    expect(plan.find((row) => row.name === 'Celulares')?.global_category_id).toBe('g-cel')
    expect(plan.find((row) => row.name === 'Repuestos')?.global_category_id).toBeNull()
  })

  /** «Accesorios» de ropa no puede caer en «Accesorios» de celulares. */
  it('en otros rubros no se vinculan a la taxonomía de tecnología', () => {
    expect(planStarterCategories('clothing', [], CATALOGO).every((row) => row.global_category_id === null)).toBe(true)
  })

  it('si la empresa ya cargó alguna, no agrega nada', () => {
    expect(planStarterCategories('electronics', ['Mis cosas'], CATALOGO)).toEqual([])
  })
})

describe('cobro con el que arranca la tienda', () => {
  const base = getWebsiteSettingsDefaults().checkout

  /** Ofrecía tarjeta a domicilio, transferencia sin cuentas y delivery. */
  it('solo efectivo y retiro en el local, y consultas por WhatsApp si hay número', () => {
    const checkout = buildStarterCheckout(base, { hasWhatsapp: true })
    expect(checkout.commerceMode).toBe('whatsapp')
    expect(checkout.payment.cash.enabled).toBe(true)
    expect([checkout.payment.card.enabled, checkout.payment.transfer.enabled, checkout.payment.digital_wallet.enabled]).toEqual([false, false, false])
    expect(checkout.delivery.enabled).toBe(false)
    expect(checkout.pickup.enabled).toBe(true)
    expect(validateSetting('checkout', checkout)).toMatchObject({ success: true })
  })

  it('sin WhatsApp queda el carrito', () => {
    expect(buildStarterCheckout(base, { hasWhatsapp: false }).commerceMode).toBe('cart')
  })

  it('la barra de confianza dice solo lo que la tienda ofrece', () => {
    const bar = buildStarterTrustBar(buildStarterCheckout(base, { hasWhatsapp: true }))
    expect(bar.items.map((item) => item.title)).toEqual(['Atención por WhatsApp', 'Retiro en el local', 'Pago en efectivo'])
    expect(JSON.stringify(bar)).not.toMatch(/Envíos|Tarjeta|Garantía/)
    expect(validateSetting('trust_bar', bar)).toMatchObject({ success: true })
  })
})

describe('caja principal', () => {
  const fakeAdmin = (state: { branches: Array<{ id: string; is_default: boolean }>; registers: number; inserted: unknown[] }) => ({
    from: (table: string) => {
      if (table === 'branches') return { select: () => ({ eq: async () => ({ data: state.branches }) }) }
      if (table === 'cash_registers') {
        return {
          select: () => ({ eq: async () => ({ count: state.registers }) }),
          insert: async (row: unknown) => { state.inserted.push(row); return { error: null } },
        }
      }
      throw new Error(table)
    },
  }) as never

  it('crea «Caja principal» en la sucursal principal si no hay ninguna', async () => {
    const state = { branches: [{ id: 'b2', is_default: false }, { id: 'b1', is_default: true }], registers: 0, inserted: [] as unknown[] }
    expect(await ensureMainCashRegister(fakeAdmin(state), 'org-1', 'user-1')).toBe(true)
    expect(state.inserted).toEqual([{ name: MAIN_CASH_REGISTER_NAME, is_open: false, balance: 0, branch_id: 'b1', organization_id: 'org-1', created_by: 'user-1' }])
  })

  it('no crea otra si ya tiene caja', async () => {
    const state = { branches: [{ id: 'b1', is_default: true }], registers: 1, inserted: [] as unknown[] }
    expect(await ensureMainCashRegister(fakeAdmin(state), 'org-1')).toBe(false)
    expect(state.inserted).toEqual([])
  })
})

describe('datos inventados fuera de los predeterminados', () => {
  /** Una tienda nueva prometía envíos, pagos seguros y garantías que no ofrecía. */
  it('ningún rubro promete envíos, pago seguro ni garantías', () => {
    const textos = JSON.stringify([
      getWebsiteSettingsDefaults(),
      ...BUSINESS_VERTICALS.map((vertical) => getWebsiteDefaultsForVertical(vertical, 'retail')),
      getWebsiteDefaultsForVertical('electronics', 'repair'),
      getWebsiteDefaultsForVertical('general', 'service'),
    ])
    for (const promesa of ['Envíos a todo el país', 'Compra 100% segura', 'Pago 100% seguro', 'Garantía oficial', 'Técnicos certificados', 'Delivery express', 'Envíos Rápidos']) {
      expect(textos, promesa).not.toContain(promesa)
    }
  })

  it('el onboarding no guarda un horario de ejemplo', () => {
    expect(leer('src/app/api/onboarding/complete/route.ts')).not.toContain("'Lunes a viernes, 08:00 a 18:00'")
    expect(leer('src/app/dashboard/onboarding/page.tsx')).not.toContain("|| 'Lunes a viernes, 08:00 a 18:00'")
  })
})

describe('el alta usa el kit', () => {
  it('el registro acepta el rubro y crea el kit', () => {
    const parsed = registerCompanySchema.safeParse({
      fullName: 'Ana Pérez', email: 'ana@tienda.com', password: 'Clave-Segura-2026!', companyName: 'Tienda Ana',
      plan: 'pro', captchaToken: 'x', businessVertical: 'clothing',
    })
    if (parsed.success) expect(parsed.data.businessVertical).toBe('clothing')
    expect(registerCompanySchema.safeParse({ businessVertical: 'inventado' }).success).toBe(false)

    const registro = leer('src/app/api/auth/register-company/route.ts')
    expect(registro).toContain('business_vertical: input.businessVertical')
    expect(registro).toContain('provisionStarterKit(')
  })

  it('el onboarding siembra cobro, barra de confianza y WhatsApp', () => {
    const onboarding = leer('src/app/api/onboarding/complete/route.ts')
    expect(onboarding).toContain("{ key: 'checkout', value: starterCheckout }")
    expect(onboarding).toContain("{ key: 'trust_bar', value: buildStarterTrustBar(starterCheckout) }")
    expect(onboarding).toContain('whatsapp: input.whatsapp || input.phone')
    expect(onboarding).toContain('provisionStarterKit(')
  })

  it('el alta desde superadmin crea la caja principal', () => {
    expect(leer('src/app/api/superadmin/organizations/route.ts')).toContain('provisionStarterKit(admin')
  })
})
