import { useEffect, useRef, useState, useCallback } from 'react'

// ARIA utilities
export const generateAriaId = (prefix: string = 'aria'): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

export const createAriaDescribedBy = (ids: string[]): string => {
  return ids.filter(Boolean).join(' ')
}

// Keyboard navigation utilities
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown'
} as const

export type KeyboardKey = typeof KEYBOARD_KEYS[keyof typeof KEYBOARD_KEYS]

// Focus management hook
export const useFocusManagement = () => {
  const focusableElementsSelector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ')

  const getFocusableElements = useCallback((container: Element): HTMLElement[] => {
    return Array.from(container.querySelectorAll(focusableElementsSelector))
      .filter(el => {
        const style = window.getComputedStyle(el)
        return style.display !== 'none' && style.visibility !== 'hidden'
      }) as HTMLElement[]
  }, [focusableElementsSelector])

  const trapFocus = useCallback((container: Element) => {
    const focusableElements = getFocusableElements(container)
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent
      if (keyboardEvent.key === KEYBOARD_KEYS.TAB) {
        if (keyboardEvent.shiftKey) {
          if (document.activeElement === firstElement) {
            keyboardEvent.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            keyboardEvent.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [getFocusableElements])

  const restoreFocus = useCallback((element: HTMLElement | null) => {
    if (element && typeof element.focus === 'function') {
      element.focus()
    }
  }, [])

  return {
    getFocusableElements,
    trapFocus,
    restoreFocus
  }
}

// Focus trap hook for modals and dialogs
export const useFocusTrap = (isActive: boolean = true) => {
  const containerRef = useRef<HTMLElement>(null)
  const { trapFocus } = useFocusManagement()

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const cleanup = trapFocus(containerRef.current)
    
    // Focus the first focusable element
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    if (firstElement) {
      firstElement.focus()
    }

    return cleanup
  }, [isActive, trapFocus])

  return containerRef
}

// Keyboard navigation hook for lists and grids
export const useKeyboardNavigation = <T extends HTMLElement>(
  items: T[],
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both'
    wrap?: boolean
    onSelect?: (index: number, item: T) => void
  } = {}
) => {
  const { orientation = 'vertical', wrap = true, onSelect } = options
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    let newIndex = activeIndex

    switch (e.key) {
      case KEYBOARD_KEYS.ARROW_DOWN:
        if (orientation === 'vertical' || orientation === 'both') {
          e.preventDefault()
          newIndex = wrap 
            ? (activeIndex + 1) % items.length 
            : Math.min(activeIndex + 1, items.length - 1)
        }
        break

      case KEYBOARD_KEYS.ARROW_UP:
        if (orientation === 'vertical' || orientation === 'both') {
          e.preventDefault()
          newIndex = wrap 
            ? (activeIndex - 1 + items.length) % items.length 
            : Math.max(activeIndex - 1, 0)
        }
        break

      case KEYBOARD_KEYS.ARROW_RIGHT:
        if (orientation === 'horizontal' || orientation === 'both') {
          e.preventDefault()
          newIndex = wrap 
            ? (activeIndex + 1) % items.length 
            : Math.min(activeIndex + 1, items.length - 1)
        }
        break

      case KEYBOARD_KEYS.ARROW_LEFT:
        if (orientation === 'horizontal' || orientation === 'both') {
          e.preventDefault()
          newIndex = wrap 
            ? (activeIndex - 1 + items.length) % items.length 
            : Math.max(activeIndex - 1, 0)
        }
        break

      case KEYBOARD_KEYS.HOME:
        e.preventDefault()
        newIndex = 0
        break

      case KEYBOARD_KEYS.END:
        e.preventDefault()
        newIndex = items.length - 1
        break

      case KEYBOARD_KEYS.ENTER:
      case KEYBOARD_KEYS.SPACE:
        e.preventDefault()
        onSelect?.(activeIndex, items[activeIndex])
        break
    }

    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex)
      items[newIndex]?.focus()
    }
  }, [activeIndex, items, orientation, wrap, onSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    containerRef,
    activeIndex,
    setActiveIndex
  }
}

// Screen reader announcements
export const useScreenReader = () => {
  const announcementRef = useRef<HTMLDivElement>(null)

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcementRef.current) {
      // Create announcement element if it doesn't exist
      const element = document.createElement('div')
      element.setAttribute('aria-live', priority)
      element.setAttribute('aria-atomic', 'true')
      element.className = 'sr-only'
      element.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `
      document.body.appendChild(element)
      announcementRef.current = element
    }

    // Clear previous message and set new one
    announcementRef.current.textContent = ''
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = message
      }
    }, 100)
  }, [])

  useEffect(() => {
    return () => {
      if (announcementRef.current) {
        document.body.removeChild(announcementRef.current)
      }
    }
  }, [])

  return { announce }
}

// Skip link component utilities
export const createSkipLink = (targetId: string, text: string) => {
  return {
    href: `#${targetId}`,
    className: 'skip-link',
    children: text,
    onFocus: (e: React.FocusEvent) => {
      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
    },
    onBlur: (e: React.FocusEvent) => {
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-100%)'
    }
  }
}

// Color contrast utilities
export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0]
    const [r, g, b] = rgb.map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)

  return (brightest + 0.05) / (darkest + 0.05)
}

export const meetsWCAGContrast = (
  color1: string, 
  color2: string, 
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): boolean => {
  const ratio = getContrastRatio(color1, color2)
  
  if (level === 'AAA') {
    return size === 'large' ? ratio >= 4.5 : ratio >= 7
  } else {
    return size === 'large' ? ratio >= 3 : ratio >= 4.5
  }
}

// Reduced motion utilities
export const useReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

// ARIA live region hook
export const useAriaLiveRegion = (initialMessage: string = '') => {
  const [message, setMessage] = useState(initialMessage)
  const regionRef = useRef<HTMLDivElement>(null)

  const updateMessage = useCallback((newMessage: string, clear: boolean = true) => {
    setMessage(newMessage)
    
    if (clear) {
      setTimeout(() => setMessage(''), 1000)
    }
  }, [])

  return {
    regionRef,
    message,
    updateMessage,
    ariaLiveProps: {
      'aria-live': 'polite' as const,
      'aria-atomic': true,
      className: 'sr-only'
    }
  }
}

// Form accessibility utilities
export const useFormAccessibility = () => {
  const generateFieldId = useCallback((name: string): string => {
    return `field-${name}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  const generateErrorId = useCallback((fieldId: string): string => {
    return `${fieldId}-error`
  }, [])

  const generateHelpId = useCallback((fieldId: string): string => {
    return `${fieldId}-help`
  }, [])

  const getFieldProps = useCallback((
    name: string,
    options: {
      hasError?: boolean
      hasHelp?: boolean
      required?: boolean
      label?: string
    } = {}
  ) => {
    const { hasError, hasHelp, required, label } = options
    const fieldId = generateFieldId(name)
    const errorId = hasError ? generateErrorId(fieldId) : undefined
    const helpId = hasHelp ? generateHelpId(fieldId) : undefined

    return {
      fieldId,
      errorId,
      helpId,
      fieldProps: {
        id: fieldId,
        name,
        'aria-required': required,
        'aria-invalid': hasError,
        'aria-describedby': createAriaDescribedBy([errorId, helpId].filter((id): id is string => Boolean(id))),
        'aria-label': label
      },
      labelProps: {
        htmlFor: fieldId
      },
      errorProps: errorId ? {
        id: errorId,
        role: 'alert',
        'aria-live': 'polite' as const
      } : {},
      helpProps: helpId ? {
        id: helpId
      } : {}
    }
  }, [generateFieldId, generateErrorId, generateHelpId])

  return {
    generateFieldId,
    generateErrorId,
    generateHelpId,
    getFieldProps
  }
}

// High contrast mode detection
export const useHighContrastMode = (): boolean => {
  const [isHighContrast, setIsHighContrast] = useState(false)

  useEffect(() => {
    const checkHighContrast = () => {
      // Create a test element to detect high contrast mode
      const testElement = document.createElement('div')
      testElement.style.cssText = `
        position: absolute;
        left: -9999px;
        background-color: rgb(31, 31, 31);
        color: rgb(255, 255, 255);
      `
      document.body.appendChild(testElement)

      const computedStyle = window.getComputedStyle(testElement)
      const isHighContrastDetected = 
        computedStyle.backgroundColor !== 'rgb(31, 31, 31)' ||
        computedStyle.color !== 'rgb(255, 255, 255)'

      document.body.removeChild(testElement)
      setIsHighContrast(isHighContrastDetected)
    }

    checkHighContrast()

    // Listen for changes in system preferences
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    const handleChange = () => checkHighContrast()

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isHighContrast
}

// Accessibility testing utilities (for development)
export const a11yTestUtils = {
  // Check if element has accessible name
  hasAccessibleName: (element: Element): boolean => {
    return !!(
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      (element as HTMLElement).innerText?.trim() ||
      element.getAttribute('title')
    )
  },

  // Check if interactive element is keyboard accessible
  isKeyboardAccessible: (element: Element): boolean => {
    const tagName = element.tagName.toLowerCase()
    const tabIndex = element.getAttribute('tabindex')
    
    return (
      ['a', 'button', 'input', 'select', 'textarea'].includes(tagName) ||
      (tabIndex !== null && tabIndex !== '-1')
    )
  },

  // Check if element has sufficient color contrast
  checkColorContrast: (element: Element): boolean => {
    const style = window.getComputedStyle(element)
    const color = style.color
    const backgroundColor = style.backgroundColor
    
    if (color && backgroundColor) {
      return meetsWCAGContrast(color, backgroundColor)
    }
    
    return true // Can't determine, assume it's fine
  },

  // Generate accessibility report for an element
  generateA11yReport: (element: Element) => {
    return {
      hasAccessibleName: a11yTestUtils.hasAccessibleName(element),
      isKeyboardAccessible: a11yTestUtils.isKeyboardAccessible(element),
      hasGoodContrast: a11yTestUtils.checkColorContrast(element),
      hasAriaAttributes: element.getAttributeNames().some(attr => attr.startsWith('aria-')),
      isSemanticElement: ['button', 'a', 'input', 'select', 'textarea', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(element.tagName.toLowerCase())
    }
  }
}