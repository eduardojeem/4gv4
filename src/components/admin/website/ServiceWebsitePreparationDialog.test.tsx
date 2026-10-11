import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ServiceWebsitePreparationDialog } from './ServiceWebsitePreparationDialog'

describe('service website preparation', () => {
  it('requires a preview before confirmation and never publishes when cancelled', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, revision: 'a'.repeat(32), proposal: { values: {}, summary: ['Servicios sin cambios'] }, services: [], agenda: { currency: 'PYG', services: [{ id: 'actual', name: 'Manicura real', duration: 45, price: 75000 }], professionals: [] } }) })
    vi.stubGlobal('fetch', request)
    const user = userEvent.setup()
    render(<ServiceWebsitePreparationDialog open onOpenChange={vi.fn()} onApplied={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Confirmar y aplicar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Generar vista previa' }))
    expect(await screen.findByRole('button', { name: 'Confirmar y aplicar' })).toBeInTheDocument()
    expect(screen.getByText('Manicura real')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(request.mock.calls.some(([, config]) => config.method === 'PATCH')).toBe(false)
    vi.unstubAllGlobals()
  })
})
