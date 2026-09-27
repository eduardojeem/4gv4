import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { RepairQualityCheckDialog } from '../RepairQualityCheckDialog'

const repair = {
  id: 'repair-1', ticketNumber: 'R-1', status: 'reparacion', brand: 'Samsung', model: 'A54',
  customer: { name: 'Ana', phone: '', email: '' }, issue: 'No enciende', technician: { id: 'tech-1', name: 'Luis' },
} as Repair

describe('RepairQualityCheckDialog', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requires every check before approving the device as working', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ repair: { id: repair.id } }), { status: 200 }))
    const onSaved = vi.fn()
    render(<RepairQualityCheckDialog open repair={repair} branchId="branch-1" onOpenChange={vi.fn()} onSaved={onSaved} />)

    const submit = screen.getByRole('button', { name: 'Aprobar y marcar listo' })
    expect(submit).toBeDisabled()
    for (const label of ['Enciende correctamente', 'Falla original solucionada', 'Funciones básicas probadas', 'Estado físico verificado', 'Accesorios verificados']) {
      fireEvent.click(screen.getByLabelText(label))
    }
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith('/api/repairs/repair-1/quality-check', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-branch-id': 'branch-1' }),
    }))
  })

  it('requires an explanation when the final test failed', () => {
    render(<RepairQualityCheckDialog open repair={repair} onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Falló la prueba final' }))

    expect(screen.getByLabelText('Qué falló y qué debe revisar el técnico')).toBeRequired()
    expect(screen.getByRole('button', { name: 'Registrar falla y volver a reparación' })).toBeDisabled()
  })

  it('toggles all checks at once with "Marcar todo" and "Desmarcar todo"', () => {
    render(<RepairQualityCheckDialog open repair={repair} onOpenChange={vi.fn()} onSaved={vi.fn()} />)

    const submit = screen.getByRole('button', { name: 'Aprobar y marcar listo' })
    expect(submit).toBeDisabled()

    const toggleAllBtn = screen.getByRole('button', { name: 'Marcar todo' })
    expect(toggleAllBtn).toBeVisible()

    // Click "Marcar todo" -> all checks should be true and submit enabled
    fireEvent.click(toggleAllBtn)
    expect(submit).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Desmarcar todo' })).toBeVisible()

    // Click "Desmarcar todo" -> all checks should be false and submit disabled
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar todo' }))
    expect(submit).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Marcar todo' })).toBeVisible()
  })

  it('provides quick suggestions for detailed explanations and allows applying/clearing them', () => {
    render(<RepairQualityCheckDialog open repair={repair} onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Falló la prueba final' }))

    const submit = screen.getByRole('button', { name: 'Registrar falla y volver a reparación' })
    expect(submit).toBeDisabled()

    // Contextual suggestion from repair issue should be present
    const issueSuggestion = screen.getByRole('button', { name: /\+ Persiste la falla reportada: No enciende/i })
    expect(issueSuggestion).toBeVisible()

    // Click suggestion -> fills textarea and enables submit
    fireEvent.click(issueSuggestion)
    const textarea = screen.getByLabelText('Qué falló y qué debe revisar el técnico')
    expect(textarea).toHaveValue('Persiste la falla reportada: No enciende')
    expect(submit).toBeEnabled()

    // Click another suggestion -> appends it
    const batterySuggestion = screen.getByRole('button', { name: /\+ No retiene carga de batería \/ no carga/i })
    fireEvent.click(batterySuggestion)
    expect(textarea).toHaveValue('Persiste la falla reportada: No enciende. No retiene carga de batería / no carga')

    // Click active suggestion -> toggles it off
    const activeIssueSuggestion = screen.getByRole('button', { name: /✓ Persiste la falla reportada: No enciende/i })
    fireEvent.click(activeIssueSuggestion)
    expect(textarea).toHaveValue('No retiene carga de batería / no carga')

    // Click Limpiar -> clears text and disables submit
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(textarea).toHaveValue('')
    expect(submit).toBeDisabled()
  })
})
