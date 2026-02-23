import { useEffect, useCallback } from 'react'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  callback: (event: KeyboardEvent) => void
  description?: string
  preventDefault?: boolean
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl === undefined || event.ctrlKey === shortcut.ctrl
        const shiftMatch = shortcut.shift === undefined || event.shiftKey === shortcut.shift
        const altMatch = shortcut.alt === undefined || event.altKey === shortcut.alt
        const metaMatch = shortcut.meta === undefined || event.metaKey === shortcut.meta

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault()
          }
          shortcut.callback(event)
          break
        }
      }
    },
    [shortcuts, enabled]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])
}

/**
 * Shortcuts comunes predefinidos
 */
export const commonShortcuts = {
  save: (callback: () => void): KeyboardShortcut => ({
    key: 's',
    ctrl: true,
    callback,
    description: 'Guardar (Ctrl+S)',
    preventDefault: true
  }),
  
  close: (callback: () => void): KeyboardShortcut => ({
    key: 'Escape',
    callback,
    description: 'Cerrar (Esc)',
    preventDefault: true
  }),
  
  submit: (callback: () => void): KeyboardShortcut => ({
    key: 'Enter',
    ctrl: true,
    callback,
    description: 'Enviar (Ctrl+Enter)',
    preventDefault: true
  }),
  
  undo: (callback: () => void): KeyboardShortcut => ({
    key: 'z',
    ctrl: true,
    callback,
    description: 'Deshacer (Ctrl+Z)',
    preventDefault: true
  }),
  
  redo: (callback: () => void): KeyboardShortcut => ({
    key: 'y',
    ctrl: true,
    callback,
    description: 'Rehacer (Ctrl+Y)',
    preventDefault: true
  }),
  
  find: (callback: () => void): KeyboardShortcut => ({
    key: 'f',
    ctrl: true,
    callback,
    description: 'Buscar (Ctrl+F)',
    preventDefault: true
  }),
  
  new: (callback: () => void): KeyboardShortcut => ({
    key: 'n',
    ctrl: true,
    callback,
    description: 'Nuevo (Ctrl+N)',
    preventDefault: true
  }),
  
  delete: (callback: () => void): KeyboardShortcut => ({
    key: 'Delete',
    callback,
    description: 'Eliminar (Delete)',
    preventDefault: false
  }),
  
  help: (callback: () => void): KeyboardShortcut => ({
    key: '?',
    shift: true,
    callback,
    description: 'Ayuda (Shift+?)',
    preventDefault: true
  })
}

/**
 * Hook para mostrar ayuda de shortcuts
 */
export function useShortcutHelp(shortcuts: KeyboardShortcut[]) {
  const getShortcutText = (shortcut: KeyboardShortcut): string => {
    const keys: string[] = []
    
    if (shortcut.ctrl) keys.push('Ctrl')
    if (shortcut.shift) keys.push('Shift')
    if (shortcut.alt) keys.push('Alt')
    if (shortcut.meta) keys.push('Cmd')
    keys.push(shortcut.key.toUpperCase())
    
    return keys.join('+')
  }

  const shortcutList = shortcuts
    .filter(s => s.description)
    .map(s => ({
      keys: getShortcutText(s),
      description: s.description || ''
    }))

  return shortcutList
}
