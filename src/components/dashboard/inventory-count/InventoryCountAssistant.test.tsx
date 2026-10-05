import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InventoryCountAssistant } from './InventoryCountAssistant'

describe('InventoryCountAssistant', () => {
  it('explica el flujo y ejecuta la siguiente acción recomendada', () => {
    const onAction = vi.fn()
    render(<InventoryCountAssistant
      guidance={{
        kind: 'continue',
        title: 'Continuá la toma #4',
        description: 'Quedan 7 productos sin contar.',
        actionLabel: 'Continuar conteo',
      }}
      onAction={onAction}
    />)

    expect(screen.getByRole('heading', { name: 'Continuá la toma #4' })).toBeInTheDocument()
    expect(screen.getByText('¿Cómo funciona una toma?')).toBeInTheDocument()
    expect(screen.getByText(/Se ajusta solamente lo contado/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Continuar conteo/ }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('no muestra una acción cuando la toma es solo de consulta', () => {
    render(<InventoryCountAssistant guidance={{
      kind: 'read-only',
      title: 'Consulta disponible',
      description: 'Necesitás permiso para ajustar.',
    }} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
