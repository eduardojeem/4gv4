import { describe, expect, it } from 'vitest'

import { deriveAccessFromSnapshot } from './middleware-access'

describe('deriveAccessFromSnapshot', () => {
  it('usa el rol de plataforma cuando existe', () => {
    const access = deriveAccessFromSnapshot({
      platformRole: 'admin',
      platformRoleActive: true,
      profileRole: 'cliente',
      profileStatus: 'active',
    })

    expect(access.normalizedRole).toBe('admin')
    expect(access.roleIsActive).toBe(true)
    expect(access.profileIsActive).toBe(true)
  })

  it('un perfil desactualizado NO puede devolver superadmin revocado', () => {
    // Es la garantia de seguridad del camino largo: si se revoco en user_roles,
    // un profiles.role viejo no debe reinstalar el acceso de plataforma.
    const access = deriveAccessFromSnapshot({
      platformRole: null,
      profileRole: 'super_admin',
      profileStatus: 'active',
    })

    expect(access.normalizedRole).not.toBe('super_admin')
  })

  it('hereda del perfil cualquier otro rol cuando la plataforma no define uno', () => {
    const access = deriveAccessFromSnapshot({
      platformRole: null,
      profileRole: 'admin',
      profileStatus: 'active',
    })

    expect(access.normalizedRole).toBe('admin')
  })

  it('marca inactivo al usuario con el rol de plataforma desactivado', () => {
    const access = deriveAccessFromSnapshot({
      platformRole: 'admin',
      platformRoleActive: false,
      profileStatus: 'active',
    })

    expect(access.roleIsActive).toBe(false)
  })

  it('marca inactivo al perfil suspendido', () => {
    const access = deriveAccessFromSnapshot({
      platformRole: 'admin',
      platformRoleActive: true,
      profileStatus: 'suspended',
    })

    expect(access.profileIsActive).toBe(false)
  })

  it('asume activo cuando el estado no viene', () => {
    // `is_active` y `status` no existen en todos los despliegues: ausente no
    // puede significar "bloqueado", o se dejaria a todos afuera.
    const access = deriveAccessFromSnapshot({ platformRole: 'admin' })

    expect(access.roleIsActive).toBe(true)
    expect(access.profileIsActive).toBe(true)
  })

  it('expone el rol de organizacion para no repetir la consulta', () => {
    const access = deriveAccessFromSnapshot({
      platformRole: 'cliente',
      profileRole: 'cliente',
      profileStatus: 'active',
      organizationRole: 'owner',
    })

    expect(access.organizationRole).toBe('owner')
  })

  it('sin membresia deja el rol de organizacion indefinido', () => {
    const access = deriveAccessFromSnapshot({
      platformRole: 'cliente',
      organizationRole: null,
    })

    expect(access.organizationRole).toBeUndefined()
  })
})
