import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, THEME_TRANSITION_MS, useTheme } from '@/contexts/theme-context'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * Cambiar de modo se sentía como si la pantalla se colgara: la transición de
 * color vivía fija en el <body> y aplicaba a *todos* los elementos, así que
 * cada cambio de tema los animaba a la vez. Medido en el catálogo de una
 * tienda: 123-186 ms de bloqueo con la regla puesta, 32-47 ms sin ella.
 */

function Interruptor() {
  const { setTheme, isDark } = useTheme()
  return (
    <button onClick={() => setTheme(isDark ? 'light' : 'dark')}>cambiar</button>
  )
}

describe('la transición dura lo que dura el cambio', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.classList.remove('theme-transition')
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('al montar no deja ninguna transición puesta', () => {
    render(<ThemeProvider><Interruptor /></ThemeProvider>)
    expect(document.body.classList.contains('theme-transition')).toBe(false)
  })

  it('la pone al cambiar de modo y la saca al terminar', () => {
    const { getByText } = render(<ThemeProvider><Interruptor /></ThemeProvider>)

    act(() => { getByText('cambiar').click() })
    expect(document.body.classList.contains('theme-transition')).toBe(true)

    act(() => { vi.advanceTimersByTime(THEME_TRANSITION_MS + 20) })
    expect(document.body.classList.contains('theme-transition')).toBe(false)
  })

  it('cambiar de color de marca no dispara la transición de modo', () => {
    function CambiaEsquema() {
      const { setColorScheme } = useTheme()
      return <button onClick={() => setColorScheme('green')}>esquema</button>
    }
    const { getByText } = render(<ThemeProvider><CambiaEsquema /></ThemeProvider>)

    act(() => { getByText('esquema').click() })
    expect(document.body.classList.contains('theme-transition')).toBe(false)
  })
})

describe('la regla de transición', () => {
  const CSS = leer('src/app/globals.css')
  const regla = CSS.slice(CSS.indexOf('.theme-transition,'), CSS.indexOf('.theme-transition,') + 400)

  it('el <body> ya no la lleva puesta de entrada', () => {
    expect(leer('src/app/layout.tsx')).not.toContain('antialiased theme-transition')
  })

  /** `border-color` es lo que más repinta y lo que menos se nota. */
  it('anima solo fondo y texto', () => {
    expect(regla).toContain('background-color 0.25s ease')
    expect(regla).toContain('color 0.25s ease')
    expect(regla).not.toContain('border-color')
  })

  /** Con `!important` anulaba las transiciones propias de cada componente. */
  it('no pisa las transiciones de los componentes', () => {
    expect(regla).not.toContain('!important')
  })

  it('respeta a quien pidió menos movimiento', () => {
    const conMedia = CSS.slice(CSS.indexOf('.theme-transition,'))
    expect(conMedia).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.theme-transition,/)
  })

  /** El personalizador la agregaba y no la sacaba nunca. */
  it('el personalizador de tema también la retira', () => {
    const ui = leer('src/components/admin/system/ui-customization.tsx')
    expect(ui).toContain("root.classList.remove('theme-transition')")
  })
})
