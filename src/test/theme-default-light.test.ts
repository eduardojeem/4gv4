import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const SCRIPT = leer('src/components/util/ThemeInitScript.tsx')
const CONTEXTO = leer('src/contexts/theme-context.tsx')

/**
 * El tema por defecto era 'system': quien nunca eligió abría en oscuro si su
 * sistema operativo estaba en oscuro. Ahora abre en claro, y solo se va a
 * oscuro con una decisión explícita.
 */
describe('el modo por defecto es claro', () => {
  it('el proveedor arranca en claro', () => {
    expect(CONTEXTO).toContain("defaultTheme = 'light'")
    expect(CONTEXTO).not.toContain("defaultTheme = 'system'")
  })

  it('el script anti-parpadeo decide igual', () => {
    // Si uno pone claro y el otro oscuro se ve justo el parpadeo que el script
    // existe para evitar.
    expect(SCRIPT).toContain("var dark = theme === 'dark' || (theme === 'system' && systemPrefersDark);")
  })

  it('ya no se va a oscuro por el sistema sin haber elegido', () => {
    expect(SCRIPT).not.toContain('!theme && systemPrefersDark')
  })
})

describe('lo que la persona ya eligió se respeta', () => {
  it("'dark' guardado sigue mandando", () => {
    expect(SCRIPT).toContain("theme === 'dark'")
  })

  it("'system' sigue al sistema operativo", () => {
    // Elegir «seguir al sistema» es una decisión: no se pisa con claro.
    expect(SCRIPT).toContain("theme === 'system' && systemPrefersDark")
    expect(CONTEXTO).toContain("theme === 'dark' || (theme === 'system' && systemPrefersDark)")
  })

  it('el script también lee la clave vieja del panel admin', () => {
    // El proveedor ya la respetaba y el script no: alguien con solo esa clave
    // veía claro del script y oscuro del proveedor, o sea el parpadeo.
    expect(SCRIPT).toContain("localStorage.getItem('admin-dark-mode')")
    expect(CONTEXTO).toContain("localStorage.getItem('admin-dark-mode')")
  })

  it('si el almacenamiento falla, queda claro', () => {
    // En una ventana privada `localStorage` puede lanzar. Antes el catch no
    // ponía ninguna clase y la página quedaba sin tema resuelto.
    const captura = SCRIPT.slice(SCRIPT.indexOf('} catch (e) {'))
    expect(captura.slice(0, 120)).toContain("classList.add('light')")
  })
})
