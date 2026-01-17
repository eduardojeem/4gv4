/**
 * Utilidades de accesibilidad para el POS
 * Mejora la experiencia para usuarios con discapacidades
 */

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  description: string
  action: () => void
  category: 'navigation' | 'actions' | 'search' | 'cart'
}

export class AccessibilityManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private announcer: HTMLDivElement | null = null
  private focusTrap: HTMLElement | null = null

  constructor() {
    this.initAnnouncer()
  }

  /**
   * Inicializa el anunciador de pantalla (screen reader)
   */
  private initAnnouncer(): void {
    if (typeof document === 'undefined') return

    this.announcer = document.createElement('div')
    this.announcer.setAttribute('role', 'status')
    this.announcer.setAttribute('aria-live', 'polite')
    this.announcer.setAttribute('aria-atomic', 'true')
    this.announcer.className = 'sr-only'
    this.announcer.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `
    document.body.appendChild(this.announcer)
  }

  /**
   * Anuncia un mensaje para lectores de pantalla
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.announcer) return

    this.announcer.setAttribute('aria-live', priority)
    this.announcer.textContent = message

    // Limpiar después de 1 segundo
    setTimeout(() => {
      if (this.announcer) {
        this.announcer.textContent = ''
      }
    }, 1000)
  }

  /**
   * Registra un atajo de teclado
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut)
    this.shortcuts.set(key, shortcut)
  }

  /**
   * Desregistra un atajo de teclado
   */
  unregisterShortcut(key: string): void {
    this.shortcuts.delete(key)
  }

  /**
   * Obtiene la clave única del atajo
   */
  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const parts = []
    if (shortcut.ctrl) parts.push('ctrl')
    if (shortcut.alt) parts.push('alt')
    if (shortcut.shift) parts.push('shift')
    parts.push(shortcut.key.toLowerCase())
    return parts.join('+')
  }

  /**
   * Maneja eventos de teclado
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    const key = this.getShortcutKey({
      key: event.key,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      description: '',
      action: () => {},
      category: 'navigation'
    })

    const shortcut = this.shortcuts.get(key)
    if (shortcut) {
      event.preventDefault()
      shortcut.action()
      this.announce(`Atajo activado: ${shortcut.description}`)
      return true
    }

    return false
  }

  /**
   * Obtiene todos los atajos registrados
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * Obtiene atajos por categoría
   */
  getShortcutsByCategory(category: KeyboardShortcut['category']): KeyboardShortcut[] {
    return this.getShortcuts().filter(s => s.category === category)
  }

  /**
   * Crea una trampa de foco para modales
   */
  createFocusTrap(element: HTMLElement): () => void {
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    element.addEventListener('keydown', handleTabKey)

    // Enfocar el primer elemento
    firstElement?.focus()

    // Retornar función de limpieza
    return () => {
      element.removeEventListener('keydown', handleTabKey)
    }
  }

  /**
   * Verifica el contraste de colores
   */
  checkColorContrast(foreground: string, background: string): {
    ratio: number
    passesAA: boolean
    passesAAA: boolean
  } {
    const fg = this.hexToRgb(foreground)
    const bg = this.hexToRgb(background)

    if (!fg || !bg) {
      return { ratio: 0, passesAA: false, passesAAA: false }
    }

    const fgLuminance = this.getRelativeLuminance(fg)
    const bgLuminance = this.getRelativeLuminance(bg)

    const ratio = (Math.max(fgLuminance, bgLuminance) + 0.05) /
                  (Math.min(fgLuminance, bgLuminance) + 0.05)

    return {
      ratio: Math.round(ratio * 100) / 100,
      passesAA: ratio >= 4.5,
      passesAAA: ratio >= 7
    }
  }

  /**
   * Convierte hex a RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  /**
   * Calcula la luminancia relativa
   */
  private getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
    const rsRGB = rgb.r / 255
    const gsRGB = rgb.g / 255
    const bsRGB = rgb.b / 255

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4)
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4)
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4)

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  /**
   * Limpia recursos
   */
  cleanup(): void {
    if (this.announcer && this.announcer.parentNode) {
      this.announcer.parentNode.removeChild(this.announcer)
    }
    this.shortcuts.clear()
  }
}

// Singleton instance
let accessibilityManagerInstance: AccessibilityManager | null = null

export function getAccessibilityManager(): AccessibilityManager {
  if (!accessibilityManagerInstance) {
    accessibilityManagerInstance = new AccessibilityManager()
  }
  return accessibilityManagerInstance
}

export function resetAccessibilityManager(): void {
  if (accessibilityManagerInstance) {
    accessibilityManagerInstance.cleanup()
  }
  accessibilityManagerInstance = null
}

/**
 * Hook para usar el gestor de accesibilidad
 */
export function useAccessibility() {
  const manager = getAccessibilityManager()

  const announce = (message: string, priority?: 'polite' | 'assertive') => {
    manager.announce(message, priority)
  }

  const registerShortcut = (shortcut: KeyboardShortcut) => {
    manager.registerShortcut(shortcut)
  }

  const createFocusTrap = (element: HTMLElement) => {
    return manager.createFocusTrap(element)
  }

  return {
    announce,
    registerShortcut,
    createFocusTrap,
    getShortcuts: () => manager.getShortcuts(),
    getShortcutsByCategory: (category: KeyboardShortcut['category']) =>
      manager.getShortcutsByCategory(category)
  }
}
