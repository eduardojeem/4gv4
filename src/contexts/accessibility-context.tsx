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

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [highContrast, setHighContrast] = useState(false)
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extra-large'>('normal')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [screenReaderMode, setScreenReaderMode] = useState(false)

  // Cargar preferencias guardadas
  useEffect(() => {
    const savedHighContrast = localStorage.getItem('accessibility-high-contrast') === 'true'
    const savedFontSize = localStorage.getItem('accessibility-font-size') as 'normal' | 'large' | 'extra-large' || 'normal'
    const savedReducedMotion = localStorage.getItem('accessibility-reduced-motion') === 'true'
    const savedScreenReaderMode = localStorage.getItem('accessibility-screen-reader') === 'true'

    setHighContrast(savedHighContrast)
    setFontSize(savedFontSize)
    setReducedMotion(savedReducedMotion)
    setScreenReaderMode(savedScreenReaderMode)

    // Detectar preferencias del sistema
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches

    if (prefersReducedMotion && !localStorage.getItem('accessibility-reduced-motion')) {
      setReducedMotion(true)
    }

    if (prefersHighContrast && !localStorage.getItem('accessibility-high-contrast')) {
      setHighContrast(true)
    }
  }, [])

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