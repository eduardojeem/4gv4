/**
 * Hook para manejar atajos de teclado avanzados en el POS
 * Mejora la eficiencia del cajero con shortcuts intuitivos
 */

import { useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

export interface KeyboardShortcuts {
  // Navegación
  'F1': () => void          // Ayuda
  'F2': () => void          // Buscar producto
  'F3': () => void          // Seleccionar cliente
  'F4': () => void          // Procesar pago
  'F5': () => void          // Limpiar carrito
  'F9': () => void          // Abrir caja
  'F10': () => void         // Cerrar caja
  
  // Operaciones con Ctrl
  'Ctrl+B': () => void      // Escanear código de barras
  'Ctrl+D': () => void      // Aplicar descuento
  'Ctrl+P': () => void      // Imprimir último recibo
  'Ctrl+N': () => void      // Nuevo cliente
  'Ctrl+S': () => void      // Guardar venta (draft)
  'Ctrl+Z': () => void      // Deshacer última acción
  
  // Números para métodos de pago rápido
  '1': () => void           // Efectivo
  '2': () => void           // Tarjeta
  '3': () => void           // Transferencia
  '4': () => void           // Crédito
  
  // Escape
  'Escape': () => void      // Cancelar operación actual
  
  // Enter
  'Enter': () => void       // Confirmar acción actual
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  showToasts?: boolean
  onShortcutUsed?: (shortcut: string) => void
}

export function useKeyboardShortcuts(
  shortcuts: Partial<KeyboardShortcuts>,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, showToasts = true, onShortcutUsed } = options
  const shortcutsRef = useRef(shortcuts)
  const isModalOpenRef = useRef(false)
  const isInputFocusedRef = useRef(false)

  // Actualizar referencia de shortcuts
  shortcutsRef.current = shortcuts

  // Detectar si hay un modal abierto o input enfocado
  useEffect(() => {
    const checkModalState = () => {
      const modals = document.querySelectorAll('[role="dialog"]')
      isModalOpenRef.current = modals.length > 0
      
      const activeElement = document.activeElement
      isInputFocusedRef.current = activeElement?.tagName === 'INPUT' || 
                                   activeElement?.tagName === 'TEXTAREA' ||
                                   activeElement?.contentEditable === 'true'
    }

    // Verificar estado inicial
    checkModalState()

    // Observer para cambios en el DOM
    const observer = new MutationObserver(checkModalState)
    observer.observe(document.body, { 
      childList: true, 
      subtree: true, 
      attributes: true,
      attributeFilter: ['role', 'contenteditable']
    })

    // Listener para cambios de foco
    document.addEventListener('focusin', checkModalState)
    document.addEventListener('focusout', checkModalState)

    return () => {
      observer.disconnect()
      document.removeEventListener('focusin', checkModalState)
      document.removeEventListener('focusout', checkModalState)
    }
  }, [])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // No procesar shortcuts si hay un input enfocado (excepto Escape)
    if (isInputFocusedRef.current && event.key !== 'Escape') {
      return
    }

    const { key, ctrlKey, altKey, shiftKey } = event
    let shortcutKey = ''

    // Construir la clave del shortcut
    if (ctrlKey && !altKey && !shiftKey) {
      shortcutKey = `Ctrl+${key.toUpperCase()}`
    } else if (!ctrlKey && !altKey && !shiftKey) {
      // Teclas de función y especiales
      if (key.startsWith('F') && key.length <= 3) {
        shortcutKey = key
      } else if (['Escape', 'Enter'].includes(key)) {
        shortcutKey = key
      } else if (['1', '2', '3', '4'].includes(key) && !isModalOpenRef.current) {
        // Números solo cuando no hay modal abierto
        shortcutKey = key
      }
    }

    // Ejecutar shortcut si existe
    if (shortcutKey && shortcutsRef.current[shortcutKey as keyof KeyboardShortcuts]) {
      event.preventDefault()
      event.stopPropagation()
      
      try {
        shortcutsRef.current[shortcutKey as keyof KeyboardShortcuts]?.()
        
        if (showToasts) {
          const shortcutNames: Record<string, string> = {
            'F1': 'Ayuda',
            'F2': 'Buscar producto',
            'F3': 'Seleccionar cliente',
            'F4': 'Procesar pago',
            'F5': 'Limpiar carrito',
            'F9': 'Abrir caja',
            'F10': 'Cerrar caja',
            'Ctrl+B': 'Escanear código',
            'Ctrl+D': 'Aplicar descuento',
            'Ctrl+P': 'Imprimir recibo',
            'Ctrl+N': 'Nuevo cliente',
            'Ctrl+S': 'Guardar venta',
            'Ctrl+Z': 'Deshacer',
            '1': 'Pago en efectivo',
            '2': 'Pago con tarjeta',
            '3': 'Transferencia',
            '4': 'Pago a crédito',
            'Escape': 'Cancelar',
            'Enter': 'Confirmar'
          }
          
          const shortcutName = shortcutNames[shortcutKey] || shortcutKey
          toast.success(`Atajo: ${shortcutName}`, { duration: 1000 })
        }
        
        onShortcutUsed?.(shortcutKey)
      } catch (error) {
        console.error('Error executing shortcut:', error)
        if (showToasts) {
          toast.error('Error al ejecutar atajo de teclado')
        }
      }
    }
  }, [enabled, showToasts, onShortcutUsed])

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])

  // Función para mostrar ayuda de shortcuts
  const showShortcutsHelp = useCallback(() => {
    const helpContent = `
🎯 ATAJOS DE TECLADO POS

📋 NAVEGACIÓN:
F1  - Mostrar esta ayuda
F2  - Buscar producto
F3  - Seleccionar cliente
F4  - Procesar pago
F5  - Limpiar carrito

🏦 CAJA:
F9  - Abrir caja
F10 - Cerrar caja

⚡ OPERACIONES (Ctrl+):
Ctrl+B - Escanear código de barras
Ctrl+D - Aplicar descuento
Ctrl+P - Imprimir último recibo
Ctrl+N - Nuevo cliente
Ctrl+S - Guardar venta
Ctrl+Z - Deshacer última acción

💳 PAGO RÁPIDO:
1 - Efectivo
2 - Tarjeta
3 - Transferencia
4 - Crédito

🔄 CONTROL:
Esc   - Cancelar operación
Enter - Confirmar acción

💡 Los atajos numéricos solo funcionan cuando no hay modales abiertos.
💡 Los atajos no funcionan cuando hay un campo de texto enfocado (excepto Esc).
    `
    
    // Crear modal de ayuda
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50'
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">Atajos de Teclado</h2>
          <button class="text-gray-500 hover:text-gray-700" onclick="this.closest('.fixed').remove()">
            ✕
          </button>
        </div>
        <pre class="text-sm whitespace-pre-wrap font-mono">${helpContent}</pre>
        <div class="mt-4 flex justify-end">
          <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" onclick="this.closest('.fixed').remove()">
            Cerrar
          </button>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Remover modal al hacer clic fuera
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove()
      }
    })
    
    // Remover modal con Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        modal.remove()
        document.removeEventListener('keydown', handleEscape)
      }
    }
    document.addEventListener('keydown', handleEscape)
  }, [])

  return {
    showShortcutsHelp,
    isModalOpen: isModalOpenRef.current,
    isInputFocused: isInputFocusedRef.current
  }
}

// Hook específico para el POS con shortcuts predefinidos
export function usePOSKeyboardShortcuts(callbacks: {
  onHelp?: () => void
  onSearchProduct?: () => void
  onSelectCustomer?: () => void
  onProcessPayment?: () => void
  onClearCart?: () => void
  onOpenCashRegister?: () => void
  onCloseCashRegister?: () => void
  onScanBarcode?: () => void
  onApplyDiscount?: () => void
  onPrintReceipt?: () => void
  onNewCustomer?: () => void
  onSaveDraft?: () => void
  onUndo?: () => void
  onPaymentCash?: () => void
  onPaymentCard?: () => void
  onPaymentTransfer?: () => void
  onPaymentCredit?: () => void
  onCancel?: () => void
  onConfirm?: () => void
}) {
  const shortcuts: Partial<KeyboardShortcuts> = {
    'F1': callbacks.onHelp || (() => {}),
    'F2': callbacks.onSearchProduct || (() => {}),
    'F3': callbacks.onSelectCustomer || (() => {}),
    'F4': callbacks.onProcessPayment || (() => {}),
    'F5': callbacks.onClearCart || (() => {}),
    'F9': callbacks.onOpenCashRegister || (() => {}),
    'F10': callbacks.onCloseCashRegister || (() => {}),
    'Ctrl+B': callbacks.onScanBarcode || (() => {}),
    'Ctrl+D': callbacks.onApplyDiscount || (() => {}),
    'Ctrl+P': callbacks.onPrintReceipt || (() => {}),
    'Ctrl+N': callbacks.onNewCustomer || (() => {}),
    'Ctrl+S': callbacks.onSaveDraft || (() => {}),
    'Ctrl+Z': callbacks.onUndo || (() => {}),
    '1': callbacks.onPaymentCash || (() => {}),
    '2': callbacks.onPaymentCard || (() => {}),
    '3': callbacks.onPaymentTransfer || (() => {}),
    '4': callbacks.onPaymentCredit || (() => {}),
    'Escape': callbacks.onCancel || (() => {}),
    'Enter': callbacks.onConfirm || (() => {})
  }

  return useKeyboardShortcuts(shortcuts, {
    enabled: true,
    showToasts: true,
    onShortcutUsed: (shortcut) => {
      console.log(`POS Shortcut used: ${shortcut}`)
    }
  })
}