import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { registerCompanySchema } from '@/lib/validation/saas'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const PAGINA = leer('src/app/register/page.tsx')
const RUTA = leer('src/app/api/auth/register-company/route.ts')

const baseValida = {
  fullName: 'Maria Gonzalez',
  email: 'maria@ejemplo.com',
  password: 'Una-Clave-Larga-2026',
  companyName: 'Comercial San Miguel',
  captchaToken: 'x'.repeat(24),
}

/**
 * Esta plataforma no tiene plan gratuito: el tier `free` es un plan PAGO
 * llamado "Lite" (45.000 al mes, 20 días de regalo). El registro caía a ese
 * tier por defecto, así que quien llegaba sin plan —o con un enlace a un plan
 * que se desactivó después— quedaba inscripto en Lite sin verlo nunca, y a los
 * 20 días pasaba a `past_due` y a los 27 a `suspended`.
 */
describe('el plan es obligatorio', () => {
  it('el esquema ya no tiene un plan por defecto', () => {
    const sinPlan = registerCompanySchema.safeParse(baseValida)
    expect(sinPlan.success).toBe(false)
  })

  it('el esquema ya no depende de una lista fija de tiers', () => {
    // Un plan creado desde el panel con otro tier tiene que poder elegirse.
    const otroTier = registerCompanySchema.safeParse({ ...baseValida, plan: 'premium-anual' })
    expect(otroTier.success).toBe(true)
  })

  it('sigue rechazando basura en el parámetro', () => {
    for (const valor of ['', '../admin', 'plan con espacios', '-premium']) {
      expect(registerCompanySchema.safeParse({ ...baseValida, plan: valor }).success, valor).toBe(false)
    }
  })

  it('normaliza el plan a minúsculas', () => {
    const parsed = registerCompanySchema.safeParse({ ...baseValida, plan: 'PRO' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.selectedPlan).toBe('PRO')
  })
})

describe('la pantalla no inventa un plan', () => {
  it('no cae a un tier por defecto', () => {
    expect(PAGINA).toContain('planInfo?.tier ?? null')
    expect(PAGINA).not.toMatch(/:\s*'free'/)
  })

  it('no envía el formulario sin plan', () => {
    expect(PAGINA).toContain('if (!selectedPlan)')
    expect(PAGINA).toMatch(/disabled=\{loading \|\| !captchaToken \|\| !selectedPlan/)
  })

  it('ofrece los planes vigentes cuando no hay ninguno elegido', () => {
    expect(PAGINA).toContain('Elegí tu plan para continuar')
    expect(PAGINA).toContain('availablePlans.map')
  })

  it('avisa cuando el enlace apunta a un plan que ya no está', () => {
    // ULTRA está desactivado: antes ese enlace caía en Lite sin decir nada.
    expect(PAGINA).toContain("planState === 'no-disponible'")
    expect(PAGINA).toContain('Ese plan ya no está disponible')
  })

  it('distingue no-disponible de sin-plan y de cargando', () => {
    // Mientras carga no puede decir que el plan no existe.
    expect(PAGINA).toMatch(/planState !== 'ok' && planState !== 'cargando'/)
  })

  it('muestra los días de regalo reales de cada plan', () => {
    expect(PAGINA).toContain('días de regalo')
    expect(PAGINA).toContain('plan.trialDays')
  })

  it('dice algo útil si no hay ningún plan activo', () => {
    // Mostrar el formulario ahí llevaría a un error recién al enviar.
    expect(PAGINA).toContain('No hay planes disponibles en este momento')
  })
})

describe('el servidor resuelve el plan real', () => {
  it('acepta el tier o el slug público', () => {
    // Los enlaces que circulan usan el slug; la API no debería depender de que
    // el navegador ya lo hubiera traducido. La precedencia entre ambos se
    // verifica en plan-slug-resolution.test.ts.
    expect(RUTA).toContain("buscarPlan('public_slug')")
    expect(RUTA).toContain("buscarPlan('tier')")
  })

  it('guarda el tier de la fila, no lo que llegó', () => {
    expect(RUTA).toContain('const resolvedPlanTier = String(subscriptionPlan.tier).toUpperCase()')
    expect(RUTA).toMatch(/plan: resolvedPlanTier/)
  })

  it('solo considera planes activos', () => {
    const consulta = RUTA.slice(RUTA.indexOf("from('subscription_plans')"))
    expect(consulta.slice(0, 400)).toContain("eq('is_active', true)")
  })

  it('el error de plan no disponible dice qué hacer', () => {
    const bloque = RUTA.slice(RUTA.indexOf('if (!subscriptionPlan)'))
    expect(bloque.slice(0, 600)).toContain('Elegí uno de los planes vigentes')
    expect(bloque.slice(0, 600)).toContain("field: 'plan'")
  })
})
