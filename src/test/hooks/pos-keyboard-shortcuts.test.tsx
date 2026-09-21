import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '@/app/dashboard/pos/hooks/useKeyboardShortcuts'

describe('contexto de atajos del POS', () => {
  it('actualiza el estado de foco y evita ejecutar atajos mientras se escribe', () => {
    const action = vi.fn()
    render(<input aria-label="Cliente" />)
    const { result } = renderHook(() => useKeyboardShortcuts({ F2: action }, { showToasts: false }))
    act(() => screen.getByRole('textbox').focus())
    expect(result.current.isInputFocused).toBe(true)
    fireEvent.keyDown(document, { key: 'F2' })
    expect(action).not.toHaveBeenCalled()
    act(() => screen.getByRole('textbox').blur())
    expect(result.current.isInputFocused).toBe(false)
    fireEvent.keyDown(document, { key: 'F2' })
    expect(action).toHaveBeenCalledOnce()
  })

  it('refleja los diálogos abiertos y bloquea los pagos numéricos', async () => {
    const pay = vi.fn()
    const { result } = renderHook(() => useKeyboardShortcuts({ '1': pay }, { showToasts: false }))
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    await act(async () => { document.body.appendChild(dialog) })
    try {
      expect(result.current.isModalOpen).toBe(true)
      fireEvent.keyDown(document, { key: '1' })
      expect(pay).not.toHaveBeenCalled()
    } finally {
      await act(async () => { dialog.remove() })
    }
    expect(result.current.isModalOpen).toBe(false)
  })
})
