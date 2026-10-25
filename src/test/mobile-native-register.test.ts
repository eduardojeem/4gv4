import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getPasswordChecks } from '@/lib/auth/password-validation'
import { appReturnWithCaptcha, safeAppReturnUrl } from '@/lib/mobile-app-return'
import { validateTenantSlug } from '@/lib/saas/reserved-slugs'
import { slugifyTenantName } from '@/lib/saas/tenant'
import { registerCompanySchema } from '@/lib/validation/saas'
import {
  emptyRegisterForm,
  parseCaptchaReturn,
  passwordChecks,
  registerIssues,
  registerPayload,
  slugifyStoreName,
  storeSlugOf,
  type RegisterForm,
} from '../../mobile/src/lib/registration-model'

const root = join(__dirname, '../..')
const read = (file: string) => readFileSync(join(root, file), 'utf8')

const filled = (overrides: Partial<RegisterForm> = {}): RegisterForm => ({
  ...emptyRegisterForm('pro'),
  fullName: 'María González', email: 'maria@ejemplo.com', password: 'Una-Clave-2026', confirmPassword: 'Una-Clave-2026',
  companyName: 'Comercial San Miguel', ...overrides,
})

describe('paridad con la web', () => {
  it.each(['Comercial San Miguel', 'Ñandutí & Cía.', '  --Tienda  2026--  ', 'Café Ñemby', 'x'.repeat(80)])('la dirección de «%s» es la misma', (name) => {
    expect(slugifyStoreName(name)).toBe(slugifyTenantName(name))
  })

  it.each(['', 'corta', 'sinmayuscula1', 'SINMINUSCULA1', 'SinNumero', 'Una-Clave-2026'])('las reglas de contraseña para «%s» son las mismas', (password) => {
    expect(passwordChecks(password)).toEqual(getPasswordChecks(password))
  })

  it('lo que manda la app lo acepta el esquema del servidor', () => {
    const payload = registerPayload(filled({ businessVertical: 'hardware' }), 'x'.repeat(30))
    const parsed = registerCompanySchema.safeParse(payload)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.companySlug).toBe('comercial-san-miguel')
  })

  it('sin rubro no manda el campo (es opcional en el servidor)', () => {
    expect(registerPayload(filled(), 'x'.repeat(30))).not.toHaveProperty('businessVertical')
  })
})

describe('validación del formulario', () => {
  it('un formulario completo no tiene problemas', () => {
    expect(registerIssues(filled())).toEqual({})
  })

  it('marca cada campo con un mensaje claro', () => {
    const issues = registerIssues(emptyRegisterForm())
    expect(Object.keys(issues).sort()).toEqual(['companyName', 'companySlug', 'confirmPassword', 'email', 'fullName', 'password', 'plan'].sort())
  })

  it('contraseñas distintas o débiles', () => {
    expect(registerIssues(filled({ confirmPassword: 'Otra-2026' })).confirmPassword).toMatch(/no coinciden/)
    expect(registerIssues(filled({ password: 'corta', confirmPassword: 'corta' })).password).toMatch(/8 caracteres/)
  })

  it('la dirección sale del nombre y se puede cambiar', () => {
    expect(storeSlugOf({ companyName: 'Mi Tienda', companySlug: '' })).toBe('mi-tienda')
    expect(storeSlugOf({ companyName: 'Mi Tienda', companySlug: 'Otra Dirección' })).toBe('otra-direccion')
  })
})

describe('verificación de seguridad para la app', () => {
  it('la página del captcha vuelve solo a la dirección de la app', () => {
    const page = read('src/app/auth/captcha-app/page.tsx')
    expect(page).toMatch(/safeAppReturnUrl\(searchParams\.get\('app_return'\)\)/)
    expect(page).toMatch(/appReturnWithCaptcha\(appReturn, token\)/)
    expect(safeAppReturnUrl('https://otro-sitio.com', 'development')).toBeNull()
  })

  it('el token vuelve en la dirección de la app y la app lo lee', () => {
    const url = appReturnWithCaptcha('mitiendapy://captcha', 'tok.abc-123_xyz')
    expect(url).toBe('mitiendapy://captcha?captcha=tok.abc-123_xyz')
    expect(parseCaptchaReturn({ captcha: 'tok.abc-123_xyz' })).toBe('tok.abc-123_xyz')
    expect(parseCaptchaReturn({})).toBeNull()
    expect(parseCaptchaReturn({ captcha: 'x' })).toBeNull()
  })

  it('/auth es una dirección reservada: ninguna tienda puede tomarla', () => {
    expect(validateTenantSlug('auth').ok).toBe(false)
  })
})

describe('la app usa el registro nativo', () => {
  it('la pantalla manda a la misma API que la web, sin sesión ni comercio', () => {
    const lib = read('mobile/src/lib/registration.ts')
    expect(lib).toMatch(/'\/api\/auth\/register-company', \{\s*method: 'POST',\s*auth: false/)
    expect(lib).toMatch(/\/api\/auth\/check-slug\?slug=/)
    expect(read('mobile/src/app/register.tsx')).not.toMatch(/service_role|organization_id/)
  })

  it('las entradas de la app abren la pantalla nativa (la versión web sigue con la web)', () => {
    const lib = read('mobile/src/lib/registration.ts')
    expect(lib).toMatch(/Platform\.OS !== 'web'[\s\S]*router\.push\(\{ pathname: '\/register'/)
  })

  it('el registro solo se ve sin sesión iniciada', () => {
    expect(read('mobile/src/app/_layout.tsx')).toMatch(/<Stack\.Protected guard=\{!session\}>[\s\S]*name="register"[\s\S]*<\/Stack\.Protected>/)
  })
})
