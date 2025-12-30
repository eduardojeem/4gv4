'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useCriticalDebounce } from '@/lib/critical-performance'

export interface BarcodeResult {
  code: string
  timestamp: Date
  source: 'scanner' | 'manual' | 'camera'
}

export interface BarcodeScannerOptions {
  enableKeyboardScanner?: boolean
  enableManualInput?: boolean
  enableCameraScanner?: boolean
  scanTimeout?: number
  minBarcodeLength?: number
  maxBarcodeLength?: number
  allowedCharacters?: RegExp
  onScan?: (result: BarcodeResult) => void
  onError?: (error: string) => void
}

export interface BarcodeScannerReturn {
  isScanning: boolean
  lastScan: BarcodeResult | null
  scanHistory: BarcodeResult[]
  manualInput: string
  
  // Funciones
  startScanning: () => void
  stopScanning: () => void
  setManualInput: (value: string) => void
  submitManualInput: () => void
  clearHistory: () => void
  
  // Estado del escáner
  scannerStatus: 'idle' | 'scanning' | 'processing' | 'error'
  errorMessage: string | null
}

const DEFAULT_OPTIONS: Required<BarcodeScannerOptions> = {
  enableKeyboardScanner: true,
  enableManualInput: true,
  enableCameraScanner: false,
  scanTimeout: 100,
  minBarcodeLength: 4,
  maxBarcodeLength: 20,
  allowedCharacters: /^[0-9A-Za-z\-_]+$/,
  onScan: () => {},
  onError: () => {}
}

export function useBarcodeScanner(options: BarcodeScannerOptions = {}): BarcodeScannerReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const [isScanning, setIsScanning] = useState(false)
  const [lastScan, setLastScan] = useState<BarcodeResult | null>(null)
  const [scanHistory, setScanHistory] = useState<BarcodeResult[]>([])
  const [manualInput, setManualInput] = useState('')
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'scanning' | 'processing' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Referencias para el escáner de teclado
  const scanBufferRef = useRef('')
  const lastKeypressRef = useRef(0)
  const scanTimeoutRef = useRef<NodeJS.Timeout>()

  // Debounce para entrada manual
  const debouncedManualInput = useCriticalDebounce(manualInput, 300)

  // Validar código de barras
  const validateBarcode = useCallback((code: string): boolean => {
    if (code.length < opts.minBarcodeLength || code.length > opts.maxBarcodeLength) {
      return false
    }
    
    if (!opts.allowedCharacters.test(code)) {
      return false
    }
    
    return true
  }, [opts.minBarcodeLength, opts.maxBarcodeLength, opts.allowedCharacters])

  // Procesar escaneo
  const processScan = useCallback((code: string, source: 'scanner' | 'manual' | 'camera') => {
    setScannerStatus('processing')
    setErrorMessage(null)

    if (!validateBarcode(code)) {
      const error = `Código de barras inválido: ${code}`
      setErrorMessage(error)
      setScannerStatus('error')
      opts.onError(error)
      return
    }

    const result: BarcodeResult = {
      code: code.trim(),
      timestamp: new Date(),
      source
    }

    setLastScan(result)
    setScanHistory(prev => [result, ...prev.slice(0, 49)]) // Mantener últimos 50
    setScannerStatus('idle')
    
    opts.onScan(result)
  }, [validateBarcode, opts])

  // Manejar entrada de teclado (escáner físico)
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!isScanning || !opts.enableKeyboardScanner) return

    const now = Date.now()
    const timeDiff = now - lastKeypressRef.current

    // Si ha pasado mucho tiempo, reiniciar buffer
    if (timeDiff > opts.scanTimeout) {
      scanBufferRef.current = ''
    }

    lastKeypressRef.current = now

    // Enter indica fin de escaneo
    if (event.key === 'Enter') {
      event.preventDefault()
      
      if (scanBufferRef.current.length > 0) {
        processScan(scanBufferRef.current, 'scanner')
        scanBufferRef.current = ''
      }
      return
    }

    // Acumular caracteres
    if (event.key && event.key.length === 1) {
      scanBufferRef.current += event.key
      
      // Limpiar buffer después del timeout
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
      
      scanTimeoutRef.current = setTimeout(() => {
        scanBufferRef.current = ''
      }, opts.scanTimeout * 2)
    }
  }, [isScanning, opts.enableKeyboardScanner, opts.scanTimeout, processScan])

  // Iniciar escaneo
  const startScanning = useCallback(() => {
    setIsScanning(true)
    setScannerStatus('scanning')
    setErrorMessage(null)
    scanBufferRef.current = ''
  }, [])

  // Detener escaneo
  const stopScanning = useCallback(() => {
    setIsScanning(false)
    setScannerStatus('idle')
    scanBufferRef.current = ''
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }
  }, [])

  // Enviar entrada manual
  const submitManualInput = useCallback(() => {
    if (manualInput.trim()) {
      processScan(manualInput.trim(), 'manual')
      setManualInput('')
    }
  }, [manualInput, processScan])

  // Limpiar historial
  const clearHistory = useCallback(() => {
    setScanHistory([])
    setLastScan(null)
  }, [])

  // Configurar listeners de teclado
  useEffect(() => {
    if (isScanning && opts.enableKeyboardScanner) {
      document.addEventListener('keydown', handleKeyPress)
      
      return () => {
        document.removeEventListener('keydown', handleKeyPress)
      }
    }
  }, [isScanning, opts.enableKeyboardScanner, handleKeyPress])

  // Auto-envío de entrada manual cuando se detiene de escribir
  useEffect(() => {
    if (opts.enableManualInput && debouncedManualInput && debouncedManualInput !== manualInput) {
      // Solo auto-enviar si parece un código válido
      if (validateBarcode(debouncedManualInput)) {
        processScan(debouncedManualInput, 'manual')
        setManualInput('')
      }
    }
  }, [debouncedManualInput, manualInput, opts.enableManualInput, validateBarcode, processScan])

  // Cleanup
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
    }
  }, [])

  return {
    isScanning,
    lastScan,
    scanHistory,
    manualInput,
    startScanning,
    stopScanning,
    setManualInput,
    submitManualInput,
    clearHistory,
    scannerStatus,
    errorMessage
  }
}

// Hook simplificado para POS
export function usePOSBarcodeScanner(onProductFound: (barcode: string) => void) {
  return useBarcodeScanner({
    enableKeyboardScanner: true,
    enableManualInput: true,
    enableCameraScanner: false,
    scanTimeout: 50, // Más rápido para POS
    minBarcodeLength: 6,
    maxBarcodeLength: 18,
    onScan: (result) => {
      onProductFound(result.code)
    },
    onError: (error) => {
      console.warn('Error en escáner:', error)
    }
  })
}