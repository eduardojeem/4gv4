import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const PAGINA = leer('src/app/register/page.tsx')
const RUTA = leer('src/app/api/auth/register-company/route.ts')
const MIGRACION = leer('supabase/migrations/20260902160000_fix_plan_public_slugs.sql')

/**
 * Los dos espacios de nombres se cruzan: el slug público de un plan puede ser el
 * tier de otro. Tras corregir las URLs, `pro` es el slug de "Pro" (tier basic) y
 * a la vez el tier de "PRO+". Resolverlo con una sola condición dejaba el
 * resultado a merced del orden en que vinieran las filas.
 */
describe('precedencia al resolver el plan', () => {
  it('la pantalla busca primero por slug y solo después por tier', () => {
    expect(PAGINA).toMatch(/find\(\(plan\) => plan\.slug === planParam\)\s*\n?\s*\?\? availablePlans\.find\(\(plan\) => plan\.tier === planParam\)/)
  })

  it('la pantalla ya no mezcla ambos en una sola condición', () => {
    expect(PAGINA).not.toContain('plan.slug === planParam || plan.tier === planParam')
  })

  it('el servidor tampoco los mezcla en un or con limit(1)', () => {
    // Un `or` con limit(1) devuelve lo que la base quiera primero.
    expect(RUTA).not.toMatch(/or\(`tier\.eq\.\$\{selectedPlanTier\},public_slug/)
    expect(RUTA).toContain("buscarPlan('public_slug')")
    expect(RUTA).toContain("buscarPlan('tier')")
  })

  it('el servidor no consulta por tier si el slug ya resolvió o falló', () => {
    // Si la primera consulta erró, encadenar la segunda ocultaría el error.
    expect(RUTA).toMatch(/porSlug\.data \|\| porSlug\.error/)
  })
})

describe('migración de las URLs de plan', () => {
  it('libera el slug antes de asignarlo', () => {
    // `public_slug` es único: asignar `pro` antes de soltarlo falla.
    const suelta = MIGRACION.indexOf("set public_slug = 'pro-plus'")
    const asigna = MIGRACION.indexOf("set public_slug = 'pro', updated_at")
    expect(suelta).toBeGreaterThan(-1)
    expect(asigna).toBeGreaterThan(-1)
    expect(suelta, 'PRO+ debe soltar `pro` antes de que Pro lo tome').toBeLessThan(asigna)
  })

  it('no pisa nada si el primer paso no encontró su fila', () => {
    const segundo = MIGRACION.slice(MIGRACION.indexOf("set public_slug = 'pro', updated_at"))
    expect(segundo).toContain('not exists')
  })

  it('acota cada update a la fila esperada', () => {
    // Sin el filtro por slug actual, volver a correrla movería un slug ya bueno.
    expect(MIGRACION).toMatch(/where tier = 'pro'\s*\n\s*and public_slug = 'pro'/)
    expect(MIGRACION).toMatch(/where tier = 'basic'\s*\n\s*and public_slug = 'basic'/)
  })

  it('deja escrito el efecto sobre los enlaces publicados', () => {
    // El cambio reapunta `/register?plan=pro` de PRO+ a Pro.
    expect(MIGRACION).toContain('Enlaces viejos')
  })
})
