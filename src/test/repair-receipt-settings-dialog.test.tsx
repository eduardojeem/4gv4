import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RECEIPT_SETTINGS, resetReceiptSettingsSyncForTests } from '@/lib/repair-receipt'
import { RepairReceiptSettingsDialog } from '@/components/dashboard/repairs/RepairReceiptSettingsDialog'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const servidor = (canEdit: boolean) => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const cambios = JSON.parse(String(init.body)).settings
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { ...DEFAULT_RECEIPT_SETTINGS, ...cambios }, organizationId: 'org-1' }),
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: DEFAULT_RECEIPT_SETTINGS, organizationId: 'org-1', persisted: true, canEdit }),
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/**
 * Radix activa las pestañas con mousedown, no con click. Se pulsa como lo haría
 * un mouse real.
 */
function abrirPestana(nombre: RegExp) {
  const tab = screen.getByRole('tab', { name: nombre })
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false })
  return tab
}

beforeEach(() => {
  localStorage.clear()
  resetReceiptSettingsSyncForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('el diálogo del comprobante', () => {
  /**
   * Todo iba dentro de un fieldset deshabilitado, que también deshabilitaba
   * los botones de las pestañas: quien no era administrador solo veía la primera.
   */
  it('quien no es administrador puede ver todas las pestañas', async () => {
    servidor(false)
    render(<RepairReceiptSettingsDialog open onOpenChange={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Solo un administrador/)).toBeInTheDocument())

    const tab = abrirPestana(/Garantía/)
    expect(tab).not.toBeDisabled()
    await waitFor(() => expect(screen.getByLabelText(/Tipo de cobertura/)).toBeInTheDocument())
    // Pero no puede editar.
    expect(screen.getByLabelText(/Duración \(meses/)).toBeDisabled()
  })

  it('el interruptor del logo aparece una sola vez', async () => {
    servidor(true)
    render(<RepairReceiptSettingsDialog open onOpenChange={() => {}} />)
    await waitFor(() => expect(screen.getByText('Configuración sincronizada')).toBeInTheDocument())

    expect(screen.getAllByRole('switch', { name: /Logo de la empresa/ })).toHaveLength(1)
    abrirPestana(/Garantía/)
    await waitFor(() => expect(screen.getByLabelText(/Tipo de cobertura/)).toBeInTheDocument())
    expect(screen.queryByRole('switch', { name: /logo/i })).not.toBeInTheDocument()
  })

  /**
   * Borrar el campo lo dejaba en 0 en cada tecla, y tipear 40 se aceptaba
   * hasta que el servidor lo rechazaba.
   */
  it('los meses se pueden borrar para reescribir, y se acotan', async () => {
    servidor(true)
    render(<RepairReceiptSettingsDialog open onOpenChange={() => {}} />)
    await waitFor(() => expect(screen.getByText('Configuración sincronizada')).toBeInTheDocument())
    abrirPestana(/Garantía/)

    const meses = await screen.findByLabelText(/Duración \(meses/)
    fireEvent.change(meses, { target: { value: '' } })
    expect(meses).toHaveValue(null)
    fireEvent.change(meses, { target: { value: '40' } })
    expect(meses).toHaveValue(36)
    fireEvent.change(meses, { target: { value: '' } })
    fireEvent.blur(meses)
    // Al salir vacío vuelve al último valor válido, no a 0.
    expect(meses).toHaveValue(36)
  })

  /** Mandar la configuración entera pisaba lo que otra pantalla hubiera cambiado. */
  it('al guardar manda solo lo que cambió', async () => {
    const fetchMock = servidor(true)
    const onOpenChange = vi.fn()
    render(<RepairReceiptSettingsDialog open onOpenChange={onOpenChange} />)
    await waitFor(() => expect(screen.getByText('Configuración sincronizada')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('switch', { name: /Código de verificación/ }))
    expect(screen.getByText('1 cambio pendiente de guardar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuración/ }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    const patch = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')
    expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({ settings: { showHash: false } })
  })

  it('no pide la configuración al cerrarse', async () => {
    const fetchMock = servidor(true)
    const { rerender } = render(<RepairReceiptSettingsDialog open onOpenChange={() => {}} />)
    await waitFor(() => expect(screen.getByText('Configuración sincronizada')).toBeInTheDocument())
    const pedidos = fetchMock.mock.calls.length

    rerender(<RepairReceiptSettingsDialog open={false} onOpenChange={() => {}} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchMock.mock.calls.length).toBe(pedidos)
  })
})
