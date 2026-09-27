import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isOrganizationId, organizationAuditFilter } from './organization-audit'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const ID = '3f2b1a44-1111-4222-8333-444455556666'

describe('auditoría de una organización', () => {
  it('toma lo registrado con su id y los cambios sobre la organización misma', () => {
    expect(organizationAuditFilter(ID)).toBe(
      `organization_id.eq.${ID},and(resource.eq.organizations,resource_id.eq.${ID})`,
    )
  })

  /** El valor queda dentro de la expresión de PostgREST: solo un id. */
  it('rechaza cualquier cosa que no sea un id', () => {
    expect(isOrganizationId('hca-celular')).toBe(false)
    expect(isOrganizationId(`${ID},severity.eq.low`)).toBe(false)
    expect(() => organizationAuditFilter('x),or(id.neq.0')).toThrow()
  })

  it('la auditoría acepta el filtro y la ficha tiene pantalla de carga', () => {
    expect(leer('src/app/superadmin/audit-logs/page.tsx')).toContain('isOrganizationId(params.org)')
    expect(leer('src/app/superadmin/organizations/[id]/page.tsx')).toContain('organizationAuditFilter(String(org.id))')
    expect(leer('src/app/superadmin/organizations/[id]/loading.tsx')).toContain('role="status"')
  })
})
