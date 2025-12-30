'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Hook para gestión de foco en modales y diálogos
 * Implementa las mejores prácticas de accesibilidad para gestión de foco
 */
export const useFocusManagement = (isOpen: boolean, options?: {
  restoreFocus?: boolean
  focusFirstElement?: boolean
  trapFocus?: boolean
}) => {
  const previousFocus = useRef<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const firstFocusableRef = useRef<HTMLElement | null>(null)
  const lastFocusableRef = useRef<HTMLElement | null>(null)

  const {
    restoreFocus = true,
    focusFirstElement = true,
    trapFocus = true
  } = options || {}

  // Obtener elementos enfocables
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return []
    
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="link"]:not([disabled])'
    ].join(', ')

    return Array.from(containerRef.current.querySelectorAll(focusableSelectors)) as HTMLElement[]
  }, [])

  // Gestión de foco al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      // Guardar elemento activo antes de abrir
      previousFocus.current = document.activeElement as HTMLElement
      
      // Enfocar primer elemento si está habilitado
      if (focusFirstElement) {
        setTimeout(() => {
          const focusableElements = getFocusableElements()
          if (focusableElements.length > 0) {
            focusableElements[0].focus()
            firstFocusableRef.current = focusableElements[0]
            lastFocusableRef.current = focusableElements[focusableElements.length - 1]
          }
        }, 100)
      }
    } else {
      // Restaurar foco al cerrar
      if (restoreFocus && previousFocus.current) {
        previousFocus.current.focus()
      }
    }
  }, [isOpen, focusFirstElement, restoreFocus, getFocusableElements])

  // Trap de foco
  useEffect(() => {
    if (!isOpen || !trapFocus) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, trapFocus, getFocusableElements])

  return {
    containerRef,
    focusFirst: () => {
      const focusableElements = getFocusableElements()
      if (focusableElements.length > 0) {
        focusableElements[0].focus()
      }
    },
    focusLast: () => {
      const focusableElements = getFocusableElements()
      if (focusableElements.length > 0) {
        focusableElements[focusableElements.length - 1].focus()
      }
    }
  }
}

/**
 * Hook para anuncios dinámicos a lectores de pantalla
 * Gestiona regiones live para comunicar cambios de estado
 */
export const useLiveRegion = () => {
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const announce = useCallback((
    newMessage: string, 
    newPriority: 'polite' | 'assertive' = 'polite',
    clearAfter = 3000
  ) => {
    setMessage(newMessage)
    setPriority(newPriority)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (clearAfter > 0) {
      timeoutRef.current = setTimeout(() => {
        setMessage('')
      }, clearAfter)
    }
  }, [])

  const clear = useCallback(() => {
    setMessage('')
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    message,
    priority,
    announce,
    clear
  }
}

/**
 * Hook para navegación por teclado en grids y listas
 * Implementa roving tabindex para navegación eficiente
 */
export const useRovingTabIndex = (itemCount: number, options?: {
  orientation?: 'horizontal' | 'vertical' | 'both'
  wrap?: boolean
  disabled?: boolean
}) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  
  const {
    orientation = 'both',
    wrap = true,
    disabled = false
  } = options || {}

  // Actualizar refs cuando cambia el número de elementos
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, itemCount)
  }, [itemCount])

  const focusItem = useCallback((index: number) => {
    if (index >= 0 && index < itemCount && itemRefs.current[index]) {
      itemRefs.current[index]?.focus()
      setActiveIndex(index)
    }
  }, [itemCount])

  const handleKeyDown = useCallback((event: KeyboardEvent, currentIndex: number) => {
    if (disabled) return

    let newIndex = currentIndex
    let handled = false

    switch (event.key) {
      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'both') {
          newIndex = currentIndex + 1
          if (newIndex >= itemCount) {
            newIndex = wrap ? 0 : itemCount - 1
          }
          handled = true
        }
        break

      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'both') {
          newIndex = currentIndex - 1
          if (newIndex < 0) {
            newIndex = wrap ? itemCount - 1 : 0
          }
          handled = true
        }
        break

      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'both') {
          newIndex = currentIndex + 1
          if (newIndex >= itemCount) {
            newIndex = wrap ? 0 : itemCount - 1
          }
          handled = true
        }
        break

      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'both') {
          newIndex = currentIndex - 1
          if (newIndex < 0) {
            newIndex = wrap ? itemCount - 1 : 0
          }
          handled = true
        }
        break

      case 'Home':
        newIndex = 0
        handled = true
        break

      case 'End':
        newIndex = itemCount - 1
        handled = true
        break
    }

    if (handled) {
      event.preventDefault()
      focusItem(newIndex)
    }
  }, [disabled, orientation, wrap, itemCount, focusItem])

  const getItemProps = useCallback((index: number) => ({
    ref: (el: HTMLElement | null) => {
      itemRefs.current[index] = el
    },
    tabIndex: index === activeIndex ? 0 : -1,
    onKeyDown: (event: React.KeyboardEvent) => handleKeyDown(event.nativeEvent, index),
    onFocus: () => setActiveIndex(index)
  }), [activeIndex, handleKeyDown])

  return {
    activeIndex,
    setActiveIndex,
    focusItem,
    getItemProps
  }
}

/**
 * Hook para validación de accesibilidad en tiempo real
 * Detecta problemas comunes de accesibilidad
 */
export const useAccessibilityValidation = (containerRef: React.RefObject<HTMLElement>) => {
  const [issues, setIssues] = useState<Array<{
    type: string
    message: string
    severity: 'error' | 'warning' | 'info'
    element?: HTMLElement
  }>>([])

  const validateAccessibility = useCallback(() => {
    if (!containerRef.current) return

    const newIssues: typeof issues = []
    const container = containerRef.current

    // Verificar imágenes sin alt
    const images = container.querySelectorAll('img')
    images.forEach((img) => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        newIssues.push({
          type: 'missing-alt',
          message: 'Imagen sin texto alternativo',
          severity: 'error',
          element: img
        })
      }
    })

    // Verificar botones sin etiquetas
    const buttons = container.querySelectorAll('button')
    buttons.forEach((button) => {
      const hasText = button.textContent?.trim()
      const hasAriaLabel = button.getAttribute('aria-label')
      const hasAriaLabelledby = button.getAttribute('aria-labelledby')
      
      if (!hasText && !hasAriaLabel && !hasAriaLabelledby) {
        newIssues.push({
          type: 'missing-button-label',
          message: 'Botón sin etiqueta accesible',
          severity: 'error',
          element: button
        })
      }
    })

    // Verificar inputs sin labels
    const inputs = container.querySelectorAll('input, select, textarea')
    inputs.forEach((input) => {
      const hasLabel = container.querySelector(`label[for="${input.id}"]`)
      const hasAriaLabel = input.getAttribute('aria-label')
      const hasAriaLabelledby = input.getAttribute('aria-labelledby')
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
        newIssues.push({
          type: 'missing-input-label',
          message: 'Campo de formulario sin etiqueta',
          severity: 'error',
          element: input as HTMLElement
        })
      }
    })

    // Verificar contraste de color (básico)
    const elementsWithBackground = container.querySelectorAll('[style*="background"], [style*="color"]')
    elementsWithBackground.forEach((element) => {
      // Esta es una verificación básica, en producción se usaría una librería especializada
      const style = window.getComputedStyle(element)
      const backgroundColor = style.backgroundColor
      const color = style.color
      
      if (backgroundColor && color && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        newIssues.push({
          type: 'contrast-check',
          message: 'Verificar contraste de color manualmente',
          severity: 'info',
          element: element as HTMLElement
        })
      }
    })

    setIssues(newIssues)
  }, [containerRef])

  useEffect(() => {
    validateAccessibility()
    
    // Re-validar cuando cambie el contenido
    const observer = new MutationObserver(validateAccessibility)
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true
      })
    }

    return () => observer.disconnect()
  }, [validateAccessibility])

  return {
    issues,
    validateAccessibility,
    hasErrors: issues.some(issue => issue.severity === 'error'),
    hasWarnings: issues.some(issue => issue.severity === 'warning')
  }
}

/**
 * Hook para shortcuts de teclado accesibles
 * Gestiona combinaciones de teclas con anuncios apropiados
 */
export const useKeyboardShortcuts = (shortcuts: Array<{
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  action: () => void
  description: string
  disabled?: boolean
}>) => {
  const { announce } = useLiveRegion()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchingShortcut = shortcuts.find(shortcut => {
        if (shortcut.disabled) return false
        
        return (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!event.ctrlKey === !!shortcut.ctrlKey &&
          !!event.altKey === !!shortcut.altKey &&
          !!event.shiftKey === !!shortcut.shiftKey
        )
      })

      if (matchingShortcut) {
        event.preventDefault()
        matchingShortcut.action()
        announce(`Ejecutado: ${matchingShortcut.description}`, 'polite')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, announce])

  const getShortcutDescription = useCallback(() => {
    return shortcuts
      .filter(s => !s.disabled)
      .map(s => {
        const keys = []
        if (s.ctrlKey) keys.push('Ctrl')
        if (s.altKey) keys.push('Alt')
        if (s.shiftKey) keys.push('Shift')
        keys.push(s.key.toUpperCase())
        
        return `${keys.join(' + ')}: ${s.description}`
      })
      .join(', ')
  }, [shortcuts])

  return {
    getShortcutDescription
  }
}

/**
 * Componente LiveRegion para anuncios
 */
export const LiveRegion: React.FC<{
  message: string
  priority?: 'polite' | 'assertive'
  className?: string
}> = ({ message, priority = 'polite', className = 'sr-only' }) => {
  return React.createElement('div', {
    'aria-live': priority,
    'aria-atomic': 'true',
    className,
    role: 'status'
  }, message)
}

/**
 * Hook combinado para accesibilidad completa
 */
export const useAccessibilityEnhancements = (options?: {
  enableFocusManagement?: boolean
  enableLiveRegion?: boolean
  enableKeyboardNavigation?: boolean
  enableValidation?: boolean
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const {
    enableFocusManagement = true,
    enableLiveRegion = true,
    enableKeyboardNavigation = true,
    enableValidation = true
  } = options || {}

  const focusManagement = useFocusManagement(true, {
    restoreFocus: enableFocusManagement,
    focusFirstElement: enableFocusManagement,
    trapFocus: enableFocusManagement
  })

  const liveRegion = useLiveRegion()
  
  const validation = useAccessibilityValidation(
    enableValidation ? containerRef as React.RefObject<HTMLElement> : { current: null } as unknown as React.RefObject<HTMLElement>
  )

  return {
    containerRef: enableFocusManagement ? focusManagement.containerRef : containerRef,
    focusManagement: enableFocusManagement ? focusManagement : null,
    liveRegion: enableLiveRegion ? liveRegion : null,
    validation: enableValidation ? validation : null,
    announce: enableLiveRegion ? liveRegion.announce : () => {},
    LiveRegion: enableLiveRegion ? LiveRegion : () => null
  }
}