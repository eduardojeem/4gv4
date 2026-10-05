'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Camera, CameraOff, Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Html5Qrcode } from 'html5-qrcode'

/**
 * Lo que devuelve `onScan` en modo continuo: el texto a mostrar, null si el
 * código no existe, o un objeto para avisar que no se tomó (`ok: false`) o para
 * cerrar la cámara (`close: true`, por ejemplo para elegir una variante).
 */
export type BarcodeScanFeedback = string | null | void | { text: string; ok?: boolean; close?: boolean }

interface BarcodeScannerProps {
  /** Se llama cuando se detecta un código. En modo continuo puede devolver el texto a mostrar. */
  onScan: (code: string) => BarcodeScanFeedback | Promise<BarcodeScanFeedback>
  /** Texto del botón que abre el scanner */
  label?: string
  /** Clase CSS adicional para el botón */
  className?: string
  /** Variante del botón */
  variant?: 'default' | 'outline' | 'ghost'
  /** Tamaño del botón */
  size?: 'default' | 'sm' | 'icon'
  /**
   * Sigue leyendo después de cada código (para contar o cobrar varios
   * productos seguidos). Sin esto, se cierra con el primero.
   */
  continuous?: boolean
  /** Indicación debajo de la cámara. */
  hint?: string
}

/** El mismo código no se vuelve a tomar hasta pasado este tiempo (sigue en cuadro). */
export const REPEAT_SCAN_MS = 1500

/** Recuadro de lectura: ancho para códigos de barras y alto suficiente para un QR. */
export function scanBox(viewfinderWidth: number, viewfinderHeight: number) {
  const width = Math.max(120, Math.floor(Math.min(viewfinderWidth * 0.85, 320)))
  const height = Math.max(80, Math.floor(Math.min(viewfinderHeight * 0.7, width)))
  return { width, height }
}

/** Si un código recién leído hay que ignorarlo por ser el mismo de hace un instante. */
export function isRepeatedScan(
  code: string,
  last: { code: string; at: number } | null,
  now: number,
  windowMs = REPEAT_SCAN_MS,
) {
  return Boolean(last && last.code === code && now - last.at < windowMs)
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
  continuous = false,
  hint,
}: BarcodeScannerProps) {
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const [readCount, setReadCount] = useState(0)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // La cámara arranca una sola vez: el callback lee siempre la última versión de onScan.
  const onScanRef = useRef(onScan)
  const lastReadRef = useRef<{ code: string; at: number } | null>(null)
  const busyRef = useRef(false)
  const containerId = `barcode-scanner-${useId().replace(/:/g, '')}`

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

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

  const handleDecoded = useCallback(async (decodedText: string) => {
    const code = decodedText.trim()
    if (!code) return
    if (!continuous) {
      setLastCode(code)
      void onScanRef.current(code)
      void stopScanner()
      setOpen(false)
      return
    }
    // Continuo: un código a la vez, y el mismo no se cuenta dos veces mientras sigue en cuadro.
    const now = Date.now()
    if (busyRef.current || isRepeatedScan(code, lastReadRef.current, now)) return
    busyRef.current = true
    lastReadRef.current = { code, at: now }
    setLastCode(code)
    try {
      const result = await onScanRef.current(code)
      if (result === null) {
        setFeedback({ text: `No se encontró «${code}»`, ok: false })
      } else if (typeof result === 'object') {
        const ok = result.ok !== false
        if (ok) setReadCount((value) => value + 1)
        setFeedback({ text: result.text, ok })
        if (result.close) {
          void stopScanner()
          setOpen(false)
        }
      } else {
        setReadCount((value) => value + 1)
        setFeedback({ text: result || code, ok: true })
        if (typeof navigator !== 'undefined') navigator.vibrate?.(60)
      }
    } catch {
      setFeedback({ text: `No se pudo procesar «${code}»`, ok: false })
    } finally {
      lastReadRef.current = { code, at: Date.now() }
      busyRef.current = false
    }
  }, [continuous, stopScanner])

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return
    setError(null)
    setLastCode(null)

    try {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode')

      const scanner = new Html5Qrcode(containerId)
      scannerRef.current = scanner

      setScanning(true)

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: scanBox,
          aspectRatio: 1.5,
        },
        (decodedText) => { void handleDecoded(decodedText) },
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
  }, [containerId, handleDecoded])

  const openScanner = () => {
    setFeedback(null)
    setReadCount(0)
    lastReadRef.current = null
    setOpen(true)
  }

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
        onClick={openScanner}
        className={cn('gap-1.5', className)}
        aria-label={size === 'icon' ? label : undefined}
        title={size === 'icon' ? label : undefined}
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
              {continuous && readCount > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {readCount} {readCount === 1 ? 'leído' : 'leídos'}
                </span>
              )}
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
              id={containerId}
              ref={containerRef}
              className="mx-auto aspect-[3/2] w-full max-w-[320px]"
            />

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
          <div className="space-y-2 border-t px-4 py-3 text-center">
            <p className="text-xs text-slate-500">
              {hint ?? (continuous
                ? 'Pasá los productos de a uno frente a la cámara'
                : 'Apuntá la cámara al código de barras o al QR')}
            </p>
            {continuous && feedback && (
              <p
                role="status"
                className={cn(
                  'flex items-center justify-center gap-1.5 text-sm font-medium',
                  feedback.ok ? 'text-emerald-600' : 'text-amber-600',
                )}
              >
                {feedback.ok && <Check className="h-4 w-4 shrink-0" />}
                <span className="truncate">{feedback.text}</span>
              </p>
            )}
            {!continuous && lastCode && (
              <p className="text-xs font-medium text-emerald-600">
                Último código: {lastCode}
              </p>
            )}
            {continuous && (
              <Button type="button" size="sm" className="w-full" onClick={() => setOpen(false)}>
                Listo
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
