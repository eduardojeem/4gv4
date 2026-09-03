import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_ROUTE_SLUGS,
  RESERVED_TENANT_SLUGS,
  normalizeTenantSlug,
  suggestTenantSlug,
  validateTenantSlug,
} from './reserved-slugs'

describe('direcciones reservadas', () => {
  it('cubre todas las rutas de primer nivel del proyecto', () => {
    // La tenencia también funciona por ruta (`/mitienda/inicio`), así que una
    // tienda con el slug de una pantalla del sistema queda tapada por ella.
    // Esta prueba falla al agregar una ruta nueva sin reservarla, en vez de que
    // el choque aparezca como el reporte de un cliente meses después.
    const raiz = resolve(process.cwd(), 'src/app')
    const rutas = readdirSync(raiz, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      // Los grupos `(public)` no aparecen en la URL: cuentan sus hijos.
      .flatMap((nombre) => nombre.startsWith('(')
        ? readdirSync(resolve(raiz, nombre), { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
        : [nombre])
      // Los segmentos dinámicos (`[slug]`) son justamente el catch-all de las
      // tiendas: no compiten con ellas.
      .filter((nombre) => !nombre.startsWith('[') && !nombre.startsWith('_'))

    const faltantes = rutas.filter((ruta) => !RESERVED_TENANT_SLUGS.has(ruta))
    expect(faltantes, `rutas sin reservar: ${faltantes.join(', ')}`).toEqual([])
  })

  it('rechaza los nombres de empresa que chocarían con el sistema', () => {
    for (const nombre of ['Marketplace', 'Admin', 'API', 'Dashboard', 'Productos']) {
      const check = validateTenantSlug(normalizeTenantSlug(nombre))
      expect(check.ok, nombre).toBe(false)
      if (check.ok === false) expect(check.reason).toBe('reserved')
    }
  })

  it('rechaza subdominios de infraestructura', () => {
    for (const nombre of ['www', 'mail', 'cdn', 'staging', 'app']) {
      const check = validateTenantSlug(nombre)
      expect(check.ok, nombre).toBe(false)
    }
  })

  it('acepta un nombre comercial normal', () => {
    const check = validateTenantSlug(normalizeTenantSlug('Comercial San Miguel S.R.L.'))
    expect(check.ok).toBe(true)
    if (check.ok) expect(check.slug).toBe('comercial-san-miguel-s-r-l')
  })
})

describe('formato de la dirección', () => {
  it('exige un mínimo para que sea escribible', () => {
    const check = validateTenantSlug('ab')
    expect(check.ok).toBe(false)
    if (check.ok === false) expect(check.reason).toBe('too_short')
  })

  it('rechaza lo que no puede ir en un subdominio', () => {
    // El esquema del servidor aceptaba cualquier texto de hasta 64 caracteres y
    // la única limpieza vivía en el navegador.
    for (const valor of ['Mi Tienda', 'tienda_1', '-tienda', 'tienda-', 'tiénda', '../admin']) {
      expect(validateTenantSlug(valor).ok, valor).toBe(false)
    }
  })

  it('normaliza acentos y espacios como lo haría el formulario', () => {
    expect(normalizeTenantSlug('  Panadería  Doña Ana  ')).toBe('panaderia-dona-ana')
    expect(normalizeTenantSlug('¡Ofertas 2026!')).toBe('ofertas-2026')
  })

  it('no deja que un nombre largo genere una dirección inválida', () => {
    const largo = normalizeTenantSlug('a'.repeat(120))
    expect(largo.length).toBeLessThanOrEqual(48)
    expect(validateTenantSlug(largo).ok).toBe(true)
  })
})

describe('sugerencia de alternativa', () => {
  it('propone la primera libre', () => {
    const tomados = new Set(['mitienda', 'mitienda-2', 'mitienda-3'])
    expect(suggestTenantSlug('mitienda', (s) => tomados.has(s))).toBe('mitienda-4')
  })

  it('la sugerencia respeta el largo máximo', () => {
    const base = 'a'.repeat(48)
    const sugerencia = suggestTenantSlug(base, () => false)
    expect(sugerencia).not.toBeNull()
    expect(sugerencia!.length).toBeLessThanOrEqual(48)
    // Y sigue siendo válida: una sugerencia que la propia validación rechaza
    // dejaría al usuario en un callejón.
    expect(validateTenantSlug(sugerencia!).ok).toBe(true)
  })

  it('no propone una dirección reservada', () => {
    const sugerencia = suggestTenantSlug('admin', () => false)
    expect(sugerencia).not.toBeNull()
    expect(RESERVED_TENANT_SLUGS.has(sugerencia!)).toBe(false)
  })

  it('se rinde en vez de devolver algo inválido', () => {
    expect(suggestTenantSlug('mitienda', () => true)).toBeNull()
  })
})

describe('la lista declarada', () => {
  it('no tiene duplicados', () => {
    expect(new Set(APP_ROUTE_SLUGS).size).toBe(APP_ROUTE_SLUGS.length)
  })

  it('solo contiene valores que serían slugs válidos si no estuvieran reservados', () => {
    // Un valor mal escrito en la lista no reservaría nada.
    for (const slug of APP_ROUTE_SLUGS) {
      expect(normalizeTenantSlug(slug), slug).toBe(slug)
    }
  })
})
