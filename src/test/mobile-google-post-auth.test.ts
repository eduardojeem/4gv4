import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isNoBusinessError, setPostAuthRoute, takePostAuthRoute } from '../../mobile/src/lib/post-auth-route'

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

describe('después de entrar con Google', () => {
  it('el destino pendiente se entrega una sola vez', () => {
    setPostAuthRoute({ pathname: '/create-company', params: { plan: 'basic' } })
    expect(takePostAuthRoute()).toEqual({ pathname: '/create-company', params: { plan: 'basic' } })
    expect(takePostAuthRoute()).toBeNull()
  })

  it('el registro de empresa no navega desde su pantalla: lo hace el layout con la sesión', () => {
    // La pantalla de registro desaparece al guardarse la sesión y su navegación
    // quedaba pisada: la persona terminaba en el marketplace sin comercio.
    const register = read('mobile/src/app/register.tsx')
    expect(register).toContain("afterSignIn={{ pathname: '/create-company'")
    expect(register).not.toMatch(/onDone=\{\(\) => router\.replace\(\{ pathname: '\/create-company'/)
    const layout = read('mobile/src/app/_layout.tsx')
    expect(layout).toContain('takePostAuthRoute()')
  })

  it('el botón guarda el destino antes de abrir Google y lo limpia si no entra', () => {
    const button = read('mobile/src/components/google-sign-in-button.tsx')
    const save = button.indexOf('setPostAuthRoute(afterSignIn ?? null)')
    expect(save).toBeGreaterThan(-1)
    expect(save).toBeLessThan(button.indexOf('await signInWithGoogle()'))
    expect(button.match(/setPostAuthRoute\(null\)/g)?.length).toBeGreaterThanOrEqual(2)
  })
})

describe('cuenta sin comercio', () => {
  it('reconoce el 403 «sin comercio» con o sin código', () => {
    expect(isNoBusinessError(403, { code: 'NO_ACTIVE_ORGANIZATION' }, 'x')).toBe(true)
    expect(isNoBusinessError(403, null, 'Tu usuario no pertenece a ningún comercio activo.')).toBe(true)
    expect(isNoBusinessError(403, { code: 'FORBIDDEN' }, 'Sin permiso')).toBe(false)
    expect(isNoBusinessError(500, { code: 'NO_ACTIVE_ORGANIZATION' }, 'x')).toBe(false)
  })

  it('el servidor manda el código y el panel ofrece crear el comercio', () => {
    expect(read('src/app/api/mobile/dashboard/route.ts')).toContain("code: 'NO_ACTIVE_ORGANIZATION'")
    const panel = read('mobile/src/app/panel/index.tsx')
    expect(panel).toContain('Todavía no tenés un comercio')
    expect(panel).toContain("router.replace('/create-company'")
    expect(read('mobile/src/components/saas/shell.tsx')).toContain("account.business.state === 'none'")
  })
})
