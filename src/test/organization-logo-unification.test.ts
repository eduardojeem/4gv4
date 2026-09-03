import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const ENDPOINT = 'src/app/api/admin/website/sync-company/route.ts'
const MIGRACION = 'supabase/migrations/20260902140000_unify_organization_logo.sql'

/**
 * El logo se cargaba en dos pantallas que guardaban en campos distintos. El
 * onboarding escribia `organizations.logo_url` —lo que lee el directorio del
 * marketplace, el contexto de la organizacion y los recibos de reparaciones— y
 * la pantalla del sitio escribia `website_settings.company_info.logoUrl`, que
 * solo alimenta el encabezado publico. Como el onboarding era el unico lugar
 * del proyecto que escribia el primero, cambiar el logo despues no llegaba
 * nunca al directorio.
 */
describe('un solo logo por tienda', () => {
  const endpoint = leer(ENDPOINT)

  it('el endpoint del sitio escribe el logo en la organización', () => {
    // El archivo usa CRLF, así que el bloque se acota por marcas y no por saltos.
    const i = endpoint.indexOf('const { error: orgUpdateError }')
    const j = endpoint.indexOf(".eq('id', orgId)", i)
    expect(i, 'no se encontró el update de organizations').toBeGreaterThan(-1)
    expect(endpoint.slice(i, j)).toContain('logo_url')
  })

  it('acepta el logo de forma explícita, no por el passthrough', () => {
    // Llegaba igual por el passthrough del schema y se guardaba en
    // website_settings, pero sin declararlo no se puede escribir en la
    // organización con un límite validado.
    const schema = endpoint.slice(endpoint.indexOf('const syncSchema'), endpoint.indexOf('async function handler'))
    expect(schema).toMatch(/logoUrl: z\.string\(\)/)
    expect(schema).toContain('max(500')
  })

  it('guarda "sin logo" como un solo valor', () => {
    // Cadena vacía y null significarían lo mismo y romperían cualquier
    // comparación posterior.
    expect(endpoint).toMatch(/logo_url: logoUrl\?\.trim\(\) \? logoUrl\.trim\(\) : null/)
  })

  it('el directorio del marketplace sigue leyendo el campo canónico', () => {
    expect(leer('src/lib/public/marketplace.ts')).toContain('logo_url')
    expect(leer('src/components/public/OrganizationDirectoryCard.tsx')).toContain('organization.logo_url')
  })
})

describe('backfill de logos desalineados', () => {
  const sql = leer(MIGRACION)

  it('empareja en los dos sentidos', () => {
    // Uno para las tiendas que cargaron el logo desde la pantalla del sitio y no
    // aparecían en el directorio; el otro para las que solo pasaron por el
    // onboarding y tenían el encabezado público sin logo.
    expect(sql).toMatch(/update public\.organizations/)
    expect(sql).toMatch(/update public\.website_settings/)
  })

  it('cuando difieren gana el que el comerciante podía editar', () => {
    const haciaOrg = sql.slice(sql.indexOf('update public.organizations'), sql.indexOf('update public.website_settings'))
    expect(haciaOrg).toContain("ws.value->>'logoUrl'")
    expect(haciaOrg).toContain('is distinct from')
  })

  it('no pisa el encabezado público si ya tiene logo propio', () => {
    const haciaSitio = sql.slice(sql.indexOf('update public.website_settings'))
    expect(haciaSitio).toMatch(/coalesce\(nullif\(trim\(ws\.value->>'logoUrl'\), ''\), ''\) = ''/)
  })

  it('normaliza el vacío a null', () => {
    expect(sql).toMatch(/nullif\(trim\(ws\.value->>'logoUrl'\), ''\)/)
  })
})
