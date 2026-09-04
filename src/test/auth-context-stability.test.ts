import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const CONTEXTO = leer('src/contexts/auth-context.tsx')

/**
 * Supabase refresca el token al volver a una pestaña y emite `TOKEN_REFRESHED`.
 * Ese evento cambiaba el objeto de sesión, que estaba en el valor del contexto,
 * así que volver al navegador re-renderizaba los ~70 archivos que leen
 * `useAuth()` — entre ellos la grilla de /dashboard/products, que es donde se
 * nota.
 *
 * Ninguno leía `session`: cero consumidores en todo el proyecto.
 */
describe('el contexto de auth no se mueve al volver a la pestaña', () => {
  it('el valor del contexto no incluye la sesión', () => {
    const value = CONTEXTO.slice(
      CONTEXTO.indexOf('const value = useMemo<AuthContextType>'),
      CONTEXTO.indexOf('<AuthContext.Provider'),
    )
    expect(value).not.toMatch(/^\s*session,$/m)
  })

  it('tampoco la tiene entre sus dependencias', () => {
    // Con `session` en las dependencias el memo se recalcula igual, aunque el
    // campo ya no se exponga.
    const deps = CONTEXTO.slice(CONTEXTO.indexOf('  }), ['), CONTEXTO.indexOf('<AuthContext.Provider'))
    expect(deps).not.toMatch(/^\s*session,$/m)
  })

  it('refreshUser lee la sesión de un ref, no del estado', () => {
    // Si dependiera del estado cambiaría de identidad en cada refresco y
    // arrastraría al valor del contexto igual que el propio campo.
    const fn = CONTEXTO.slice(CONTEXTO.indexOf('const refreshUser = useCallback'))
    const cuerpo = fn.slice(0, fn.indexOf('])') + 2)
    expect(cuerpo).toContain('sessionRef.current?.user')
    expect(cuerpo).toMatch(/\}, \[fetchUserProfile, resolveStableProfile\]\)/)
  })

  it('sigue cortando el refresco de token sin recargar el perfil', () => {
    // Lo de antes no se pierde: sin este corte, cada vuelta a la pestaña pegaba
    // a /api/auth/profile y armaba un `user` nuevo.
    expect(CONTEXTO).toContain("if (event === 'TOKEN_REFRESHED' && nextUser && latestUserRef.current?.id === nextUser.id)")
  })

  it('nadie lee la sesión desde useAuth', () => {
    // Es lo que hace seguro sacarla. Si alguien la necesita, conviene un
    // contexto aparte antes que volver a ponerla acá.
    const consumidores: string[] = []

    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })) {
        const ruta = join(dir, entrada.name)
        if (entrada.isDirectory()) { recorrer(ruta); continue }
        if (!/\.tsx?$/.test(entrada.name)) continue
        if (ruta.includes('auth-context')) continue

        const contenido = readFileSync(resolve(process.cwd(), ruta), 'utf8')
        // Desestructuraciones de useAuth() que saquen `session`.
        if (/const\s*\{[^}]*\bsession\b[^}]*\}\s*=\s*useAuth\(\)/.test(contenido)) {
          consumidores.push(ruta)
        }
      }
    }
    recorrer('src')

    expect(consumidores, `leen session: ${consumidores.join(', ')}`).toEqual([])
  })
})
