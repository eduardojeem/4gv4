import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUDIT_EVENTS } from '@/lib/security/audit-events'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/** Cada insert a `audit_log` del proyecto, con el texto que lo rodea. */
function inserts(): { ruta: string; linea: number; cuerpo: string }[] {
  const encontrados: { ruta: string; linea: number; cuerpo: string }[] = []

  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })) {
      const ruta = join(dir, entrada.name)
      if (entrada.isDirectory()) { recorrer(ruta); continue }
      if (!entrada.name.endsWith('.ts')) continue

      const lineas = readFileSync(resolve(process.cwd(), ruta), 'utf8').split('\n')
      lineas.forEach((linea, i) => {
        if (!linea.includes("from('audit_log').insert")) return
        encontrados.push({ ruta, linea: i + 1, cuerpo: lineas.slice(i, i + 18).join('\n') })
      })
    }
  }

  recorrer('src/app/api')
  recorrer('src/lib')
  return encontrados
}

/**
 * La pantalla /admin/security filtra por `organization_id` en SQL, que descarta
 * los nulos. Un evento escrito sin esa columna queda guardado y es invisible en
 * el panel de cualquier tienda — pasaba con seis de los quince escritores,
 * incluidos cambios de rol y de ajustes del sistema.
 */
describe('cobertura del registro de auditoría', () => {
  const todos = inserts()

  it('encuentra los escritores', () => {
    expect(todos.length).toBeGreaterThanOrEqual(13)
  })

  it('cada insert decide explícitamente sobre la organización', () => {
    // O la escribe, o deja constancia de por qué no corresponde. Lo que no puede
    // es omitirla en silencio, que es como quedaron invisibles.
    const sinDecidir = todos
      .filter(({ cuerpo }) => !cuerpo.includes('organization_id')
        && !/Sin organizacion a proposito/.test(cuerpo))
      .map(({ ruta, linea }) => `${ruta}:${linea}`)

    expect(sinDecidir).toEqual([])
  })

  it('los eventos que sí tienen tienda la escriben en su columna', () => {
    for (const objetivo of [
      'src/app/api/admin/users/import/route.ts',
      'src/app/api/admin/users/sync/route.ts',
      'src/app/api/admin/system/settings/route.ts',
      'src/app/api/auth/sync-role/route.ts',
    ]) {
      const insert = todos.find(({ ruta }) => ruta.replace(/\\/g, '/') === objetivo)
      expect(insert, objetivo).toBeDefined()
      expect(insert!.cuerpo, objetivo).toMatch(/organization_id: (context\.organizationId|organizationId)/)
    }
  })

  it('cada acción que se escribe está en el catálogo', () => {
    // Una acción fuera del catálogo se muestra con su nombre crudo y el filtro
    // por gravedad no la alcanza.
    const acciones = todos
      .flatMap(({ cuerpo }) => [...cuerpo.matchAll(/action: '([a-z_]+)'/g)].map((m) => m[1]))
    const fuera = [...new Set(acciones)].filter((a) => !(a in AUDIT_EVENTS))

    expect(fuera, `sin catalogar: ${fuera.join(', ')}`).toEqual([])
  })

  it('el evento de cambio de rol por correo escribe la columna que se lee', () => {
    // Escribía `resource_type`, que existe pero no es la que muestra la
    // pantalla: el evento salía como «unknown».
    const ruta = leer('src/app/api/admin/set-role-by-email/route.ts')
    const bloque = ruta.slice(ruta.indexOf("action: 'assign_role_by_email'"))
    expect(bloque.slice(0, 600)).toContain("resource: 'user'")
    expect(bloque.slice(0, 600)).not.toContain('resource_type:')
  })
})

describe('la exportación entrega el rango, no la página', () => {
  const panel = leer('src/components/admin/system/security-panel.tsx')
  const api = leer('src/app/api/admin/security/logs/route.ts')

  it('pide el rango filtrado al servidor', () => {
    expect(panel).toContain("mode: 'export'")
    expect(panel).not.toMatch(/\.\.\.logs\.map\(\(log\) => \[/)
    expect(panel).toContain('exportables.map')
  })

  it('la API levanta el tope solo para exportar', () => {
    expect(api).toContain('EXPORT_MAX_ROWS')
    expect(api).toMatch(/const maxPageSize = isExport \? EXPORT_MAX_ROWS : 100/)
  })

  it('avisa cuando el archivo quedó recortado', () => {
    // Un recorte silencioso es peor que no exportar: quien lo guarda como
    // evidencia cree que está completo.
    expect(api).toContain('truncated: isExport && totalCount > logs.length')
    expect(panel).toContain('recortado')
    expect(panel).toMatch(/Se exportaron \$\{exportables\.length\} de \$\{totalCount\}/)
  })

  it('no exporta una página cuando falla traer el rango', () => {
    const bloque = panel.slice(panel.indexOf('async function exportCsv'))
    expect(bloque.slice(0, 2000)).toContain('No se pudo exportar')
  })
})

describe('el CSV no ejecuta fórmulas', () => {
  const panel = leer('src/components/admin/system/security-panel.tsx')

  it('neutraliza la celda que empieza con un carácter de fórmula', () => {
    // El nombre del perfil llega a la columna Usuario y el registro no le pone
    // restricciones de formato: uno que empiece con `=` corre al abrir el
    // archivo en Excel o Sheets.
    expect(panel).toMatch(/\/\^\[=\+\\-@\\t\\r\]\//)
    expect(panel).toContain('.test(texto)')
  })

  it('sigue entrecomillando como corresponde al formato', () => {
    expect(panel).toContain(`replace(/"/g, '""')`)
  })
})
