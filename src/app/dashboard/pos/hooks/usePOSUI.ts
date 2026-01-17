/**
 * Hook para gestionar el estado de UI del POS
 * Centraliza modales, sidebar, fullscreen, etc.
 */

import { useState, useCallback, useEffect } from 'react'

export interface POSUIState {
  // Modales
  showKeyboardShortcuts: boolean
  showAccessibilitySettings: boolean
  showCartDialog: boolean
  showReceiptModal: boolean
  variantSelectorOpen: boolean
  isRegisterManagerOpen: boolean
  isOpenRegisterDialogOpen: boolean
  isMovementDialogOpen: boolean
  
  // Layout
  sidebarCollapsed: boolean
  isFullscreen: boolean
  
  // Inputs temporales
  barcodeInput: string
  openingAmount: string
  openingNote: string
  movementAmount: string
  movementNote: string
  movementType: 'in' | 'out'
  
  // Gestión de cajas
  newRegisterName: string
  renameRegisterId: string | null
  renameRegisterName: string
}

export interface POSUIActions {
  // Modales
  toggleKeyboardShortcuts: () => void
  toggleAccessibilitySettings: () => void
  toggleCartDialog: () => void
  toggleReceiptModal: () => void
  openVariantSelector: () => void
  closeVariantSelector: () => void
  openRegisterManager: () => void
  closeRegisterManager: () => void
  openRegisterDialog: () => void
  closeRegisterDialog: () => void
  openMovementDialog: (type: 'in' | 'out') => void
  closeMovementDialog: () => void
  
  // Layout
  toggleSidebar: () => void
  toggleFullscreen: () => void
  
  // Inputs
  setBarcodeInput: (value: string) => void
  setOpeningAmount: (value: string) => void
  setOpeningNote: (value: string) => void
  setMovementAmount: (value: string) => void
  setMovementNote: (value: string) => void
  setMovementType: (type: 'in' | 'out') => void
  
  // Gestión de cajas
  setNewRegisterName: (name: string) => void
  startRenameRegister: (id: string, currentName: string) => void
  cancelRenameRegister: () => void
  
  // Utilidades
  resetMovementInputs: () => void
  resetRegisterInputs: () => void
}

export interface POSUIResult {
  state: POSUIState
  actions: POSUIActions
}

const DEFAULT_STATE: POSUIState = {
  showKeyboardShortcuts: false,
  showAccessibilitySettings: false,
  showCartDialog: false,
  showReceiptModal: false,
  variantSelectorOpen: false,
  isRegisterManagerOpen: false,
  isOpenRegisterDialogOpen: false,
  isMovementDialogOpen: false,
  sidebarCollapsed: false,
  isFullscreen: false,
  barcodeInput: '',
  openingAmount: '0',
  openingNote: '',
  movementAmount: '',
  movementNote: '',
  movementType: 'out',
  newRegisterName: '',
  renameRegisterId: null,
  renameRegisterName: ''
}

export function usePOSUI(): POSUIResult {
  // Estados de modales
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(DEFAULT_STATE.showKeyboardShortcuts)
  const [showAccessibilitySettings, setShowAccessibilitySettings] = useState(DEFAULT_STATE.showAccessibilitySettings)
  const [showCartDialog, setShowCartDialog] = useState(DEFAULT_STATE.showCartDialog)
  const [showReceiptModal, setShowReceiptModal] = useState(DEFAULT_STATE.showReceiptModal)
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(DEFAULT_STATE.variantSelectorOpen)
  const [isRegisterManagerOpen, setIsRegisterManagerOpen] = useState(DEFAULT_STATE.isRegisterManagerOpen)
  const [isOpenRegisterDialogOpen, setIsOpenRegisterDialogOpen] = useState(DEFAULT_STATE.isOpenRegisterDialogOpen)
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(DEFAULT_STATE.isMovementDialogOpen)
  
  // Estados de layout
  const [sidebarCollapsed, setSidebarCollapsed] = useState(DEFAULT_STATE.sidebarCollapsed)
  const [isFullscreen, setIsFullscreen] = useState(DEFAULT_STATE.isFullscreen)
  
  // Estados de inputs
  const [barcodeInput, setBarcodeInput] = useState(DEFAULT_STATE.barcodeInput)
  const [openingAmount, setOpeningAmount] = useState(DEFAULT_STATE.openingAmount)
  const [openingNote, setOpeningNote] = useState(DEFAULT_STATE.openingNote)
  const [movementAmount, setMovementAmount] = useState(DEFAULT_STATE.movementAmount)
  const [movementNote, setMovementNote] = useState(DEFAULT_STATE.movementNote)
  const [movementType, setMovementType] = useState<'in' | 'out'>(DEFAULT_STATE.movementType)
  
  // Estados de gestión de cajas
  const [newRegisterName, setNewRegisterName] = useState(DEFAULT_STATE.newRegisterName)
  const [renameRegisterId, setRenameRegisterId] = useState<string | null>(DEFAULT_STATE.renameRegisterId)
  const [renameRegisterName, setRenameRegisterName] = useState(DEFAULT_STATE.renameRegisterName)

  // Cargar preferencias de UI
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedUI = localStorage.getItem('pos.ui')
      if (savedUI) {
        const ui = JSON.parse(savedUI)
        if (typeof ui.sidebarCollapsed === 'boolean') setSidebarCollapsed(ui.sidebarCollapsed)
      }
    } catch (e) {
      console.warn('Error loading UI preferences:', e)
    }
  }, [])

  // Guardar preferencias de UI
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const ui = { sidebarCollapsed }
      localStorage.setItem('pos.ui', JSON.stringify(ui))
    } catch (e) {
      console.error('Error saving UI preferences:', e)
    }
  }, [sidebarCollapsed])

  // Gestión de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Acciones
  const toggleKeyboardShortcuts = useCallback(() => setShowKeyboardShortcuts(prev => !prev), [])
  const toggleAccessibilitySettings = useCallback(() => setShowAccessibilitySettings(prev => !prev), [])
  const toggleCartDialog = useCallback(() => setShowCartDialog(prev => !prev), [])
  const toggleReceiptModal = useCallback(() => setShowReceiptModal(prev => !prev), [])
  
  const openVariantSelector = useCallback(() => setVariantSelectorOpen(true), [])
  const closeVariantSelector = useCallback(() => setVariantSelectorOpen(false), [])
  
  const openRegisterManager = useCallback(() => setIsRegisterManagerOpen(true), [])
  const closeRegisterManager = useCallback(() => setIsRegisterManagerOpen(false), [])
  
  const openRegisterDialog = useCallback(() => setIsOpenRegisterDialogOpen(true), [])
  const closeRegisterDialog = useCallback(() => {
    setIsOpenRegisterDialogOpen(false)
    setOpeningAmount('0')
    setOpeningNote('')
  }, [])
  
  const openMovementDialog = useCallback((type: 'in' | 'out') => {
    setMovementType(type)
    setIsMovementDialogOpen(true)
  }, [])
  
  const closeMovementDialog = useCallback(() => {
    setIsMovementDialogOpen(false)
    setMovementAmount('')
    setMovementNote('')
  }, [])
  
  const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), [])
  
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (e) {
      console.error('Error toggling fullscreen:', e)
    }
  }, [])
  
  const startRenameRegister = useCallback((id: string, currentName: string) => {
    setRenameRegisterId(id)
    setRenameRegisterName(currentName)
  }, [])
  
  const cancelRenameRegister = useCallback(() => {
    setRenameRegisterId(null)
    setRenameRegisterName('')
  }, [])
  
  const resetMovementInputs = useCallback(() => {
    setMovementAmount('')
    setMovementNote('')
  }, [])
  
  const resetRegisterInputs = useCallback(() => {
    setOpeningAmount('0')
    setOpeningNote('')
    setNewRegisterName('')
  }, [])

  return {
    state: {
      showKeyboardShortcuts,
      showAccessibilitySettings,
      showCartDialog,
      showReceiptModal,
      variantSelectorOpen,
      isRegisterManagerOpen,
      isOpenRegisterDialogOpen,
      isMovementDialogOpen,
      sidebarCollapsed,
      isFullscreen,
      barcodeInput,
      openingAmount,
      openingNote,
      movementAmount,
      movementNote,
      movementType,
      newRegisterName,
      renameRegisterId,
      renameRegisterName
    },
    actions: {
      toggleKeyboardShortcuts,
      toggleAccessibilitySettings,
      toggleCartDialog,
      toggleReceiptModal,
      openVariantSelector,
      closeVariantSelector,
      openRegisterManager,
      closeRegisterManager,
      openRegisterDialog,
      closeRegisterDialog,
      openMovementDialog,
      closeMovementDialog,
      toggleSidebar,
      toggleFullscreen,
      setBarcodeInput,
      setOpeningAmount,
      setOpeningNote,
      setMovementAmount,
      setMovementNote,
      setMovementType,
      setNewRegisterName,
      startRenameRegister,
      cancelRenameRegister,
      resetMovementInputs,
      resetRegisterInputs
    }
  }
}
