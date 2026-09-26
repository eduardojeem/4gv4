import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { normalizeText, primaryModifierLabel } from '@/lib/text/normalize'
import { adminNavCategories } from '@/config/admin-navigation'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const LAYOUT = leer('src/components/admin/layout/AdminLayout.tsx')
const DIALOGO = leer('src/components/ui/global-search.tsx')

/**
 * El buscador comparaba con `includes()` crudo sobre el texto con tildes. En una
 * interfaz donde las secciones se llaman «Configuración» y «Análisis», escribir
 * sin tilde no encontraba nada — y sin tilde es como se escribe en un teclado
 * apurado.
 */
describe('el buscador encuentra lo que uno escribe', () => {
  it('ignora las tildes', () => {
    expect(normalizeText('Configuración')).toBe('configuracion')
    expect(normalizeText('Análisis')).toBe('analisis')
    expect(normalizeText('Reseñas')).toBe('resenas')
  })

  it('tolera espacios y mayúsculas', () => {
    expect(normalizeText('  SITIO Web  ')).toBe('sitio web')
    expect(normalizeText(null)).toBe('')
  })

  /** Reproduce el filtro del encabezado sobre las secciones reales. */
  const buscar = (consulta: string) => {
    const items = adminNavCategories.flatMap((categoria) =>
      categoria.items.map((item) => ({
        label: item.label,
        haystack: normalizeText(
          `${item.label} ${categoria.label}${item.description ? ` - ${item.description}` : ''} ${item.href || ''}`
        ),
      }))
    )
    const terms = normalizeText(consulta).split(/\s+/).filter(Boolean)
    return items.filter((item) => terms.every((t) => item.haystack.includes(t))).map((i) => i.label)
  }

  it('«configuracion» sin tilde encuentra «Configuración»', () => {
    expect(buscar('configuracion')).toContain('Configuración')
  })

  it('«analisis» sin tilde encuentra las secciones de análisis', () => {
    expect(buscar('analisis').length).toBeGreaterThan(0)
  })

  it('busca también por la ruta: quien conoce la URL escribe «inventory»', () => {
    expect(buscar('inventory')).toContain('Inventario')
    expect(buscar('website')).toContain('Sitio Web')
  })

  it('cada palabra por separado, en cualquier orden', () => {
    // «config sitio» tiene que llegar a «Sitio Web · Configuración del sitio
    // web público», que con la frase entera no salía.
    expect(buscar('config sitio')).toContain('Sitio Web')
    expect(buscar('sitio config')).toContain('Sitio Web')
  })

  it('sin coincidencias devuelve vacío, no todo', () => {
    expect(buscar('zzzz-no-existe')).toHaveLength(0)
  })

  it('el layout usa ese mismo criterio', () => {
    expect(LAYOUT).toContain("import { normalizeText, primaryModifierLabel } from '@/lib/text/normalize'")
    expect(LAYOUT).toContain('haystack: normalizeText(')
    expect(LAYOUT).toContain('terms.every(term => item.haystack.includes(term))')
    expect(LAYOUT).not.toContain('item.title.toLowerCase().includes(query)')
  })
})

describe('el atajo dice la tecla del sistema donde corre', () => {
  it('devuelve un modificador conocido', () => {
    expect(['Ctrl', '⌘']).toContain(primaryModifierLabel())
  })

  it('el cartel se calcula, no está escrito a mano', () => {
    // El manejador acepta Ctrl y Cmd; el cartel decía «Ctrl» siempre, así que
    // en una Mac mostraba una tecla y funcionaba la otra.
    expect(LAYOUT).toContain('const [shortcutHint, setShortcutHint] = useState(')
    expect(LAYOUT).toContain('{shortcutHint}')
    expect(LAYOUT).not.toContain('Buscar (Ctrl+K)')
    expect(DIALOGO).not.toContain('Buscar en todo el sistema (Ctrl+K)')
  })

  it('el aviso ya no está duplicado dentro del mismo control', () => {
    // El marcador decía «Buscar (Ctrl+K)» y adentro había otro «Ctrl+K».
    const inicio = LAYOUT.indexOf('aria-haspopup="dialog"')
    const boton = LAYOUT.slice(inicio, LAYOUT.indexOf('</button>', inicio))
    expect(boton).toContain('>Buscar</span>')
    // El único recordatorio del atajo está en el <kbd>, y sale de `shortcutHint`
    // en vez de estar escrito. (El nombre viejo sobrevive en el comentario que
    // explica por qué se sacó; lo que no puede sobrevivir es el texto pintado.)
    expect(boton).toContain('{shortcutHint}')
    expect(boton).not.toContain('>Ctrl+K<')
  })
})

describe('el buscador se puede usar con el teclado', () => {
  it('es un botón y no un input de sólo lectura', () => {
    // Un <input readOnly> con onClick recibe el foco pero no se abre con Enter.
    expect(LAYOUT).not.toContain('readOnly\n                  onClick={() => setSearchOpen(true)}')
    expect(LAYOUT).toContain('aria-haspopup="dialog"')
  })
})

/**
 * El encabezado móvil ocupaba unos 150px fijos de una pantalla de 812, y cuatro
 * de sus componentes ya estaban renderizados más arriba.
 */
describe('el encabezado móvil deja de repetirse', () => {
  it('el selector de organización y el de sucursal aparecen una sola vez cada uno', () => {
    expect(LAYOUT.match(/<OrganizationSwitcher/g) ?? []).toHaveLength(2) // escritorio + móvil
    expect(LAYOUT.match(/<BranchSelector/g) ?? []).toHaveLength(2)
  })

  it('«Inicio» y «Super Admin» ya no están tres veces', () => {
    // Estaban en el botón del encabezado, en la fila móvil y en el menú del
    // avatar. Se saca la copia del medio.
    expect(LAYOUT).not.toContain('<span className="font-medium">Super Admin</span>')
    expect(LAYOUT).not.toContain('Buscar en admin')
  })

  it('el buscador móvil pasa a compartir fila en vez de ocupar una entera', () => {
    expect(LAYOUT).toContain('aria-label="Buscar en el panel"')
    expect(LAYOUT).toContain('className="h-9 w-9 md:hidden"')
  })

  it('en pantalla angosta el encabezado dice dónde estás, no la ruta entera', () => {
    // «Inicio / Admin / Sección» competía con el botón de menú y tres iconos.
    expect(LAYOUT).toContain("{currentItem?.label ?? 'Administración'}")
    expect(LAYOUT).toContain('<div className="hidden min-w-0 flex-1 md:block">')
  })
})
