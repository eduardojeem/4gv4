'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface BarcodeScannerProps {
  /** Se llama cuando se detecta un código */
  onScan: (code: string) => void
  /** Texto del botón que abre el scanner */
  label?: string
  /** Clase CSS adicional para el botón */
  className?: string
  /** Variante del botón */
  variant?: 'default' | 'outline' | 'ghost'
  /** Tamaño del botón */
  size?: 'default' | 'sm' | 'icon'
}

/**
 * Componente de scanner de código de barras por cámara.
 * Usa la librería html5-qrcode para acceder a la cámara y decodificar
 * códigos EAN-8, EAN-13, UPC-A, Code128, QR, etc.
 */
export function BarcodeScanner({
  onScan,
  label = 'Escanear',
  className,
  variant = 'outline',
  size = 'sm',
}: BarcodeScannerProps) {
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCode, setLastCode] = useState<string | null>(null)
  const scannerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {
        // Scanner may already be stopped
      }
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return
    setError(null)
    setLastCode(null)

    try {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode')

      const scanner = new Html5Qrcode('barcode-scanner-container')
      scannerRef.current = scanner

      setScanning(true)

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 120 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // Code detected
          setLastCode(decodedText)
          onScan(decodedText)
          // Stop after successful scan
          stopScanner()
          setOpen(false)
        },
        () => {
          // Scan failure (frame without code) — ignore silently
        }
      )
    } catch (err) {
      setScanning(false)
      if (err instanceof Error) {
        if (err.message.includes('Permission') || err.message.includes('NotAllowed')) {
          setError('Permiso de cámara denegado. Habilitalo en la configuración del navegador.')
        } else if (err.message.includes('NotFound') || err.message.includes('device')) {
          setError('No se encontró una cámara disponible.')
        } else {
          setError(err.message)
        }
      } else {
        setError('No se pudo iniciar la cámara.')
      }
    }
  }, [onScan, stopScanner])

  // Cleanup on unmount or close
  useEffect(() => {
    if (!open) {
      stopScanner()
    }
    return () => { stopScanner() }
  }, [open, stopScanner])

  // Auto-start when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to let the DOM render the container
      const timer = setTimeout(startScanner, 300)
      return () => clearTimeout(timer)
    }
  }, [open, startScanner])

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn('gap-1.5', className)}
      >
        <Camera className="h-4 w-4" />
        {size !== 'icon' && label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm overflow-hidden rounded-xl p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Escanear código de barras</DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium">Escanear código</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scanner area */}
          <div className="relative bg-black">
            <div
              id="barcode-scanner-container"
              ref={containerRef}
              className="mx-auto aspect-[3/2] w-full max-w-[320px]"
            />

            {/* Scanning indicator */}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[100px] w-[260px] rounded-lg border-2 border-cyan-400/60 shadow-[inset_0_0_30px_rgba(0,200,200,0.1)]">
                  <div className="animate-scan-line h-0.5 w-full bg-cyan-400/80" />
                </div>
              </div>
            )}

            {/* Loading state */}
            {!scanning && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <p className="text-xs text-slate-400">Iniciando cámara...</p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center">
                <CameraOff className="h-8 w-8 text-slate-500" />
                <p className="text-xs text-slate-400">{error}</p>
                <Button size="sm" variant="outline" onClick={startScanner} className="text-xs">
                  Reintentar
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-3 text-center">
            <p className="text-xs text-slate-500">
              Apuntá la cámara al código de barras del producto
            </p>
            {lastCode && (
              <p className="mt-1 text-xs font-medium text-emerald-600">
                Último código: {lastCode}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
