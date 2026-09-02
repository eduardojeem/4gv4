import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const MIGRACION = 'supabase/migrations/20260902120000_cash_monitor_tenant_isolation.sql'
const HOOK = 'src/app/admin/cash-monitor/hooks/useCashMonitor.ts'

describe('aislamiento por tienda en el monitor de caja', () => {
  const sql = leer(MIGRACION)

  it('las tres tablas tienen columna de organización', () => {
    // Su único vínculo con una tienda era la sesión de caja, y la auditoría la
    // pierde al borrarse la sesión (ON DELETE SET NULL): justo el registro que
    // hay que conservar quedaría sin tienda asignable.
    for (const tabla of ['cash_alerts', 'cash_admin_audit', 'cash_register_config']) {
      expect(sql, tabla).toMatch(
        new RegExp(`alter table public\\.${tabla}\\s+add column if not exists organization_id`)
      )
    }
  })

  it('ninguna política nueva concede acceso por rol solo', () => {
    // La condición completa de las seis políticas anteriores era "que sea admin",
    // sin mirar de qué tienda.
    const politicas = sql.split('create policy').slice(1)
    expect(politicas.length).toBeGreaterThanOrEqual(6)
    for (const p of politicas) {
      const cuerpo = p.slice(0, p.indexOf(';'))
      expect(cuerpo, cuerpo.split('\n')[0]).toContain('has_org_permission(organization_id')
      expect(cuerpo).not.toMatch(/role in \(/i)
    }
  })

  it('deja sin efecto las seis políticas viejas', () => {
    for (const vieja of [
      'Admin can read cash_alerts',
      'Admin can manage cash_alerts',
      'Admin can read cash_admin_audit',
      'Admin can manage cash_admin_audit',
      'Admin can read cash_register_config',
      'Admin can manage cash_register_config',
    ]) {
      expect(sql, vieja).toContain(`drop policy if exists "${vieja}"`)
    }
  })

  it('no deja borrar la auditoría desde el cliente', () => {
    // Antes cualquier admin podía borrar la de otra tienda; ahora la tabla solo
    // admite leer y agregar.
    const audit = sql.split('cash_admin_audit for').slice(1).map((p) => p.trim().split(/\s/)[0])
    expect(audit.sort()).toEqual(['insert', 'select'])
  })

  it('el generador de alertas asigna tienda y sucursal', () => {
    // Sin esto cada alerta nueva nacería sin organización y, con las políticas
    // nuevas, invisible para todos: el arreglo dejaría la pantalla vacía.
    const fn = sql.slice(sql.indexOf('check_long_open_sessions'))
    expect(fn).toContain('organization_id, branch_id')
    expect(fn).toContain('session_record.organization_id')
    expect(fn).toContain('session_record.branch_id')
  })

  it('la configuración de caja deja de ser única a nivel plataforma', () => {
    // `register_id` vale 'principal' por defecto: con un unique global, la
    // primera tienda que guardaba configuración se quedaba con ese nombre.
    expect(sql).toContain('drop constraint if exists cash_register_config_register_id_key')
    expect(sql).toMatch(/create unique index[^;]+\(organization_id, register_id\)/)
  })
})

describe('tiempo real del monitor de caja', () => {
  const hook = leer(HOOK)

  it('cada suscripción se acota a la organización', () => {
    // La consulta inicial filtraba por tienda, sucursal y sesión; el camino de
    // tiempo real, veinte líneas más abajo, no filtraba nada.
    const bloques = hook.split("'postgres_changes'").slice(1)
    expect(bloques.length).toBe(3)
    for (const b of bloques) {
      expect(b.slice(0, 260)).toContain('filter:')
    }
  })

  it('descarta las alertas de otra sucursal', () => {
    expect(hook).toMatch(/newAlert\.branch_id !== selectedBranchId/)
  })

  it('no duplica una alerta que ya está en la lista', () => {
    expect(hook).toMatch(/prev\.some\(a => a\.id === newAlert\.id\)/)
  })

  it('el canal no se comparte entre tiendas', () => {
    expect(hook).toMatch(/channel\(`cash-admin-monitor:\$\{organization\.id\}`\)/)
  })

  it('alertas y auditoría filtran por la columna, no por una lista de sesiones', () => {
    // El paso previo traía hasta 500 cierres y pasaba sus ids: las alertas de
    // sesiones más viejas que ese corte desaparecían de la lista sin aviso.
    // (La consulta de movimientos sí usa una lista de ids, pero sobre sesiones
    // que ya vienen acotadas a la tienda: ahí no es la frontera.)
    for (const tabla of ['cash_alerts', 'cash_admin_audit']) {
      const i = hook.indexOf(`from('${tabla}')`)
      expect(i, tabla).toBeGreaterThan(-1)
      expect(hook.slice(i, i + 260), tabla).toContain("eq('organization_id'")
    }
    expect(hook).not.toContain('tenantSessions')
  })
})

describe('escritura de roles', () => {
  it('todo upsert sobre user_roles declara el conflicto', () => {
    // La tabla tiene la primaria en `id` y un UNIQUE sobre `user_id`. Sin
    // declararlo, el upsert genera un id nuevo y choca contra ese único: fallaba
    // para cualquier usuario que ya tuviera rol, o sea para casi todos.
    const pendientes: string[] = []

    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })) {
        const ruta = join(dir, entrada.name)
        if (entrada.isDirectory()) recorrer(ruta)
        else if (entrada.name.endsWith('.ts')) {
          const lineas = readFileSync(resolve(process.cwd(), ruta), 'utf8').split('\n')
          lineas.forEach((linea, i) => {
            if (!linea.includes("from('user_roles')")) return
            const trozo = lineas.slice(Math.max(0, i - 2), i + 12).join('\n')
            if (trozo.includes('.upsert(') && !trozo.includes("onConflict: 'user_id'")) {
              pendientes.push(`${ruta}:${i + 1}`)
            }
          })
        }
      }
    }
    recorrer('src/app/api')

    expect(pendientes).toEqual([])
  })
})
