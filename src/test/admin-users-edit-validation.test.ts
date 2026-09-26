import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  KNOWN_PERMISSIONS,
  firstUserEditIssue,
  userEditSchema,
} from '@/lib/admin/user-edit-validation'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const guardar = (body: Record<string, unknown>) => userEditSchema.safeParse(body)
const error = (body: Record<string, unknown>) => {
  const result = guardar(body)
  expect(result.success, JSON.stringify(body)).toBe(false)
  return result.success ? '' : firstUserEditIssue(result.error)
}

/**
 * El servidor guardaba el nombre, el teléfono y el área tal como llegaban, y un
 * rol desconocido caía en «cliente» sin avisar: un error de escritura dejaba sin
 * acceso a alguien del equipo.
 */
describe('editar un usuario', () => {
  it('acepta una edición normal', () => {
    const result = guardar({
      name: '  Ana González  ',
      phone: '+595 985 796 523',
      department: 'Ventas',
      role: 'vendedor',
      status: 'active',
      permissions: ['products.create'],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Ana González')
  })

  it('el nombre necesita al menos dos caracteres y alguna letra', () => {
    expect(error({ name: 'A' })).toContain('2 caracteres')
    expect(error({ name: '   ' })).toContain('2 caracteres')
    expect(error({ name: '123 456' })).toContain('letras')
    expect(error({ name: 'x'.repeat(121) })).toContain('120')
  })

  it('el teléfono admite los signos de siempre y rechaza texto', () => {
    expect(guardar({ phone: '(021) 555-100' }).success).toBe(true)
    expect(guardar({ phone: '' }).success).toBe(true)
    expect(error({ phone: 'llamar al local' })).toContain('números')
    expect(error({ phone: '12345' })).toContain('6 números')
  })

  it('el área tiene un largo máximo', () => {
    expect(error({ department: 'x'.repeat(61) })).toContain('60')
  })

  /** Antes, «Vendedorr» se guardaba como «cliente» y la persona perdía el acceso. */
  it('un rol o un estado que no existe se rechaza, no se convierte en cliente', () => {
    expect(error({ role: 'Vendedorr' })).toContain('rol')
    expect(error({ status: 'vacaciones' })).toContain('estado')
    expect(guardar({ role: 'tecnico', status: 'suspended' }).success).toBe(true)
  })

  /** Los nombres viejos siguen llegando desde otras pantallas y no son un error. */
  it('los alias conocidos y «invited» siguen entrando', () => {
    expect(guardar({ role: 'customer' }).success).toBe(true)
    expect(guardar({ role: 'seller' }).success).toBe(true)
    expect(guardar({ status: 'invited' }).success).toBe(true)
  })

  /** Propietario tiene su propio aviso en la API: se cambia por transferencia. */
  it('«owner» pasa la validación para que responda el aviso de transferencia', () => {
    expect(guardar({ role: 'owner' }).success).toBe(true)
    const api = leer('src/app/api/admin/users/route.ts')
    expect(api.indexOf('userEditSchema.safeParse(rawBody)')).toBeLessThan(api.indexOf('OWNER_TRANSFER_REQUIRED'))
  })

  it('no se guarda un permiso inventado', () => {
    expect(KNOWN_PERMISSIONS.has('products.create')).toBe(true)
    expect(error({ permissions: ['products.create', 'borrar.todo'] })).toContain('permiso')
  })

  it('la foto tiene que ser una ruta interna o http(s)', () => {
    expect(guardar({ avatar_url: 'https://cdn/foto.png' }).success).toBe(true)
    expect(guardar({ avatar_url: '/avatars/ana.png' }).success).toBe(true)
    expect(error({ avatar_url: 'javascript:alert(1)' })).toContain('ruta interna')
  })

  it('la API y el formulario usan las mismas reglas', () => {
    const api = leer('src/app/api/admin/users/route.ts')
    expect(api).toContain('userEditSchema.safeParse(rawBody)')
    expect(api).toContain('firstUserEditIssue(parsed.error)')

    const form = leer('src/components/admin/users/EditUserForm.tsx')
    expect(form).toContain("from '@/lib/admin/user-edit-validation'")
    expect(form).toContain('userNameSchema')
    expect(form).toContain('userPhoneSchema')
  })
})
