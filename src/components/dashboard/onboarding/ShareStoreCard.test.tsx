import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { qrFileName, shareStore, ShareStoreCard } from './ShareStoreCard'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('qrcode', () => ({ toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgo=') }))

const nav = navigator as unknown as Record<string, unknown>

function stubNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { configurable: true, value })
  }
}

afterEach(() => {
  for (const key of ['share', 'canShare', 'clipboard']) delete nav[key]
  vi.unstubAllGlobals()
})

describe('compartir la tienda', () => {
  it('arma un nombre de archivo sin tildes ni símbolos', () => {
    expect(qrFileName('Café & Repuestos Ñandú')).toBe('qr-cafe-repuestos-nandu.png')
    expect(qrFileName('***')).toBe('qr-tienda.png')
  })

  it('usa el menú del teléfono y adjunta el QR cuando el navegador acepta archivos', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share, canShare: () => true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['png'], { type: 'image/png' }))))

    await expect(shareStore({ url: 'https://mitiendapy.com/tienda/inicio', storeName: 'Tienda', qrDataUrl: 'data:image/png;base64,AA' }))
      .resolves.toBe('shared')
    const data = share.mock.calls[0][0] as ShareData
    expect(data.url).toBe('https://mitiendapy.com/tienda/inicio')
    expect(data.files?.[0].name).toBe('qr-tienda.png')
  })

  it('si el navegador no acepta archivos comparte sólo el enlace', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share, canShare: () => false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['png']))))

    await shareStore({ url: 'https://x.test/a/inicio', storeName: 'A', qrDataUrl: 'data:image/png;base64,AA' })
    expect((share.mock.calls[0][0] as ShareData).files).toBeUndefined()
  })

  it('sin menú de compartir copia el enlace', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ clipboard: { writeText } })

    await expect(shareStore({ url: 'https://x.test/a/inicio', storeName: 'A', qrDataUrl: null })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('¡Mirá el catálogo de A! https://x.test/a/inicio')
  })

  it('cerrar el menú no es un error', async () => {
    stubNavigator({ share: vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError')) })
    await expect(shareStore({ url: 'https://x.test', storeName: 'A', qrDataUrl: null })).resolves.toBe('cancelled')
  })

  it('la tarjeta publicada muestra el QR, la descarga y el botón Compartir', async () => {
    render(<ShareStoreCard url="https://x.test/mi-tienda/inicio" storeName="Mi Tienda" published onPublish={vi.fn()} />)

    const img = await screen.findByRole('img', { name: /QR de la tienda Mi Tienda/ })
    expect(img).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgo=')
    expect(screen.getByRole('link', { name: /Descargar QR/ })).toHaveAttribute('download', 'qr-mi-tienda.png')

    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ clipboard: { writeText } })
    fireEvent.click(screen.getByRole('button', { name: /Compartir/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
  })

  it('sin publicar invita a publicarla', () => {
    const onPublish = vi.fn()
    render(<ShareStoreCard url="https://x.test" storeName="A" published={false} onPublish={onPublish} />)
    fireEvent.click(screen.getByRole('button', { name: /Publicar la tienda/ }))
    expect(onPublish).toHaveBeenCalled()
  })
})
