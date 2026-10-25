import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEffect, useRef } from 'react'

function useSaveShortcut({
  save,
  editable,
  saving,
}: {
  save: () => Promise<string | null> | void
  editable: boolean
  saving: boolean
}) {
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (editable && !saving) void saveRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editable, saving])
}

describe('QuoteEditor Ctrl+S shortcut listener', () => {
  it('triggers latest save callback on Ctrl+S and prevents default browser behavior', () => {
    const initialSave = vi.fn()
    const latestSave = vi.fn()

    const { rerender } = renderHook(
      ({ save, editable, saving }) => useSaveShortcut({ save, editable, saving }),
      { initialProps: { save: initialSave, editable: true, saving: false } }
    )

    // Update with latest save callback without remounting
    rerender({ save: latestSave, editable: true, saving: false })

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      cancelable: true,
    })
    const prevented = !window.dispatchEvent(event)

    expect(prevented).toBe(true)
    expect(initialSave).not.toHaveBeenCalled()
    expect(latestSave).toHaveBeenCalledTimes(1)
  })

  it('triggers on Cmd+S (macOS metaKey)', () => {
    const onSave = vi.fn()
    renderHook(() => useSaveShortcut({ save: onSave, editable: true, saving: false }))

    const event = new KeyboardEvent('keydown', {
      key: 'S',
      metaKey: true,
      cancelable: true,
    })
    window.dispatchEvent(event)

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not trigger save when already saving or when not editable', () => {
    const onSave = vi.fn()
    const { rerender } = renderHook(
      ({ editable, saving }) => useSaveShortcut({ save: onSave, editable, saving }),
      { initialProps: { editable: true, saving: true } }
    )

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    expect(onSave).not.toHaveBeenCalled()

    // Non-editable
    rerender({ editable: false, saving: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('removes the window event listener upon unmount', () => {
    const onSave = vi.fn()
    const { unmount } = renderHook(() => useSaveShortcut({ save: onSave, editable: true, saving: false }))

    unmount()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    expect(onSave).not.toHaveBeenCalled()
  })
})
