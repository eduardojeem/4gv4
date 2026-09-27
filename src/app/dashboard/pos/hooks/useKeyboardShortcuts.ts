/**
 * Hook para manejar atajos de teclado avanzados en el POS
 * Mejora la eficiencia del cajero con shortcuts intuitivos
 */

import { useEffect, useLayoutEffect, useCallback, useRef, useSyncExternalStore } from 'react'
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

const MODAL_OPEN = 1
const INPUT_FOCUSED = 2

function getInteractionState() {
  if (typeof document === 'undefined') return 0
  const activeElement = document.activeElement as HTMLElement | null
  const inputFocused = activeElement?.tagName === 'INPUT' ||
    activeElement?.tagName === 'TEXTAREA' || activeElement?.contentEditable === 'true'
  return (document.querySelector('[role="dialog"]') ? MODAL_OPEN : 0) |
    (inputFocused ? INPUT_FOCUSED : 0)
}

function subscribeInteractionState(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['role', 'contenteditable']
  })
  document.addEventListener('focusin', onChange)
  document.addEventListener('focusout', onChange)
  return () => {
    observer.disconnect()
    document.removeEventListener('focusin', onChange)
    document.removeEventListener('focusout', onChange)
  }
}

export function useKeyboardShortcuts(
  shortcuts: Partial<KeyboardShortcuts>,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, showToasts = true, onShortcutUsed } = options
  const shortcutsRef = useRef(shortcuts)
  const interactionState = useSyncExternalStore(subscribeInteractionState, getInteractionState, () => 0)

  // Actualizar referencia de shortcuts
  useLayoutEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // No procesar shortcuts si hay un input enfocado (excepto Escape)
    const currentInteraction = getInteractionState()
    if ((currentInteraction & INPUT_FOCUSED) && event.key !== 'Escape') {
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
      } else if (['1', '2', '3', '4'].includes(key) && !(currentInteraction & MODAL_OPEN)) {
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
    isModalOpen: Boolean(interactionState & MODAL_OPEN),
    isInputFocused: Boolean(interactionState & INPUT_FOCUSED)
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
