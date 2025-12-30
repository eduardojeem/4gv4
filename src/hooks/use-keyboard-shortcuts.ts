"use client"

import { useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  description: string
  preventDefault?: boolean
}

interface UseKeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Don't trigger shortcuts when user is typing in inputs
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      // Allow Ctrl+K for search even in inputs
      if (!(event.key === 'k' && (event.ctrlKey || event.metaKey))) {
        return
      }
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase()
      const ctrlMatch = !!shortcut.ctrlKey === event.ctrlKey
      const metaMatch = !!shortcut.metaKey === event.metaKey
      const shiftMatch = !!shortcut.shiftKey === event.shiftKey
      const altMatch = !!shortcut.altKey === event.altKey

      return keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch
    })

    if (matchingShortcut) {
      if (matchingShortcut.preventDefault !== false) {
        event.preventDefault()
      }
      matchingShortcut.action()
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])

  // Function to show available shortcuts
  const showShortcutsHelp = useCallback(() => {
    const shortcutsList = shortcuts
      .map(s => {
        const keys = []
        if (s.ctrlKey || s.metaKey) keys.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
        if (s.shiftKey) keys.push('Shift')
        if (s.altKey) keys.push('Alt')
        keys.push(s.key.toUpperCase())
        return `${keys.join('+')} - ${s.description}`
      })
      .join('\n')

    toast.info('Atajos de Teclado Disponibles', {
      description: shortcutsList,
      duration: 5000
    })
  }, [shortcuts])

  return { showShortcutsHelp }
}

// Predefined shortcuts for customer dashboard
export const customerDashboardShortcuts = {
  newCustomer: { key: 'n', ctrlKey: true, description: 'Nuevo Cliente' },
  search: { key: 'k', ctrlKey: true, description: 'Buscar Cliente' },
  export: { key: 'e', ctrlKey: true, description: 'Exportar Clientes' },
  import: { key: 'i', ctrlKey: true, description: 'Importar Clientes' },
  refresh: { key: 'F5', description: 'Actualizar Lista' },
  help: { key: '?', shiftKey: true, description: 'Mostrar Ayuda' },
  selectAll: { key: 'a', ctrlKey: true, description: 'Seleccionar Todo' },
  escape: { key: 'Escape', description: 'Cancelar/Cerrar' }
}