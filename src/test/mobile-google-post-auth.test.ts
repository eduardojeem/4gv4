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

describe('la cuenta del marketplace se actualiza al crear el comercio', () => {
  it('create-company y el regreso a la app vuelven a pedir si tiene comercio', () => {
    const account = read('mobile/src/lib/marketplace-account.ts')
    expect(account).toContain('export function refreshMarketplaceAccount()')
    expect(account).toMatch(/AppState\.addEventListener\('change'[\s\S]*reload\(\)/)
    expect(read('mobile/src/lib/registration.ts')).toMatch(/refreshSession\(\)[\s\S]*refreshMarketplaceAccount\(\)/)
    expect(read('mobile/src/app/create-company.tsx')).toContain('if (alreadyHas) refreshMarketplaceAccount()')
  })
})

describe('ubicación de Google en ingreso y registro', () => {
  it('en el ingreso Google va arriba del correo, con el separador', () => {
    const signIn = read('mobile/src/app/sign-in.tsx')
    const google = signIn.indexOf('<GoogleSignInButton')
    expect(google).toBeGreaterThan(-1)
    expect(google).toBeLessThan(signIn.indexOf('Correo electrónico'))
    expect(signIn).toContain('<AuthDivider />')
    // El aviso viejo sobre la biometría ya no aparece siempre.
    expect(signIn).not.toContain('ya no guardamos tu contraseña para el acceso biométrico')
  })

  it('el registro de cliente pone Google primero y el formulario usa autocompletar', () => {
    const customer = read('mobile/src/app/register-customer.tsx')
    expect(customer.indexOf('<GoogleSignInButton')).toBeLessThan(customer.indexOf('<Section title="Tus datos"'))
    expect(customer).toContain('textContentType="newPassword"')
    expect(customer).toContain('autoComplete="email"')
  })

  it('«Crear una cuenta» ofrece Google como atajo', () => {
    expect(read('mobile/src/app/join.tsx')).toContain('<GoogleSignInButton')
  })
})
