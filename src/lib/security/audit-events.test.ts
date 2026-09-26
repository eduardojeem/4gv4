import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUDIT_EVENTS,
  actionsWithSeverity,
  describeAuditEvent,
  severityColumnValues,
} from './audit-events'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

describe('catálogo de eventos', () => {
  it('describe un evento conocido con su gravedad', () => {
    expect(describeAuditEvent('unauthorized_admin_access_attempt')).toEqual({
      event: 'Intento de acceso admin no autorizado',
      severity: 'high',
    })
  })

  it('no inventa gravedad para una acción desconocida', () => {
    const r = describeAuditEvent('accion_que_no_existe')
    expect(r.severity).toBe('low')
    expect(r.event).toContain('accion_que_no_existe')
  })

  it('agrupa las acciones por gravedad', () => {
    const altas = actionsWithSeverity('high')
    expect(altas).toContain('role_change')
    expect(altas).toContain('unauthorized_admin_access_attempt')
    expect(altas).not.toContain('login')
  })

  it('trata "info" como sinónimo histórico de baja', () => {
    // Quedó en filas viejas; sin esto el filtro de baja las perdería.
    expect(severityColumnValues('low')).toEqual(['low', 'info'])
    expect(severityColumnValues('critical')).toEqual(['critical'])
  })
})

describe('el filtro de gravedad alcanza las filas sin columna', () => {
  const ruta = leer('src/app/api/admin/security/logs/route.ts')

  it('busca por columna y también por acción', () => {
    // Solo el registro de superadmin escribe `severity`: filtrando únicamente
    // por la columna, el resultado era siempre vacío.
    expect(ruta).toContain('severityFilterExpression')
    expect(ruta).toMatch(/severity\.in\.\(\$\{columnValues\}\)/)
    expect(ruta).toContain('and(severity.is.null,action.in.(')
  })

  it('ya no filtra solo por la columna', () => {
    expect(ruta).not.toContain("nextQuery.in('severity'")
  })

  it('usa el catálogo compartido en vez de una copia local', () => {
    expect(ruta).toContain("from '@/lib/security/audit-events'")
    expect(ruta).not.toContain('const EVENT_MAP')
  })
})

describe('el intento de acceso no autorizado queda atribuido', () => {
  const wrapper = leer('src/lib/api/withAdminAuth.ts')

  it('resuelve la organización antes de registrarlo', () => {
    // Se escribía veinticinco líneas por encima de donde se resolvía, así que
    // salía sin organización y la pantalla lo filtraba en SQL.
    const resolucion = wrapper.indexOf('const attemptOrganizationId = await resolveUserOrganizationId')
    const insercion = wrapper.indexOf("action: 'unauthorized_admin_access_attempt'")
    expect(resolucion, 'no se resuelve la organización').toBeGreaterThan(-1)
    expect(resolucion, 'debe resolverse antes de insertar').toBeLessThan(insercion)
  })

  it('guarda la organización y la gravedad', () => {
    const bloque = wrapper.slice(wrapper.indexOf("action: 'unauthorized_admin_access_attempt'"))
    expect(bloque.slice(0, 500)).toContain('organization_id: attemptOrganizationId')
    expect(bloque.slice(0, 500)).toContain("severity: 'high'")
  })

  it('el acceso administrativo también guarda su gravedad', () => {
    const bloque = wrapper.slice(wrapper.indexOf("action: 'admin_api_access'"))
    expect(bloque.slice(0, 500)).toContain("severity: 'low'")
  })

  it('la resolución de organización vive en un solo lugar', () => {
    // Estaba duplicada dentro del propio wrapper —la copia de abajo es la que
    // hacía notar que la de arriba faltaba— y ahora es compartida, porque el
    // registro de auditoría también la necesita fuera de este envoltorio.
    expect(wrapper).toContain("resolveUserOrganizationId } from '@/lib/saas/context'")
    expect(wrapper).not.toContain('async function resolveUserOrganizationId')
    expect(wrapper).not.toContain('getCurrentOrganizationContext(')
  })
})

describe('la migración y el catálogo no se separan', () => {
  const sql = leer('supabase/migrations/20260903120000_backfill_audit_log_severity.sql')

  it('asigna a cada acción la misma gravedad que el código', () => {
    // El mapa está escrito dos veces —en TypeScript y en SQL— porque el backfill
    // corre en la base. Esta prueba es lo que impide que discrepen.
    for (const [action, definition] of Object.entries(AUDIT_EVENTS)) {
      const linea = new RegExp(`when '${action}'\\s+then '${definition.severity}'`)
      expect(sql, `${action} → ${definition.severity}`).toMatch(linea)
    }
  })

  it('no completa acciones que no están en el catálogo', () => {
    // Inventarles una gravedad las escondería bajo una etiqueta que nadie
    // decidió, y el filtro por acción tampoco las encontraría.
    expect(sql).toContain('else null')
    for (const action of Object.keys(AUDIT_EVENTS)) {
      expect(sql, `${action} debe estar en el where`).toContain(`'${action}'`)
    }
  })

  it('solo toca filas sin gravedad', () => {
    expect(sql).toContain('where severity is null')
  })
})
