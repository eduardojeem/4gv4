/**
 * Tests para usePOSUI hook
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePOSUI } from '../usePOSUI'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('usePOSUI', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('Modal Management', () => {
    it('should initialize with all modals closed', () => {
      const { result } = renderHook(() => usePOSUI())
      
      expect(result.current.state.showKeyboardShortcuts).toBe(false)
      expect(result.current.state.showAccessibilitySettings).toBe(false)
      expect(result.current.state.showCartDialog).toBe(false)
      expect(result.current.state.showReceiptModal).toBe(false)
      expect(result.current.state.variantSelectorOpen).toBe(false)
      expect(result.current.state.isRegisterManagerOpen).toBe(false)
      expect(result.current.state.isOpenRegisterDialogOpen).toBe(false)
      expect(result.current.state.isMovementDialogOpen).toBe(false)
    })

    it('should toggle keyboard shortcuts modal', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.toggleKeyboardShortcuts()
      })
      
      expect(result.current.state.showKeyboardShortcuts).toBe(true)
      
      act(() => {
        result.current.actions.toggleKeyboardShortcuts()
      })
      
      expect(result.current.state.showKeyboardShortcuts).toBe(false)
    })

    it('should open and close variant selector', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.openVariantSelector()
      })
      
      expect(result.current.state.variantSelectorOpen).toBe(true)
      
      act(() => {
        result.current.actions.closeVariantSelector()
      })
      
      expect(result.current.state.variantSelectorOpen).toBe(false)
    })

    it('should open and close register dialog with reset', () => {
      const { result } = renderHook(() => usePOSUI())
      
      // Set some values
      act(() => {
        result.current.actions.setOpeningAmount('1000')
        result.current.actions.setOpeningNote('Test note')
        result.current.actions.openRegisterDialog()
      })
      
      expect(result.current.state.isOpenRegisterDialogOpen).toBe(true)
      expect(result.current.state.openingAmount).toBe('1000')
      
      // Close should reset values
      act(() => {
        result.current.actions.closeRegisterDialog()
      })
      
      expect(result.current.state.isOpenRegisterDialogOpen).toBe(false)
      expect(result.current.state.openingAmount).toBe('0')
      expect(result.current.state.openingNote).toBe('')
    })

    it('should open movement dialog with correct type', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.openMovementDialog('in')
      })
      
      expect(result.current.state.isMovementDialogOpen).toBe(true)
      expect(result.current.state.movementType).toBe('in')
      
      act(() => {
        result.current.actions.closeMovementDialog()
      })
      
      act(() => {
        result.current.actions.openMovementDialog('out')
      })
      
      expect(result.current.state.movementType).toBe('out')
    })
  })

  describe('Layout Management', () => {
    it('should toggle sidebar', () => {
      const { result } = renderHook(() => usePOSUI())
      
      expect(result.current.state.sidebarCollapsed).toBe(false)
      
      act(() => {
        result.current.actions.toggleSidebar()
      })
      
      expect(result.current.state.sidebarCollapsed).toBe(true)
    })

    it('should persist sidebar state in localStorage', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.toggleSidebar()
      })
      
      const saved = JSON.parse(localStorageMock.getItem('pos.ui') || '{}')
      expect(saved.sidebarCollapsed).toBe(true)
    })

    it('should load sidebar state from localStorage', () => {
      localStorageMock.setItem('pos.ui', JSON.stringify({ sidebarCollapsed: true }))
      
      const { result } = renderHook(() => usePOSUI())
      
      expect(result.current.state.sidebarCollapsed).toBe(true)
    })
  })

  describe('Input Management', () => {
    it('should update barcode input', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.setBarcodeInput('1234567890')
      })
      
      expect(result.current.state.barcodeInput).toBe('1234567890')
    })

    it('should update opening amount and note', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.setOpeningAmount('5000')
        result.current.actions.setOpeningNote('Initial cash')
      })
      
      expect(result.current.state.openingAmount).toBe('5000')
      expect(result.current.state.openingNote).toBe('Initial cash')
    })

    it('should update movement inputs', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.setMovementAmount('1000')
        result.current.actions.setMovementNote('Cash withdrawal')
        result.current.actions.setMovementType('out')
      })
      
      expect(result.current.state.movementAmount).toBe('1000')
      expect(result.current.state.movementNote).toBe('Cash withdrawal')
      expect(result.current.state.movementType).toBe('out')
    })

    it('should reset movement inputs', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.setMovementAmount('1000')
        result.current.actions.setMovementNote('Test')
      })
      
      act(() => {
        result.current.actions.resetMovementInputs()
      })
      
      expect(result.current.state.movementAmount).toBe('')
      expect(result.current.state.movementNote).toBe('')
    })

    it('should reset register inputs', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.setOpeningAmount('5000')
        result.current.actions.setOpeningNote('Test')
        result.current.actions.setNewRegisterName('New Register')
      })
      
      act(() => {
        result.current.actions.resetRegisterInputs()
      })
      
      expect(result.current.state.openingAmount).toBe('0')
      expect(result.current.state.openingNote).toBe('')
      expect(result.current.state.newRegisterName).toBe('')
    })
  })

  describe('Register Management', () => {
    it('should start rename register', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.startRenameRegister('reg-1', 'Main Register')
      })
      
      expect(result.current.state.renameRegisterId).toBe('reg-1')
      expect(result.current.state.renameRegisterName).toBe('Main Register')
    })

    it('should cancel rename register', () => {
      const { result } = renderHook(() => usePOSUI())
      
      act(() => {
        result.current.actions.startRenameRegister('reg-1', 'Main Register')
      })
      
      act(() => {
        result.current.actions.cancelRenameRegister()
      })
      
      expect(result.current.state.renameRegisterId).toBe(null)
      expect(result.current.state.renameRegisterName).toBe('')
    })
  })

  describe('Fullscreen Management', () => {
    it('should handle fullscreen toggle', async () => {
      // Mock fullscreen API
      const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined)
      const mockExitFullscreen = vi.fn().mockResolvedValue(undefined)
      
      Object.defineProperty(document, 'fullscreenElement', {
        writable: true,
        value: null
      })
      
      Object.defineProperty(document.documentElement, 'requestFullscreen', {
        writable: true,
        value: mockRequestFullscreen
      })
      
      Object.defineProperty(document, 'exitFullscreen', {
        writable: true,
        value: mockExitFullscreen
      })
      
      const { result } = renderHook(() => usePOSUI())
      
      await act(async () => {
        await result.current.actions.toggleFullscreen()
      })
      
      expect(mockRequestFullscreen).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock localStorage to throw error
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error')
      })
      
      // Should not throw
      expect(() => renderHook(() => usePOSUI())).not.toThrow()
      
      expect(consoleWarnSpy).toHaveBeenCalled()
      
      consoleWarnSpy.mockRestore()
    })
  })
})
