import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/mocks/server'
import { CatalogQuickCreateDialog } from './CatalogQuickCreateDialog'

const branchId = '1a599e42-52d3-4d80-9852-d05a91d47fe2'

describe('CatalogQuickCreateDialog', () => {
  beforeEach(() => {
    server.use(http.get('/api/categories', () => HttpResponse.json({ data: [] })))
  })

  it('creates a reusable service and returns the server catalog item', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    let sentBody: Record<string, unknown> | null = null
    server.use(
      http.post('/api/products', async ({ request }) => {
        sentBody = await request.json() as Record<string, unknown>
        return HttpResponse.json({
          success: true,
          data: { id: 'service-created', ...sentBody },
        }, { status: 201 })
      }),
    )

    render(<CatalogQuickCreateDialog
      open
      kind="service"
      branchId={branchId}
      canCreate
      onOpenChange={() => undefined}
      onCreated={onCreated}
    />)

    await user.type(screen.getByLabelText('Nombre del servicio'), 'Cambio de batería')
    await user.type(screen.getByLabelText('Precio de venta'), '150000')
    await user.type(screen.getByLabelText('Costo interno'), '80000')
    await user.click(screen.getByRole('button', { name: 'Crear servicio' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(sentBody).toMatchObject({
      name: 'Cambio de batería',
      unit_measure: 'servicio',
      branch_id: branchId,
    })
  })

  it('keeps entered values and shows the API error after a failed request', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/products', () => HttpResponse.json({
        success: false,
        error: 'Ya existe un producto con este SKU.',
      }, { status: 409 })),
    )

    render(<CatalogQuickCreateDialog
      open
      kind="part"
      branchId={branchId}
      canCreate
      onOpenChange={() => undefined}
      onCreated={() => undefined}
    />)

    const name = screen.getByLabelText('Nombre del repuesto')
    await user.type(name, 'Módulo A05')
    await user.type(screen.getByLabelText('Precio de venta'), '120000')
    await user.type(screen.getByLabelText('Costo interno'), '70000')
    await user.click(screen.getByRole('button', { name: 'Crear repuesto' }))

    expect(await screen.findByText('Ya existe un producto con este SKU.')).toBeVisible()
    expect(name).toHaveValue('Módulo A05')
  })

  it('explains why creation is unavailable without permission', () => {
    render(<CatalogQuickCreateDialog
      open
      kind="service"
      branchId={branchId}
      canCreate={false}
      onOpenChange={() => undefined}
      onCreated={() => undefined}
    />)

    expect(screen.getByText('No tenés permiso para crear artículos en el catálogo.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Crear servicio' })).toBeDisabled()
  })
})
