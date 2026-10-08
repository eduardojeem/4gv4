'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Camera, CameraOff, Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
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
  const width = Math.max(1, Math.floor(Math.min(viewfinderWidth * 0.92, 600)))
  const height = Math.max(1, Math.floor(Math.min(viewfinderHeight * 0.7, width)))
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
  const [mode, setMode] = useState<'camera' | 'reader'>('camera')
  const [manualCode, setManualCode] = useState('')
  const [processing, setProcessing] = useState(false)
  const cameraSession = useRef(0)
  const dialogSession = useRef(0)
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
    cameraSession.current += 1
    const scanner = scannerRef.current
    scannerRef.current = null
    if (scanner) {
      try {
        await scanner.stop()
      } catch {
        // Scanner may already be stopped
      }
      try { scanner.clear() } catch { /* Camera may still be starting. */ }
    }
    setScanning(false)
  }, [])

  const handleDecoded = useCallback(async (decodedText: string) => {
    const code = decodedText.trim()
    if (!code) return
    // Continuo: un código a la vez, y el mismo no se cuenta dos veces mientras sigue en cuadro.
    const now = Date.now()
    if (busyRef.current || isRepeatedScan(code, lastReadRef.current, now)) return
    busyRef.current = true
    setProcessing(true)
    lastReadRef.current = { code, at: now }
    setLastCode(code)
    const session = dialogSession.current
    try {
      const result = await onScanRef.current(code)
      if (session !== dialogSession.current) return
      if (!continuous && result !== null && !(typeof result === 'object' && result.ok === false)) {
        await stopScanner()
        setOpen(false)
        return
      }
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
        setManualCode('')
        setFeedback({ text: result || code, ok: true })
        if (typeof navigator !== 'undefined') navigator.vibrate?.(60)
      }
    } catch {
      if (session === dialogSession.current) setFeedback({ text: `No se pudo procesar «${code}». Intentá nuevamente.`, ok: false })
    } finally {
      lastReadRef.current = { code, at: Date.now() }
      busyRef.current = false
      setProcessing(false)
    }
  }, [continuous, stopScanner])

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return
    await stopScanner()
    const session = cameraSession.current
    setError(null)
    setLastCode(null)

    try {
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setError('La cámara necesita HTTPS o localhost. Podés usar el lector o ingresar el código manualmente.')
        return
      }
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode')
      if (session !== cameraSession.current || !containerRef.current) return

      const scanner = new Html5Qrcode(containerId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: scanBox,
          aspectRatio: 1,
          // Preferencias, no requisitos exactos: admite cámaras de menor resolución.
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        },
        (decodedText) => { if (session === cameraSession.current) void handleDecoded(decodedText) },
        () => {
          // Scan failure (frame without code) — ignore silently
        }
      )
      if (session !== cameraSession.current) {
        try { await scanner.stop() } finally { scanner.clear() }
        return
      }
      setScanning(true)
    } catch (err) {
      if (session !== cameraSession.current) return
      setScanning(false)
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      if (/Permission|NotAllowed/i.test(message)) {
        setError('Permiso de cámara denegado. Habilitalo en la configuración del navegador.')
      } else if (/NotFound|DevicesNotFound/i.test(message)) {
        setError('No se encontró una cámara disponible.')
      } else {
        setError(/NotReadable|TrackStart/i.test(message)
          ? 'La cámara está ocupada o no responde. Cerrá otras aplicaciones que la usen y reintentá.'
          : 'No se pudo iniciar la cámara. Revisá los permisos o usá Lector o manual.')
      }
    }
  }, [containerId, handleDecoded, stopScanner])

  const openScanner = () => {
    dialogSession.current += 1
    setFeedback(null)
    setReadCount(0)
    setMode('camera')
    setManualCode('')
    lastReadRef.current = null
    setOpen(true)
  }

  const changeOpen = (value: boolean) => {
    if (!value) dialogSession.current += 1
    setOpen(value)
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
    if (open && mode === 'camera') {
      // Small delay to let the DOM render the container
      const timer = setTimeout(startScanner, 300)
      return () => { clearTimeout(timer); void stopScanner() }
    }
  }, [open, mode, startScanner, stopScanner])

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

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="top-0 left-0 flex h-dvh max-h-dvh max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl" showCloseButton={false}>
          <DialogTitle className="sr-only">Escanear código de barras</DialogTitle>
          <DialogDescription className="sr-only">Usá la cámara trasera o ingresá el código con un lector. La cámara se apaga al cerrar.</DialogDescription>

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
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
              onClick={() => changeOpen(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2 px-4 py-2" role="group" aria-label="Método de lectura">
            <Button type="button" size="sm" className="h-11" variant={mode === 'camera' ? 'default' : 'outline'} aria-pressed={mode === 'camera'} onClick={() => setMode('camera')}>Cámara</Button>
            <Button type="button" size="sm" className="h-11" variant={mode === 'reader' ? 'default' : 'outline'} aria-pressed={mode === 'reader'} onClick={() => setMode('reader')}>Lector o manual</Button>
          </div>
          {mode === 'reader' && <div className="space-y-3 px-4 py-3">
            <label htmlFor={`${containerId}-input`} className="text-sm font-medium">Código leído</label>
            <Input id={`${containerId}-input`} autoFocus autoComplete="off" value={manualCode} onChange={(event) => setManualCode(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); void handleDecoded(manualCode) }
            }} />
            <p className="text-xs text-muted-foreground">Conectá el lector USB o Bluetooth, dejá el foco en este campo y escaneá. Enter confirma el código; no guarda el producto.</p>
            <Button type="button" disabled={processing || !manualCode.trim()} onClick={() => { void handleDecoded(manualCode) }}>Usar código</Button>
          </div>}
          {/* Keep the camera container mounted until asynchronous startup stops. */}
          <div className={cn('relative shrink-0 bg-black', mode !== 'camera' && 'hidden')}>
            <div
              id={containerId}
              ref={containerRef}
              aria-label="Vista de la cámara"
              className="mx-auto aspect-square w-full"
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
                <Button type="button" size="sm" variant="outline" onClick={startScanner} className="text-xs">
                  Reintentar
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="space-y-3 border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
            {processing && <p role="status" className="text-xs text-muted-foreground">Procesando código…</p>}
            <p className="text-xs text-slate-500">
              {mode === 'reader' ? 'Configurá el lector en modo teclado, con Enter al finalizar.' : hint ?? (continuous
                ? 'Pasá los productos de a uno frente a la cámara'
                : 'Apuntá la cámara al código de barras o al QR')}
            </p>
            {mode === 'camera' && <p className="text-sm text-muted-foreground">Dejá todas las barras dentro del recuadro, incluyendo los extremos. Probá a 15–30 cm, con buena luz y sin reflejos; acercá o alejá lentamente hasta que se vea nítido.</p>}
            {feedback && (
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
              <Button type="button" size="sm" className="w-full" onClick={() => changeOpen(false)}>
                Listo
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
