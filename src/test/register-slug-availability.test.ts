import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const ENDPOINT = leer('src/app/api/auth/check-slug/route.ts')
const REGISTRO = leer('src/app/api/auth/register-company/route.ts')
const PAGINA = leer('src/app/register/page.tsx')
const HOOK = leer('src/hooks/use-slug-availability.ts')

describe('verificación de la dirección al registrarse', () => {
  it('la pantalla consulta mientras se escribe', () => {
    // Antes la colisión se descubría al enviar el formulario completo.
    expect(PAGINA).toContain('useSlugAvailability')
    expect(PAGINA).toContain('slugStatus')
  })

  it('ofrece aplicar la alternativa de un clic', () => {
    expect(PAGINA).toContain('aplicarSugerencia')
    expect(PAGINA).toMatch(/Usar \{slugSugerencia\}/)
  })

  it('anuncia el estado a lectores de pantalla', () => {
    // El resultado se distingue por color e ícono; sin aria-live no llega a
    // quien no los ve.
    expect(PAGINA).toContain('aria-live="polite"')
  })
})

describe('el hook de disponibilidad', () => {
  it('espera antes de consultar', () => {
    expect(HOOK).toMatch(/setTimeout/)
    expect(HOOK).toMatch(/ESPERA_MS/)
  })

  it('descarta respuestas que llegan fuera de orden', () => {
    // Dos consultas seguidas podrían dejar el campo diciendo lo contrario de lo
    // que hay escrito.
    expect(HOOK).toContain('secuenciaRef')
    expect(HOOK).toMatch(/secuencia !== secuenciaRef\.current/)
    expect(HOOK).toContain('AbortController')
  })

  it('no afirma que está libre cuando la consulta falla', () => {
    // Decirlo llevaría al usuario a completar el formulario para chocar igual.
    const fallo = HOOK.slice(HOOK.indexOf('if (!res.ok)'))
    expect(fallo).toContain("estado: 'error'")
    expect(fallo.slice(0, 400)).not.toContain("estado: 'libre'")
  })

  it('resuelve el formato sin salir a la red', () => {
    const antesDelFetch = HOOK.slice(0, HOOK.indexOf('fetch('))
    expect(antesDelFetch).toContain('validateTenantSlug')
  })
})

describe('el endpoint de disponibilidad', () => {
  it('está limitado por IP', () => {
    expect(ENDPOINT).toContain('rateLimiter.check')
    expect(ENDPOINT).toContain('check-slug:')
  })

  it('normaliza igual que el registro', () => {
    // Lo que se consulta tiene que ser exactamente lo que se guardaría.
    expect(ENDPOINT).toContain('normalizeTenantSlug')
    expect(REGISTRO).toContain('normalizeTenantSlug')
  })

  it('falla cerrado si no puede consultar', () => {
    const bloque = ENDPOINT.slice(ENDPOINT.indexOf('if (error)'))
    expect(bloque.slice(0, 300)).toContain('503')
    expect(bloque.slice(0, 300)).not.toContain('available: true')
  })
})

describe('el servidor no confía en el navegador', () => {
  it('valida el formato y las reservas antes de crear la tienda', () => {
    // El esquema aceptaba cualquier texto de hasta 64 caracteres y la única
    // limpieza vivía en el formulario: una llamada directa podía crear una
    // tienda con slug `Admin` o `mi tienda`.
    expect(REGISTRO).toContain('validateTenantSlug')
    const guarda = REGISTRO.indexOf('validateTenantSlug')
    const consulta = REGISTRO.indexOf(".eq('slug'")
    expect(guarda, 'la validación debe ir antes de tocar la base').toBeLessThan(consulta)
  })

  it('usa el slug normalizado, no el que llegó', () => {
    expect(REGISTRO).not.toContain('input.companySlug)')
    expect(REGISTRO).toMatch(/\.eq\('slug', companySlug\)/)
  })

  it('marca el campo en vez de solo mostrar un cartel', () => {
    // Como banner suelto, el usuario tenía que adivinar cuál campo revisar, y el
    // captcha ya se había reiniciado.
    const colision = REGISTRO.slice(REGISTRO.indexOf('if (existingOrganization)'))
    expect(colision.slice(0, 500)).toContain("field: 'companySlug'")
  })
})
