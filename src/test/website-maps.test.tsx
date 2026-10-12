import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/tienda-demo/inicio' }))
vi.mock('@/lib/api/withAdminAuth', () => ({ withAdminAuth: (handler: unknown) => handler }))

import { POST } from '@/app/api/admin/website/maps-link/route'
import { ContactCTA } from '@/components/public/inicio/ContactCTA'
import { BranchLocations } from '@/components/public/inicio/BranchLocations'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import {
  extractMapsCoordinates,
  getCompanyMapsEmbedSrc,
  getDirectionsHref,
  getWazeHref,
  isShortMapsLink,
} from '@/lib/website/company-maps-url'

const PLACE = 'https://www.google.com/maps/place/Celulares+Centro/@-27.3300,-55.8600,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d-27.3312!4d-55.8667'

describe('enlaces de Google Maps', () => {
  it('lee el pin del lugar antes que el centro de la vista', () => {
    expect(extractMapsCoordinates(PLACE)).toEqual({ lat: -27.3312, lng: -55.8667 })
    expect(extractMapsCoordinates('https://www.google.com/maps/@-25.28,-57.63,15z')).toEqual({ lat: -25.28, lng: -57.63 })
    expect(extractMapsCoordinates('https://maps.google.com/maps?q=-25.3%2C-57.6')).toEqual({ lat: -25.3, lng: -57.6 })
    expect(extractMapsCoordinates('https://maps.app.goo.gl/abc123')).toBeNull()
  })

  it('reconoce el enlace corto de la app', () => {
    expect(isShortMapsLink('https://maps.app.goo.gl/abc123')).toBe(true)
    expect(isShortMapsLink(PLACE)).toBe(false)
  })

  it('el mapa embebido marca el pin exacto', () => {
    expect(getCompanyMapsEmbedSrc(PLACE, 'Encarnación')).toContain('q=-27.3312,-55.8667')
  })

  it('«Cómo llegar» abre la ruta, no el mismo mapa', () => {
    expect(getDirectionsHref(PLACE, 'Encarnación')).toBe('https://www.google.com/maps/dir/?api=1&destination=-27.3312,-55.8667')
    expect(getDirectionsHref('', 'Av. Japón 123, Encarnación')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Av.%20Jap%C3%B3n%20123%2C%20Encarnaci%C3%B3n'
    )
    // Un enlace corto sin dirección se abre tal cual.
    expect(getDirectionsHref('https://maps.app.goo.gl/abc123', '')).toBe('https://maps.app.goo.gl/abc123')
    expect(getDirectionsHref('https://example.com/maps', '')).toBeNull()
  })

  it('Waze navega al punto o a la dirección', () => {
    expect(getWazeHref(PLACE, '')).toBe('https://waze.com/ul?ll=-27.3312,-55.8667&navigate=yes')
    expect(getWazeHref('', 'Encarnación')).toBe('https://waze.com/ul?q=Encarnaci%C3%B3n&navigate=yes')
    expect(getWazeHref('https://maps.app.goo.gl/abc123', '')).toBeNull()
  })
})

describe('resolver el enlace corto', () => {
  afterEach(() => vi.unstubAllGlobals())

  const pedir = (url: string) =>
    (POST as unknown as (request: Request) => Promise<Response>)(
      new Request('http://localhost/api/admin/website/maps-link', { method: 'POST', body: JSON.stringify({ url }) })
    ).then((response) => response.json())

  it('sigue la redirección de Google y devuelve el pin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: PLACE } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(pedir('https://maps.app.goo.gl/abc123')).resolves.toEqual({
      url: PLACE,
      resolved: true,
      coordinates: { lat: -27.3312, lng: -55.8667 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('no sigue redirecciones fuera de Google', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://evil.example/maps' } })))
    await expect(pedir('https://maps.app.goo.gl/abc123')).resolves.toMatchObject({ url: 'https://maps.app.goo.gl/abc123', resolved: false })
  })

  it('no pide nada si el enlace no es corto', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(pedir(PLACE)).resolves.toMatchObject({ resolved: false, coordinates: { lat: -27.3312, lng: -55.8667 } })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('la sección de ubicación de la tienda', () => {
  const dibujar = (mapsUrl: string, showCatalog?: boolean) =>
    render(
      <ContactCTA
        companyInfo={{ name: 'Celulares Centro', phone: '0981000000', email: '', address: 'Encarnación', mapsUrl, hours: { weekdays: '', saturday: '', sunday: '' } } as never}
        brand={getBrandTheme('blue')}
        phoneClean="595981000000"
        contactHref="https://wa.me/595981000000"
        showCatalog={showCatalog}
      />
    )

  it('ofrece la ruta, Waze y el mapa con el nombre del local', () => {
    dibujar(PLACE)
    expect(screen.getByRole('link', { name: /Cómo llegar/ })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=-27.3312,-55.8667')
    expect(screen.getByRole('link', { name: /Ir con Waze/ })).toHaveAttribute('href', 'https://waze.com/ul?ll=-27.3312,-55.8667&navigate=yes')
    expect(screen.getByRole('link', { name: /Ver en Google Maps/ })).toHaveAttribute('href', PLACE)
    expect(screen.getByTitle('Mapa: cómo llegar a Celulares Centro')).toBeInTheDocument()
    expect(screen.queryByText('Ubicación en vivo')).not.toBeInTheDocument()
  })

  it('comparte la ubicación', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    dibujar(PLACE)
    fireEvent.click(screen.getByRole('button', { name: /Compartir ubicación/ }))
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Celulares Centro', text: 'Celulares Centro · Encarnación', url: PLACE }))
    Reflect.deleteProperty(navigator, 'share')
  })

  it('sin catálogo no lleva a una página vacía', () => {
    dibujar(PLACE, false)
    expect(screen.queryByRole('link', { name: /Explorar Catálogo/ })).not.toBeInTheDocument()
  })
})

describe('las sucursales', () => {
  it('cada una tiene su ruta y Waze', () => {
    const sucursal = (id: string, name: string, address: string) => ({ id, name, address, city: 'Encarnación', phone: null, email: null, managerName: null, isDefault: false })
    render(<BranchLocations branches={[sucursal('a', 'Centro', 'Mcal. Estigarribia 100'), sucursal('b', 'Shopping', 'Ruta 1 km 3')]} brand={getBrandTheme('blue')} />)
    expect(screen.getByRole('link', { name: 'Cómo llegar a Centro' })).toHaveAttribute(
      'href',
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('Mcal. Estigarribia 100, Encarnación')}`
    )
    expect(screen.getByRole('link', { name: 'Ir con Waze a Shopping' })).toHaveAttribute(
      'href',
      `https://waze.com/ul?q=${encodeURIComponent('Ruta 1 km 3, Encarnación')}&navigate=yes`
    )
  })
})

describe('la política de seguridad del sitio', () => {
  it('deja mostrar el mapa de Google embebido', async () => {
    const { readFileSync } = await import('node:fs')
    const config = readFileSync(`${process.cwd()}/next.config.ts`, 'utf8')
    const frameSrc = config.split('\n').find((line) => line.includes('frame-src')) ?? ''
    // Sin esto el navegador muestra «Este contenido está bloqueado» en lugar del mapa.
    expect(frameSrc).toContain('https://maps.google.com')
    expect(frameSrc).toContain('https://www.google.com')
  })
})
