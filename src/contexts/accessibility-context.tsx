'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface AccessibilityContextType {
  highContrast: boolean
  toggleHighContrast: () => void
  fontSize: 'normal' | 'large' | 'extra-large'
  setFontSize: (size: 'normal' | 'large' | 'extra-large') => void
  reducedMotion: boolean
  toggleReducedMotion: () => void
  screenReaderMode: boolean
  toggleScreenReaderMode: () => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

const storedBoolean = (key: string, fallback = false) => {
  if (typeof window === 'undefined') return fallback
  const saved = localStorage.getItem(key)
  if (saved !== null) return saved === 'true'
  return fallback
}

const storedFontSize = (): 'normal' | 'large' | 'extra-large' => {
  if (typeof window === 'undefined') return 'normal'
  const saved = localStorage.getItem('accessibility-font-size')
  return saved === 'large' || saved === 'extra-large' ? saved : 'normal'
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [highContrast, setHighContrast] = useState(() => storedBoolean(
    'accessibility-high-contrast', typeof window !== 'undefined' && window.matchMedia('(prefers-contrast: high)').matches))
  const [fontSize, setFontSize] = useState(storedFontSize)
  const [reducedMotion, setReducedMotion] = useState(() => storedBoolean(
    'accessibility-reduced-motion', typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches))
  const [screenReaderMode, setScreenReaderMode] = useState(() => storedBoolean('accessibility-screen-reader'))

  // Aplicar clases CSS cuando cambian las preferencias
  useEffect(() => {
    const root = document.documentElement
    
    if (highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    root.classList.remove('font-normal', 'font-large', 'font-extra-large')
    root.classList.add(`font-${fontSize}`)

    if (reducedMotion) {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }

    if (screenReaderMode) {
      root.classList.add('screen-reader-mode')
    } else {
      root.classList.remove('screen-reader-mode')
    }
  }, [highContrast, fontSize, reducedMotion, screenReaderMode])

  const toggleHighContrast = () => {
    const newValue = !highContrast
    setHighContrast(newValue)
    localStorage.setItem('accessibility-high-contrast', newValue.toString())
  }

  const handleSetFontSize = (size: 'normal' | 'large' | 'extra-large') => {
    setFontSize(size)
    localStorage.setItem('accessibility-font-size', size)
  }

  const toggleReducedMotion = () => {
    const newValue = !reducedMotion
    setReducedMotion(newValue)
    localStorage.setItem('accessibility-reduced-motion', newValue.toString())
  }

  const toggleScreenReaderMode = () => {
    const newValue = !screenReaderMode
    setScreenReaderMode(newValue)
    localStorage.setItem('accessibility-screen-reader', newValue.toString())
  }

  return (
    <AccessibilityContext.Provider value={{
      highContrast,
      toggleHighContrast,
      fontSize,
      setFontSize: handleSetFontSize,
      reducedMotion,
      toggleReducedMotion,
      screenReaderMode,
      toggleScreenReaderMode
    }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider')
  }
  return context
}
