import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildPlanOptions,
  describePlanLimit,
  parseCreateOrganizationInput,
  sanitizeSlugTyping,
  timezoneOffsetLabel,
  trialDaysFrom,
} from '@/lib/superadmin/create-organization'

const PLANES = ['free', 'basic', 'pro', 'enterprise']
const base = { name: 'HCA Celular', plan: 'FREE' }

/**
 * El registro publico validaba el subdominio contra las rutas del sistema. El
 * alta de superadmin solo pedia `^[a-z0-9-]+$`: desde este panel se podia crear
 * una tienda `admin` o `marketplace`, tapada por la pantalla del sistema.
 */
describe('el subdominio sigue las mismas reglas que el registro público', () => {
  it('rechaza los reservados por el sistema', () => {
    for (const slug of ['admin', 'api', 'marketplace', 'superadmin', 'www']) {
      const r = parseCreateOrganizationInput({ ...base, slug }, PLANES)
      expect(r.ok).toBe(false)
      if (r.ok === false) {
        expect(r.field).toBe('slug')
        expect(r.slugReason).toBe('reserved')
      }
    }
  })

  it('rechaza lo demasiado corto', () => {
    const r = parseCreateOrganizationInput({ ...base, slug: 'ab' }, PLANES)
    expect(r.ok === false && r.slugReason).toBe('too_short')
  })

  it('normaliza igual que el registro: acentos, espacios y mayúsculas', () => {
    const r = parseCreateOrganizationInput({ ...base, slug: 'Mi Tienda Ñandú' }, PLANES)
    expect(r.ok && r.value.slug).toBe('mi-tienda-nandu')
  })

  it('sin subdominio lo genera desde el nombre', () => {
    const r = parseCreateOrganizationInput(base, PLANES)
    expect(r.ok && r.value.slug).toBe('hca-celular')
  })
})

describe('el plan tiene que existir', () => {
  it('un plan desconocido se rechaza en vez de volverse FREE', () => {
    // `normalizePlanCode` convertia cualquier cosa desconocida en FREE, sin avisar.
    const r = parseCreateOrganizationInput({ ...base, plan: 'GOLD' }, PLANES)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.field).toBe('plan')
  })

  it('un plan inactivo tampoco se acepta', () => {
    const r = parseCreateOrganizationInput({ ...base, plan: 'ENTERPRISE' }, ['free', 'pro'])
    expect(r.ok === false && r.field).toBe('plan')
  })

  it('no distingue mayúsculas', () => {
    const r = parseCreateOrganizationInput({ ...base, plan: 'pro' }, PLANES)
    expect(r.ok && r.value.plan).toBe('PRO')
  })
})

describe('moneda, zona horaria y propietario se validan en el servidor', () => {
  it('una moneda fuera de la lista se rechaza', () => {
    const r = parseCreateOrganizationInput({ ...base, currency: 'EUR' }, PLANES)
    expect(r.ok === false && r.field).toBe('currency')
  })

  it('una zona horaria inexistente se rechaza', () => {
    const r = parseCreateOrganizationInput({ ...base, timezone: 'Marte/Olimpo' }, PLANES)
    expect(r.ok === false && r.field).toBe('timezone')
  })

  it('sin moneda ni zona usa los valores de Paraguay', () => {
    const r = parseCreateOrganizationInput(base, PLANES)
    expect(r.ok && r.value.currency).toBe('PYG')
    expect(r.ok && r.value.timezone).toBe('America/Asuncion')
  })

  it('el correo se normaliza y se valida', () => {
    const ok = parseCreateOrganizationInput({ ...base, owner_email: '  Dueno@HCA.com.py ' }, PLANES)
    expect(ok.ok && ok.value.ownerEmail).toBe('dueno@hca.com.py')

    const mal = parseCreateOrganizationInput({ ...base, owner_email: 'no-es-correo' }, PLANES)
    expect(mal.ok === false && mal.field).toBe('ownerEmail')
  })

  it('sin correo, el propietario queda en null', () => {
    const r = parseCreateOrganizationInput(base, PLANES)
    expect(r.ok && r.value.ownerEmail).toBeNull()
  })
})

describe('escribir el subdominio a mano', () => {
  it('no se come el guion mientras se tipea', () => {
    // `normalizeTenantSlug` recorta los guiones del borde: aplicado al tipear,
    // «mi-» volvia a «mi» y era imposible escribir «mi-tienda».
    expect(sanitizeSlugTyping('mi-')).toBe('mi-')
    expect(sanitizeSlugTyping('mi-tienda')).toBe('mi-tienda')
  })

  it('limpia lo que no puede ir', () => {
    expect(sanitizeSlugTyping('Mi Tienda')).toBe('mi-tienda')
    expect(sanitizeSlugTyping('a--b')).toBe('a-b')
    expect(sanitizeSlugTyping('Ñandú')).toBe('nandu')
  })
})

describe('la zona horaria dice su desfase real', () => {
  it('Paraguay está en UTC-3, no en UTC-4', () => {
    // La lista anterior decia «Paraguay (UTC-4)». Paraguay usa UTC-3 todo el
    // año desde octubre de 2024. Si esta prueba falla, el entorno tiene datos de
    // zona horaria viejos y la etiqueta estaria mal para los usuarios.
    expect(timezoneOffsetLabel('America/Asuncion', new Date('2026-07-01T12:00:00Z'))).toBe('UTC-3')
  })

  it('una zona inexistente no inventa un desfase', () => {
    expect(timezoneOffsetLabel('Marte/Olimpo')).toBeNull()
  })
})

describe('los días de prueba', () => {
  it('cero es cero', () => {
    expect(trialDaysFrom(0)).toBe(0)
  })

  it('una fila rota no se lee como «sin prueba»', () => {
    // `Number(null)` es 0: sin cuidarlo, null daba cero días.
    expect(trialDaysFrom(null)).toBe(14)
    expect(trialDaysFrom(undefined)).toBe(14)
  })
})

/**
 * Las tarjetas de plan mostraban la ficha comercial y decian «Colaboradores
 * ilimitados» cuando faltaba la clave. Los limites que se aplican viven en
 * `plans`.
 */
describe('los planes que se ofrecen muestran los topes reales', () => {
  const comercial = [
    { tier: 'pro', name: 'Pro', price: 250000, trial_days: 14, is_popular: true, limits: { users: 999 } },
    { tier: 'free', name: 'Free', price: 0, trial_days: 0, limits: {} },
    { tier: 'basic', name: 'Basic', price: 90000, trial_days: 14, limits: { users: 5 } },
  ]
  const tecnico = [
    { code: 'PRO', limits: { users: 15, branches: 5 }, modules: ['pos', 'inventory', 'repairs'] },
    { code: 'FREE', limits: { users: 2, products: 50 }, modules: ['pos'] },
  ]

  it('los límites de la tabla técnica le ganan a la ficha comercial', () => {
    const pro = buildPlanOptions(comercial, tecnico).find((p) => p.code === 'PRO')!
    expect(pro.limits).toEqual({ users: 15, branches: 5 })
    expect(pro.limitsSource).toBe('technical')
    expect(pro.moduleCount).toBe(3)
  })

  it('sin fila técnica se usa la comercial y se dice', () => {
    const basic = buildPlanOptions(comercial, tecnico).find((p) => p.code === 'BASIC')!
    expect(basic.limitsSource).toBe('commercial')
    expect(basic.moduleCount).toBeNull()
  })

  it('se ordenan por precio', () => {
    expect(buildPlanOptions(comercial, tecnico).map((p) => p.code)).toEqual(['FREE', 'BASIC', 'PRO'])
  })

  it('una clave ausente es «no definido», no «sin tope»', () => {
    expect(describePlanLimit({ users: 2 }, 'branches')).toEqual({ kind: 'undefined' })
    expect(describePlanLimit({ branches: null }, 'branches')).toEqual({ kind: 'unlimited' })
    expect(describePlanLimit({ users: 15 }, 'users')).toEqual({ kind: 'number', value: 15 })
    expect(describePlanLimit(null, 'users')).toEqual({ kind: 'undefined' })
  })
})

/**
 * `user_roles` tiene UNIQUE(user_id) y `getSuperAdminUser` exige que ese unico
 * rol sea 'super_admin'. La funcion de asignacion hacia `on conflict do update
 * set role = 'admin'`: crear una organizacion con el correo de un superadmin
 * como propietario le quitaba el acceso, salteando LAST_SUPER_ADMIN.
 */
describe('asignar un propietario no le quita el rol en la plataforma', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260910120000_superadmin_owner_keeps_platform_role.sql'),
    'utf8'
  )
  // Solo el cuerpo de la funcion: el comentario de arriba cita el codigo viejo
  // justamente para explicar por que se cambio.
  const cuerpo = sql.slice(sql.indexOf('create or replace function'))

  it('el rol global solo se asigna a quien no tiene ninguno', () => {
    expect(cuerpo).toContain('on conflict (user_id) do nothing')
  })

  it('un perfil existente conserva su rol y su estado', () => {
    expect(cuerpo).not.toMatch(/set\s+role\s*=\s*'admin'/)
    const perfil = cuerpo.slice(cuerpo.indexOf('insert into public.profiles'), cuerpo.indexOf('insert into public.user_roles'))
    expect(perfil).not.toContain('status = ')
  })

  it('una cuenta suspendida no se asigna', () => {
    expect(cuerpo).toContain("raise exception 'OWNER_SUSPENDED'")
  })
})
