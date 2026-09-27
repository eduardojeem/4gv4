/**
 * En el encabezado el buscador va chico para no comerse la fila, y al escribir
 * quedaba apretado. Ahora avisa cuando toma el foco para que el encabezado le
 * haga lugar: esconde los enlaces y el CTA, y deja crecer el campo.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarketplaceSearchBox } from '../MarketplaceSearchBox'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('el buscador avisa cuando lo estan usando', () => {
  it('avisa al tomar y al soltar el foco', () => {
    const onFocusChange = vi.fn()
    render(<MarketplaceSearchBox compact onFocusChange={onFocusChange} />)

    const input = screen.getByRole('searchbox')
    fireEvent.focus(input)
    expect(onFocusChange).toHaveBeenLastCalledWith(true)

    fireEvent.blur(input, { relatedTarget: document.body })
    expect(onFocusChange).toHaveBeenLastCalledWith(false)
  })

  it('no se colapsa cuando el foco pasa a un boton del propio formulario', () => {
    // El boton de limpiar esta dentro del formulario: si el encabezado colapsara
    // ahi, el boton desapareceria justo antes del clic.
    const onFocusChange = vi.fn()
    render(<MarketplaceSearchBox compact initialQuery="teclado" onFocusChange={onFocusChange} />)

    const input = screen.getByRole('searchbox')
    fireEvent.focus(input)

    const limpiar = screen.getByLabelText('Limpiar busqueda')
    fireEvent.blur(input, { relatedTarget: limpiar })

    expect(onFocusChange).toHaveBeenLastCalledWith(true)
    expect(onFocusChange).not.toHaveBeenCalledWith(false)
  })

  it('crece al tomar el foco y vuelve al soltarlo', () => {
    render(<MarketplaceSearchBox compact />)
    const input = screen.getByRole('searchbox')

    expect(input.className).toContain('h-9')

    fireEvent.focus(input)
    expect(input.className).toContain('h-10')
    expect(input.className).not.toContain('h-9')

    fireEvent.blur(input, { relatedTarget: document.body })
    expect(input.className).toContain('h-9')
  })

  it('esconde la X que agrega el navegador', () => {
    // `type="search"` trae la suya y quedaban dos, una al lado de la otra.
    render(<MarketplaceSearchBox compact initialQuery="teclado" />)

    expect(screen.getByRole('searchbox').className)
      .toContain('[&::-webkit-search-cancel-button]:appearance-none')
    expect(screen.getAllByLabelText('Limpiar busqueda')).toHaveLength(1)
  })

  it('sin `compact` no cambia de tamaño', () => {
    // Es el de /marketplace/buscar, que ya ocupa el ancho que necesita.
    render(<MarketplaceSearchBox />)
    const input = screen.getByRole('searchbox')

    fireEvent.focus(input)
    expect(input.className).toContain('h-11')
  })
})

describe('el encabezado le hace lugar al buscador', () => {
  const nav = leer('src/components/public/marketplace-public-nav.tsx')

  it('ensancha el campo mientras se escribe', () => {
    expect(nav).toContain('onFocusChange={setSearchFocused}')
    expect(nav).toContain("searchFocused ? 'max-w-3xl' : 'max-w-sm'")
    expect(nav).toContain('transition-[max-width]')
  })

  it('esconde los enlaces y el CTA solo donde el buscador esta en la fila', () => {
    // Por debajo de `xl` el buscador no se muestra: esconder los enlaces ahi no
    // ganaria nada y dejaria el encabezado vacio.
    const colapsos = [...nav.matchAll(/searchFocused && 'xl:hidden'/g)]
    expect(colapsos).toHaveLength(2)
    expect(nav).not.toContain("searchFocused && 'hidden'")
  })
})
