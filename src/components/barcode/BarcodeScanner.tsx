'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, Keyboard, History, X, Check, AlertCircle, Zap } from 'lucide-react'
import { useBarcodeScanner, BarcodeResult } from '@/hooks/useBarcodeScanner'
import { cn } from '@/lib/utils'

interface BarcodeScannerProps {
  onScan?: (result: BarcodeResult) => void
  onError?: (error: string) => void
  className?: string
  compact?: boolean
  showHistory?: boolean
  autoStart?: boolean
}

export function BarcodeScanner({
  onScan,
  onError,
  className,
  compact = false,
  showHistory = true,
  autoStart = false
}: BarcodeScannerProps) {
  const {
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
  } = useBarcodeScanner({
    onScan,
    onError
  })

  React.useEffect(() => {
    if (autoStart) {
      startScanning()
    }
  }, [autoStart, startScanning])

  const getStatusColor = () => {
    switch (scannerStatus) {
      case 'scanning': return 'text-blue-500'
      case 'processing': return 'text-yellow-500'
      case 'error': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusIcon = () => {
    switch (scannerStatus) {
      case 'scanning': return <Zap className="w-4 h-4 animate-pulse" />
      case 'processing': return <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Scan className="w-4 h-4" /></motion.div>
      case 'error': return <AlertCircle className="w-4 h-4" />
      default: return <Scan className="w-4 h-4" />
    }
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={isScanning ? stopScanning : startScanning}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all",
            isScanning 
              ? "bg-red-500 hover:bg-red-600 text-white" 
              : "bg-blue-500 hover:bg-blue-600 text-white"
          )}
        >
          {getStatusIcon()}
          {isScanning ? 'Detener' : 'Escanear'}
        </motion.button>
        
        {lastScan && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg"
          >
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-sm font-mono text-green-700">{lastScan.code}</span>
          </motion.div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", getStatusColor().replace('text-', 'bg-').replace('-500', '-100'))}>
              {getStatusIcon()}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Escáner de Códigos</h3>
              <p className={cn("text-sm", getStatusColor())}>
                {scannerStatus === 'scanning' && 'Escaneando...'}
                {scannerStatus === 'processing' && 'Procesando...'}
                {scannerStatus === 'error' && 'Error'}
                {scannerStatus === 'idle' && 'Listo para escanear'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={isScanning ? stopScanning : startScanning}
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-all",
                isScanning 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              )}
            >
              {isScanning ? 'Detener' : 'Iniciar'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Error Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            Entrada Manual
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManualInput()}
              placeholder="Ingrese código de barras..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={submitManualInput}
              disabled={!manualInput.trim()}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-all"
            >
              Enviar
            </motion.button>
          </div>
        </div>

        {/* Last Scan */}
        <AnimatePresence>
          {lastScan && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 bg-green-50 border border-green-200 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-semibold text-green-900">Último Escaneo</p>
                    <p className="font-mono text-lg text-green-700">{lastScan.code}</p>
                    <p className="text-xs text-green-600">
                      {lastScan.timestamp.toLocaleTimeString()} • {lastScan.source}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan History */}
        {showHistory && scanHistory.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <History className="w-4 h-4" />
                Historial ({scanHistory.length})
              </label>
              <button
                onClick={clearHistory}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Limpiar
              </button>
            </div>
            
            <div className="max-h-40 overflow-y-auto space-y-1">
              {scanHistory.slice(0, 10).map((scan, index) => (
                <motion.div
                  key={`${scan.code}-${scan.timestamp.getTime()}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <span className="font-mono text-sm text-gray-700">{scan.code}</span>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{scan.source}</span>
                    <span>{scan.timestamp.toLocaleTimeString()}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <p className="text-sm text-blue-700">
              💡 <strong>Instrucciones:</strong> Use un escáner físico o ingrese el código manualmente. 
              Los escáneres físicos enviarán automáticamente al presionar Enter.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// Componente compacto para POS
export function POSBarcodeScanner({ 
  onProductFound, 
  className 
}: { 
  onProductFound: (barcode: string) => void
  className?: string 
}) {
  return (
    <BarcodeScanner
      onScan={(result) => onProductFound(result.code)}
      className={className}
      compact={true}
      showHistory={false}
      autoStart={true}
    />
  )
}