import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SupportContactMenu } from './SupportContactMenu'
import { resetSupportContactCacheForTests } from '@/hooks/use-support-contact'

function mockSupport(support: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, support }), { status: 200 })))
}

afterEach(() => {
  resetSupportContactCacheForTests()
  vi.unstubAllGlobals()
})

describe('SupportContactMenu', () => {
  it('muestra correo, WhatsApp, horario y la guía', async () => {
    mockSupport({ email: 'ayuda@mitiendapy.com', whatsapp: '+595981123456', whatsappUrl: 'https://wa.me/595981123456', hours: 'Lun a vie, 8 a 18 h' })
    render(<SupportContactMenu showGuide />)

    fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte' }))

    const whatsapp = await screen.findByRole('link', { name: /WhatsApp/ })
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/595981123456\?text=/)
    expect(whatsapp).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: /Correo/ })).toHaveAttribute('href', 'mailto:ayuda@mitiendapy.com')
    expect(screen.getByRole('link', { name: /Guía del sistema/ })).toHaveAttribute('href', '/admin/guia')
    expect(screen.getByText('Lun a vie, 8 a 18 h')).toBeInTheDocument()
  })

  it('sin WhatsApp ni guía queda solo el correo; si la API falla, el de la marca', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    render(<SupportContactMenu />)

    fireEvent.click(screen.getByRole('button', { name: 'Ayuda y soporte' }))

    expect(await screen.findByRole('link', { name: /Correo/ })).toHaveAttribute('href', 'mailto:soporte@mitiendapy.com')
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Guía/ })).toBeNull()
  })
})
