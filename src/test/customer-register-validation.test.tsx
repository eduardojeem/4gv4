import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  describeAuthError,
  EMAIL_YA_REGISTRADO,
  signUpFoundExistingAccount,
} from '@/lib/auth/auth-error-messages'

/**
 * El registro de clientes de una tienda es la primera pantalla donde alguien
 * escribe algo: si el error no se entiende, no vuelve. Mostraba el texto crudo
 * de Supabase —«User already registered», «For security purposes, you can only
 * request this after 31 seconds»— y un «Error de validación» sin decir qué
 * campo estaba mal.
 */

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const FORMULARIO = leer('src/app/[organizationSlug]/cliente/registro/page.tsx')
const API = leer('src/app/api/public/customer-register/route.ts')
const LOGIN = leer('src/app/[organizationSlug]/cliente/login/page.tsx')
const CAPTCHA = leer('src/components/security/TurnstileChallenge.tsx')

describe('los errores de Supabase se leen en castellano', () => {
  it('no se le muestra a nadie el texto original', () => {
    const casos = [
      'User already registered',
      'Invalid login credentials',
      'For security purposes, you can only request this after 31 seconds',
      'captcha protection: request disallowed (invalid-input-response)',
      'Password should be at least 6 characters',
      'Signups not allowed for this instance',
      'Failed to fetch',
    ]

    for (const original of casos) {
      for (const flujo of ['login', 'register'] as const) {
        const traducido = describeAuthError(original, flujo)
        expect(traducido).not.toBe(original)
        expect(traducido).not.toMatch(/[a-z]+ (should|already|not allowed|disallowed)/i)
      }
    }
  })

  it('cada mensaje dice qué hacer después', () => {
    expect(describeAuthError('User already registered', 'register')).toContain('Iniciá sesión')
    expect(describeAuthError('Invalid login credentials', 'login')).toContain('Verificá los datos')
    expect(describeAuthError('Email not confirmed', 'login')).toContain('casilla de correo')
    expect(describeAuthError('captcha protection: request disallowed', 'register')).toContain(
      'verificación de seguridad'
    )
    expect(describeAuthError('For security purposes, you can only request this after 31 seconds', 'register'))
      .toContain('Esperá')
  })

  it('un error desconocido no filtra detalles internos', () => {
    const raro = 'PGRST301: JWT expired at column 42'
    expect(describeAuthError(raro, 'register')).not.toContain('JWT')
    expect(describeAuthError(raro, 'login')).not.toContain('PGRST')
    expect(describeAuthError('', 'register')).toBeTruthy()
    expect(describeAuthError(null, 'login')).toBeTruthy()
  })

  it('la pantalla de ingreso usa la misma tabla, para que no se desincronicen', () => {
    expect(LOGIN).toContain("describeAuthError(loginError.message, 'login')")
  })
})

describe('un correo ya registrado', () => {
  it('se detecta aunque Supabase no lo diga', () => {
    // Con confirmación por mail, Supabase devuelve un usuario sin identidades
    // para que nadie pueda averiguar quién tiene cuenta.
    expect(signUpFoundExistingAccount({ identities: [] })).toBe(true)
    expect(signUpFoundExistingAccount({ identities: [{ id: 'x' }] })).toBe(false)
    expect(signUpFoundExistingAccount(null)).toBe(false)
    expect(signUpFoundExistingAccount({})).toBe(false)
  })

  it('la API corta ahí y no toca la cuenta que ya existe', () => {
    // Sin este corte se respondia «cuenta creada» por un mail que nunca llega,
    // y el upsert de abajo pisaba el nombre y el estado de una cuenta ajena.
    expect(API).toContain('if (signUpFoundExistingAccount(authData.user)) {')
    expect(API).toContain("code: 'email_already_registered'")
    const corte = API.indexOf('signUpFoundExistingAccount(authData.user)')
    const upsert = API.indexOf("admin.from('profiles').upsert")
    expect(corte).toBeGreaterThan(-1)
    expect(corte).toBeLessThan(upsert)
  })

  it('y el formulario ofrece el camino correcto: ingresar', () => {
    expect(EMAIL_YA_REGISTRADO).toContain('Iniciá sesión')
    expect(FORMULARIO).toContain("setEmailYaRegistrado(result.code === 'email_already_registered')")
    expect(FORMULARIO).toContain('Iniciar sesión con ese correo')
  })
})

describe('la validación del formulario', () => {
  it('revisa todo junto y no de a un error por envío', () => {
    expect(FORMULARIO).toContain('function validateFields()')
    expect(FORMULARIO).toContain('if (!validateFields()) {')
    for (const campo of ['fullName', 'email', 'phone', 'password', 'confirmPassword']) {
      expect(FORMULARIO).toContain(`errores.${campo} =`)
    }
  })

  it('el aviso va debajo del dato equivocado, no arriba de todo', () => {
    expect(FORMULARIO).toContain('<FieldError id="fullName-error">')
    expect(FORMULARIO).toContain('<FieldError id="email-error">')
    expect(FORMULARIO).toContain('<FieldError id="confirmPassword-error">')
    expect(FORMULARIO).toContain('aria-invalid={Boolean(fieldErrors.email)}')
  })

  it('y se borra al corregir, no al volver a enviar', () => {
    expect(FORMULARIO).toContain(
      'setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))'
    )
  })

  it('el correo pasa por la validación estricta, no sólo por el type=email', () => {
    // `type="email"` del navegador acepta «a@b»: sin punto ni dominio real.
    expect(FORMULARIO).toContain('isValidEmail(formData.email.trim())')
    expect(FORMULARIO).toContain("email: formData.email.trim().toLowerCase()")
  })

  it('el teléfono es opcional, pero a medias no sirve', () => {
    expect(FORMULARIO).toContain('digitosDelTelefono.length < 6')
    expect(FORMULARIO).toContain('(opcional)')
  })

  it('los campos ayudan al teclado y al autocompletado del teléfono', () => {
    expect(FORMULARIO).toContain('autoComplete="name"')
    expect(FORMULARIO).toContain('autoComplete="email"')
    expect(FORMULARIO).toContain('autoComplete="tel"')
    expect(FORMULARIO).toContain('autoComplete="new-password"')
    expect(FORMULARIO).toContain('maxLength={160}')
  })

  it('no quedan textos sin acentos en la pantalla', () => {
    // Sólo los textos que se ven: `digitosDelTelefono` es una variable.
    const visibles = FORMULARIO.match(/>[^<>{}]*[A-Za-zÁÉÍÓÚáéíóúñÑ][^<>{}]*</g)?.join(' | ') ?? ''
    for (const roto of ['contrasena', 'Contrasena', 'electronico', 'Telefono', 'verificacion', 'Ya tenes cuenta']) {
      expect(visibles).not.toContain(roto)
    }
    expect(FORMULARIO).toContain('¿Ya tenés cuenta?')
  })
})

describe('la verificación de seguridad', () => {
  it('le habla al cliente, no al programador', () => {
    // «Agrega la Site Key de Turnstile» no le dice nada a quien entra a comprar.
    expect(CAPTCHA).not.toContain('Site Key de Turnstile para continuar')
    expect(CAPTCHA).toContain('Probá de nuevo más tarde o escribinos por WhatsApp')
    // El detalle técnico sigue existiendo, pero en la consola.
    expect(CAPTCHA).toContain('[Turnstile] Falta NEXT_PUBLIC_TURNSTILE_SITE_KEY')
  })

  it('y sus mensajes están acentuados', () => {
    for (const roto of ['verificacion', 'Verificacion', 'vencio', 'Completa la', 'conexion']) {
      expect(CAPTCHA).not.toContain(roto)
    }
  })
})

describe('la validación de la API habla el mismo idioma', () => {
  it('sus mensajes están en castellano y dicen qué corregir', () => {
    expect(API).toContain("'Escribí tu nombre y apellido (al menos 2 letras).'")
    expect(API).toContain("'Revisá el correo: tiene que ser como nombre@correo.com.'")
    expect(API).not.toContain("error: 'Error de validación'")
  })

  it('dice qué campo falló, para poder marcarlo', () => {
    expect(API).toContain('field: primero?.path?.[0] ?? null')
    expect(FORMULARIO).toContain('const campo = result.field as keyof typeof formData | null | undefined')
  })

  it('el requisito de contraseña sale de la misma función que el formulario', () => {
    // Antes la API decia «no cumple los requisitos» sin decir cual falta.
    expect(API).toContain('const problema = validatePassword(value)')
    expect(API).toContain("ctx.addIssue({ code: 'custom', message: problema })")
  })

  it('y lo que Supabase contesta pasa por la traducción', () => {
    expect(API).toContain("error: describeAuthError(authError?.message, 'register')")
    // El texto original queda en el log, no en la respuesta.
    expect(API).toContain("logger.warn('Customer register rechazado por Supabase', { error: authError?.message })")
    expect(API).not.toContain("{ success: false, error: authError?.message")
  })
})
