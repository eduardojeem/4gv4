import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StorefrontPaletteAssistant } from '@/components/admin/website/StorefrontPaletteAssistant'
import { BRAND_PALETTES, paletteColors } from '@/lib/website/brand-palette'
import type { CompanyInfo } from '@/types/website-settings'
import { paletteFromLogo } from '@/lib/website/logo-palette'
vi.mock('@/lib/website/logo-palette', () => ({ paletteFromLogo: vi.fn() }))
const company = { name:'Ejemplo',logoUrl:'/logo.png' } as CompanyInfo

describe('asistente de paletas', () => {
  it('elige una combinación sin cambiar la plantilla y permite volver a un solo color', () => {
    const change = vi.fn()
    const { rerender } = render(<StorefrontPaletteAssistant value={company} onChange={change} businessVertical="cosmetics" />)
    fireEvent.click(screen.getByRole('button',{name:/Fucsia elegante/}))
    expect(change).toHaveBeenCalledWith({brandPalette:paletteColors(BRAND_PALETTES[0]),brandColor:'custom',customBrandColor:'#B21FB8'})
    expect(change.mock.calls[0][0]).not.toHaveProperty('storefrontStyle')
    rerender(<StorefrontPaletteAssistant value={{...company,brandPalette:paletteColors(BRAND_PALETTES[0])}} onChange={change} />)
    fireEvent.click(screen.getByRole('button',{name:'Más opciones'}))
    fireEvent.click(screen.getByRole('button',{name:'Usar solo color principal'}))
    expect(change).toHaveBeenLastCalledWith({brandPalette:null})
  })
  it('filtra por estilo y bloquea una edición que no se puede leer', () => {
    render(<StorefrontPaletteAssistant value={company} onChange={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox',{name:'Estilo'}),{target:{value:'natural'}})
    expect(screen.queryByRole('button',{name:/Fucsia elegante/})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Personalizar combinación'}))
    fireEvent.change(screen.getByLabelText('Texto',{exact:true}),{target:{value:'#ffffff'}})
    fireEvent.change(screen.getByLabelText('Fondo',{exact:true}),{target:{value:'#ffffff'}})
    expect(screen.getByRole('button',{name:'Aplicar combinación'})).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('4,5:1')
  })
  it('explica el fallo del logo sin guardar ni cambiar los datos del comercio', async () => {
    vi.mocked(paletteFromLogo).mockRejectedValueOnce(new Error('El logo no permite leer sus colores.'))
    const change = vi.fn()
    render(<StorefrontPaletteAssistant value={company} onChange={change} />)
    fireEvent.click(screen.getByRole('button',{name:'Más opciones'}))
    fireEvent.click(screen.getByRole('button',{name:'Sugerir desde mi logo'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('no permite leer')
    expect(change).not.toHaveBeenCalled()
  })
})


it('permite revisar la sugerencia del logo antes de aplicarla sin reemplazarlo', async () => {
  const palette = paletteColors(BRAND_PALETTES[0])
  vi.mocked(paletteFromLogo).mockResolvedValueOnce(palette)
  const change = vi.fn()
  render(<StorefrontPaletteAssistant value={company} onChange={change} />)
  fireEvent.click(screen.getByRole('button',{name:'Más opciones'}))
    fireEvent.click(screen.getByRole('button',{name:'Sugerir desde mi logo'}))
  expect(await screen.findByRole('button',{name:'Aplicar combinación'})).toBeEnabled()
  expect(change).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Aplicar combinación'}))
  expect(change.mock.calls[0][0].brandPalette).toEqual(palette)
  expect(change.mock.calls[0][0]).not.toHaveProperty('logoUrl')
})


it('ofrece Rosa suave entre las primeras recomendaciones de belleza y permite elegirla', () => {
  const change = vi.fn()
  render(<StorefrontPaletteAssistant value={company} onChange={change} businessVertical="cosmetics" />)
  fireEvent.click(screen.getByRole('button',{name:/Rosa suave/}))
  expect(change).toHaveBeenCalledWith(expect.objectContaining({brandPalette:{primary:'#DB2777',accent:'#7E3E5B',background:'#FFF1F5',text:'#3F2330'},brandColor:'custom'}))
})


it('mantiene las acciones del logo plegadas hasta que se solicitan', () => {
  render(<StorefrontPaletteAssistant value={company} onChange={vi.fn()} />)
  expect(screen.queryByRole('button',{name:'Sugerir desde mi logo'})).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Más opciones'})).toHaveAttribute('aria-expanded','false')
  fireEvent.click(screen.getByRole('button',{name:'Más opciones'}))
  expect(screen.getByRole('button',{name:'Sugerir desde mi logo'})).toBeVisible()
})
