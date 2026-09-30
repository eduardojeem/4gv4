import { describe, expect, it } from 'vitest'
import type { CatalogPolicy, CatalogTable } from '@/lib/health/catalog'
import { analyzeTable, analyzeViews, classifyExpression, splitTopLevelOr } from '@/lib/health/tenant-isolation'

function policy(overrides: Partial<CatalogPolicy>): CatalogPolicy {
  return {
    name: 'p',
    command: 'SELECT',
    permissive: true,
    roles: ['authenticated'],
    using: null,
    with_check: null,
    ...overrides,
  }
}

function table(overrides: Partial<CatalogTable>): CatalogTable {
  return {
    name: 'products',
    rls_enabled: true,
    rls_forced: false,
    has_organization_id: true,
    has_branch_id: false,
    estimated_rows: 10,
    anon_select: false,
    authenticated_select: true,
    policies: [],
    ...overrides,
  }
}

// Expresiones tal como las devuelve pg_policies (tomadas del baseline).
const AUTHENTICATED_ONLY = "(( SELECT ( SELECT auth.role() AS role) AS role) = 'authenticated'::text)"
const GLOBAL_ROLES = '(is_manager() OR is_admin() OR is_technician())'
const ORG_SCOPED = "has_org_permission(organization_id, 'products.read'::text)"

describe('splitTopLevelOr', () => {
  it('separa solo los OR de primer nivel', () => {
    expect(splitTopLevelOr('((a = 1) OR (b = 2 OR c = 3))')).toEqual(['a = 1', 'b = 2 OR c = 3'])
  })

  it('ignora OR dentro de literales', () => {
    expect(splitTopLevelOr("(status = 'A OR B'::text)")).toEqual(["status = 'A OR B'::text"])
  })
})

describe('classifyExpression', () => {
  it('detecta la política sin filtro que causó la fuga de 20260927140000', () => {
    expect(classifyExpression(AUTHENTICATED_ONLY)).toEqual(['unfiltered'])
  })

  it('distingue roles globales de filtros por organización', () => {
    expect(classifyExpression(GLOBAL_ROLES)).toEqual(['global_role', 'global_role', 'global_role'])
    expect(classifyExpression(ORG_SCOPED)).toEqual(['scoped'])
  })

  it('una rama propia del usuario no salva a una rama global en el mismo OR', () => {
    const kinds = classifyExpression('((author_id = ( SELECT auth.uid() AS uid)) OR is_manager() OR is_admin())')
    expect(kinds).toContain('scoped')
    expect(kinds).toContain('global_role')
  })

  it('trata auth.role() = service_role como restringida', () => {
    expect(classifyExpression("(( SELECT auth.role() AS role) = 'service_role'::text)")).toEqual(['restricted'])
  })

  it('USING vacío equivale a sin filtro', () => {
    expect(classifyExpression(null)).toEqual(['unfiltered'])
    expect(classifyExpression('true')).toEqual(['unfiltered'])
  })
})

describe('analyzeTable', () => {
  it('marca CRITICAL una política permissive sin filtro en tabla con organization_id', () => {
    const finding = analyzeTable(table({
      name: 'cash_closures',
      policies: [policy({ name: 'org', using: ORG_SCOPED }), policy({ name: 'leak', using: AUTHENTICATED_ONLY })],
    }))
    expect(finding.status).toBe('error')
    expect(finding.severity).toBe('critical')
    expect(finding.reasons[0]).toContain('"leak"')
  })

  it('marca CRITICAL políticas filtradas solo por rol global en tablas con organization_id', () => {
    const finding = analyzeTable(table({
      name: 'audit_log',
      policies: [policy({ name: 'audit_log_select_admin', using: 'is_admin()' })],
    }))
    expect(finding.severity).toBe('critical')
  })

  it('sin organization_id la misma política es HIGH y lo explica', () => {
    const finding = analyzeTable(table({
      name: 'repair_parts',
      has_organization_id: false,
      policies: [policy({ name: 'repair_parts_select_unified', using: GLOBAL_ROLES })],
    }))
    expect(finding.severity).toBe('high')
    expect(finding.reasons[0]).toContain('no tiene organization_id')
  })

  it('la lectura pública intencional de organization_slug_aliases no es un hallazgo aunque tenga organization_id', () => {
    const finding = analyzeTable(table({
      name: 'organization_slug_aliases',
      policies: [policy({ roles: ['anon', 'authenticated'], using: 'true' })],
    }))
    expect(finding.status).toBe('healthy')
  })

  it('has_permission() de productos no salva a la política aunque haya una rama EXISTS', () => {
    const finding = analyzeTable(table({
      name: 'products',
      policies: [policy({
        name: 'products_delete_policy',
        command: 'DELETE',
        using: "(has_permission('products.delete'::text) OR (EXISTS ( SELECT 1 FROM organization_members om WHERE om.user_id = auth.uid())))",
      })],
    }))
    expect(finding.severity).toBe('critical')
  })

  it('EXISTS sobre user_roles/profiles.role es rol global; get_jwt_role() = super_admin es restringido', () => {
    expect(classifyExpression(
      "(EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))",
    )).toEqual(['global_role'])
    expect(classifyExpression("(EXISTS ( SELECT 1 FROM public.user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text))))")).toEqual(['global_role'])
    expect(classifyExpression("(public.get_jwt_role() = 'super_admin'::text)")).toEqual(['restricted'])
    expect(classifyExpression("((is_manager() OR is_admin()) AND (changed_by = auth.uid()))")).toEqual(['global_role'])
  })

  it('comparar con el email del JWT da acceso solo a filas propias', () => {
    expect(classifyExpression(
      "(lower(email) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))",
    )).toEqual(['scoped'])
  })

  it('get_my_role() cuenta como rol global', () => {
    expect(classifyExpression("(get_my_role() = 'admin'::text)")).toEqual(['global_role'])
  })

  it('acepta tablas con todas las políticas acotadas', () => {
    const finding = analyzeTable(table({ policies: [policy({ using: ORG_SCOPED })] }))
    expect(finding.status).toBe('healthy')
  })

  it('RLS desactivado con grant de SELECT es CRITICAL en tablas de tenant', () => {
    const finding = analyzeTable(table({ rls_enabled: false, anon_select: true }))
    expect(finding.severity).toBe('critical')
  })

  it('RLS sin políticas es sano (solo service_role)', () => {
    expect(analyzeTable(table({ policies: [] })).status).toBe('healthy')
  })

  it('lectura pública por condición en tabla de tenant es advertencia, no crítico', () => {
    const finding = analyzeTable(table({
      name: 'promotions',
      policies: [policy({ roles: ['anon', 'authenticated'], using: "(is_active = true)" })],
    }))
    expect(finding.status).toBe('warning')
    expect(finding.severity).toBe('medium')
  })

  it('las reseñas publicadas son lectura pública intencional', () => {
    const finding = analyzeTable(table({
      name: 'organization_reviews',
      policies: [policy({ roles: ['anon', 'authenticated'], using: "(moderation_status = 'published'::text)" })],
    }))
    expect(finding.status).toBe('healthy')
  })

  it('una política RESTRICTIVE por organización acota a la permissive', () => {
    const finding = analyzeTable(table({
      policies: [
        policy({ name: 'wide', using: AUTHENTICATED_ONLY }),
        policy({ name: 'org_guard', permissive: false, using: ORG_SCOPED }),
      ],
    }))
    expect(finding.status).toBe('healthy')
    expect(finding.severity).toBe('info')
  })

  it('una RESTRICTIVE authenticated acota una permissive public que exige usuario autenticado', () => {
    const finding = analyzeTable(table({
      name: 'cash_registers',
      policies: [
        policy({
          name: 'legacy_staff_write',
          command: 'UPDATE',
          roles: ['public'],
          using: "(EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid()))",
          with_check: "(EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid()))",
        }),
        policy({
          name: 'branch_guard',
          command: 'ALL',
          roles: ['authenticated'],
          permissive: false,
          using: 'public.user_has_branch_access(branch_id)',
          with_check: 'public.user_has_branch_access(branch_id)',
        }),
      ],
    }))
    expect(finding.status).toBe('healthy')
  })

  it('una RESTRICTIVE anon y authenticated acota una lectura permissive public', () => {
    const finding = analyzeTable(table({
      name: 'website_settings',
      policies: [
        policy({ name: 'public_read', roles: ['public'], using: 'true' }),
        policy({
          name: 'publication_gate',
          roles: ['anon', 'authenticated'],
          permissive: false,
          using: "has_org_permission(organization_id, 'settings.read') OR EXISTS (SELECT 1 FROM organizations WHERE id = organization_id)",
        }),
      ],
    }))
    expect(finding.status).toBe('healthy')
  })

  it('reconoce los catalogos y gastos de plataforma como tablas globales', () => {
    for (const name of ['global_device_models', 'platform_expenses']) {
      const finding = analyzeTable(table({
        name,
        has_organization_id: false,
        policies: [policy({ roles: ['authenticated'], using: "get_jwt_role() = 'super_admin'::text" })],
      }))
      expect(finding.status).toBe('healthy')
    }
  })

  it('no considera guard una RESTRICTIVE de otro rol', () => {
    const finding = analyzeTable(table({
      policies: [
        policy({ name: 'wide', roles: ['authenticated'], using: AUTHENTICATED_ONLY }),
        policy({ name: 'anon_guard', roles: ['anon'], permissive: false, using: ORG_SCOPED }),
      ],
    }))
    expect(finding.status).toBe('error')
    expect(finding.severity).toBe('critical')
  })

  it('no considera guard una RESTRICTIVE que cubre sólo parte de los roles clientes', () => {
    const finding = analyzeTable(table({
      policies: [
        policy({ name: 'wide', roles: ['anon', 'authenticated'], using: AUTHENTICATED_ONLY }),
        policy({ name: 'auth_guard', roles: ['authenticated'], permissive: false, using: ORG_SCOPED }),
      ],
    }))
    expect(finding.status).toBe('error')
    expect(finding.severity).toBe('critical')
  })

  it('no considera guard una RESTRICTIVE de otro comando', () => {
    const finding = analyzeTable(table({
      policies: [
        policy({ name: 'wide_read', command: 'SELECT', using: AUTHENTICATED_ONLY }),
        policy({ name: 'insert_guard', command: 'INSERT', permissive: false, with_check: ORG_SCOPED }),
      ],
    }))
    expect(finding.status).toBe('error')
    expect(finding.severity).toBe('critical')
  })

  it('ignora políticas que solo aplican a service_role', () => {
    const finding = analyzeTable(table({
      name: 'audit_log',
      policies: [policy({ roles: ['service_role'], command: 'ALL', using: 'true', with_check: 'true' })],
    }))
    expect(finding.status).toBe('healthy')
  })

  it('no exige organization_id a una tabla interna accesible solo por service_role', () => {
    const finding = analyzeTable(table({
      name: 'product_alerts_archive',
      has_organization_id: false,
      policies: [policy({ roles: ['service_role'], command: 'ALL', using: 'true', with_check: 'true' })],
    }))
    expect(finding.status).toBe('healthy')
  })

  it('en tablas globales la lectura sin filtro es válida pero la escritura no', () => {
    expect(analyzeTable(table({
      name: 'subscription_plans',
      has_organization_id: false,
      policies: [policy({ roles: ['public'], using: 'true' })],
    })).status).toBe('healthy')

    expect(analyzeTable(table({
      name: 'subscription_plans',
      has_organization_id: false,
      policies: [policy({ command: 'INSERT', roles: ['public'], with_check: 'true' })],
    })).severity).toBe('high')
  })
})

describe('analyzeViews', () => {
  it('reporta vistas sin security_invoker expuestas a clientes', () => {
    const findings = analyzeViews([
      { name: 'products_full', kind: 'view', security_invoker: false, has_organization_id: true, anon_select: false, authenticated_select: true },
      { name: 'safe_view', kind: 'view', security_invoker: true, has_organization_id: true, anon_select: true, authenticated_select: true },
    ])
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ view: 'products_full', severity: 'high' })
  })
})
