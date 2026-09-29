import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))

import { normalizeSeverity, parseAuditFilters, toCsv, type AuditEntry } from '@/lib/superadmin/audit-feed'

const ORG = '3f2a1c9e-8b7d-4e6f-9a1b-2c3d4e5f6a7b'

describe('parseAuditFilters', () => {
  it('usa valores seguros por defecto', () => {
    expect(parseAuditFilters({})).toEqual({
      source: 'platform', period: '7d', severity: null, organizationId: null, query: '', includeNoise: false, page: 0,
    })
  })

  it('descarta filtros que la fuente no soporta', () => {
    const f = parseAuditFilters({ source: 'settings', org: ORG, severity: 'high' })
    expect(f.organizationId).toBeNull()
    expect(f.severity).toBe('high')
    expect(parseAuditFilters({ source: 'finance', severity: 'high' }).severity).toBeNull()
  })

  it('no deja que la búsqueda altere la sintaxis de filtros de PostgREST', () => {
    const f = parseAuditFilters({ q: 'login),user_id.eq.(x*,%' })
    expect(f.query).not.toMatch(/[,()*%]/)
  })

  it('ignora ids de organización inválidos y páginas absurdas', () => {
    const f = parseAuditFilters({ org: 'x; drop', page: '-5' })
    expect(f.organizationId).toBeNull()
    expect(f.page).toBe(0)
  })
})

describe('normalizeSeverity', () => {
  it('mapea nombres históricos y reconoce info', () => {
    expect(normalizeSeverity('info')).toBe('info')
    expect(normalizeSeverity('warning')).toBe('medium')
    expect(normalizeSeverity('error')).toBe('high')
    expect(normalizeSeverity('rara')).toBeNull()
  })
})

describe('toCsv', () => {
  it('escapa comillas y neutraliza fórmulas de Excel', () => {
    const entry: AuditEntry = {
      id: '1', source: 'platform', createdAt: '2026-09-27T10:00:00Z', actorId: null, actorEmail: 'a"b@x.com',
      action: '=HYPERLINK("x")', target: null, organizationId: null, organizationName: null, severity: 'info', ipAddress: null,
    }
    const [, line] = toCsv([entry]).split('\n')
    expect(line).toContain('"a""b@x.com"')
    expect(line).toContain(`"'=HYPERLINK(""x"")"`)
  })
})
