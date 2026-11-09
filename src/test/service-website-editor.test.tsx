import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const uploadFile = vi.fn()
vi.mock('@/lib/supabase-storage', () => ({ uploadFile: (...args: unknown[]) => uploadFile(...args) }))

import { ServiceWebsiteEditor } from '@/components/dashboard/agenda/ServiceWebsiteEditor'
import type { AgendaService } from '@/lib/agenda/agenda-server'

const service: AgendaService = {
  product_id: 'p1', name: 'Corte', price: 50000, duration_minutes: 30, online: true, configured: true,
  catalog_visible: true, image_url: 'https://x/vieja.webp', images: ['https://x/vieja.webp', 'https://x/otra.webp'],
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  return JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string)
}

beforeEach(() => {
  uploadFile.mockReset()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())

describe('Foto y página web de un servicio', () => {
  it('ocultar de la web guarda solo la visibilidad en el producto', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn().mockResolvedValue(undefined)
    render(<ServiceWebsiteEditor service={service} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar Corte en la página web' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar foto y página web' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products/p1')
    expect(sentBody(fetchMock)).toEqual({ visibility: 'hidden' })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('sube la portada al bucket de productos y la pone primera; si falla el guardado, el reintento no la vuelve a subir', async () => {
    uploadFile.mockResolvedValue({ success: true, url: 'https://x/nueva.webp' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Sin conexión' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn().mockResolvedValue(undefined)
    render(<ServiceWebsiteEditor service={service} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText('Foto de portada'), { target: { files: [new File(['x'], 'c.webp', { type: 'image/webp' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar foto y página web' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')

    fireEvent.click(screen.getByRole('button', { name: 'Guardar foto y página web' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())

    expect(uploadFile).toHaveBeenCalledTimes(1)
    expect(uploadFile.mock.calls[0][0]).toBe('product-images')
    expect(String(uploadFile.mock.calls[0][1])).toMatch(/^products\/.+\.webp$/)
    expect(sentBody(fetchMock, 1)).toEqual({
      visibility: 'public',
      images: ['https://x/nueva.webp', 'https://x/vieja.webp', 'https://x/otra.webp'],
      image_url: 'https://x/nueva.webp',
    })
  })

  it('rechaza un archivo que no es foto sin subir nada', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<ServiceWebsiteEditor service={service} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Foto de portada'), { target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('JPG')
    expect(screen.getByRole('button', { name: 'Guardar foto y página web' })).toBeDisabled()
  })

  it('quitar la portada deja la siguiente foto como portada', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn().mockResolvedValue(undefined)
    render(<ServiceWebsiteEditor service={service} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: /Quitar portada/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar foto y página web' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(sentBody(fetchMock)).toEqual({ visibility: 'public', images: ['https://x/otra.webp'], image_url: 'https://x/otra.webp' })
  })
})
