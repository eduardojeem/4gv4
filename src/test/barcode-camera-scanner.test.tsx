import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BarcodeScanner, REPEAT_SCAN_MS, isRepeatedScan, scanBox } from '@/components/ui/barcode-scanner'

// La cámara simulada: guarda el callback de lectura para dispararlo a mano.
const camera = vi.hoisted(() => ({ onDecode: null as null | ((text: string) => void), stop: vi.fn(), config: null as null | Record<string, unknown> }))
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start(_camera: unknown, _config: unknown, onDecode: (text: string) => void) {
      camera.config = _config as Record<string, unknown>
      camera.onDecode = onDecode
      return Promise.resolve()
    }
    stop() {
      camera.stop()
      return Promise.resolve()
    }
    clear() {}
  },
}))

async function openCamera(label: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
  // El escáner arranca 300 ms después de abrir el diálogo y carga la librería aparte.
  await act(async () => { await vi.advanceTimersByTimeAsync(350) })
  await vi.waitFor(() => expect(camera.onDecode).not.toBeNull())
}

async function read(code: string) {
  await act(async () => {
    camera.onDecode?.(code)
    await Promise.resolve()
  })
}

describe('escáner por cámara', () => {
  it('espera el procesamiento y no recibe dos veces el mismo código', async () => {
    let finish!: () => void
    const onScan = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<BarcodeScanner onScan={onScan} label="Escanear con la cámara" />)
    await openCamera('Escanear con la cámara')
    await read('111')
    await read('111')
    expect(onScan).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Escanear código')).toBeInTheDocument()
    await act(async () => { finish(); await Promise.resolve() })
    expect(screen.queryByText('Escanear código')).not.toBeInTheDocument()
  })

  it('lector: Enter usa el código sin enviar el formulario', async () => {
    const onSubmit = vi.fn((event) => event.preventDefault())
    const onScan = vi.fn()
    render(<form onSubmit={onSubmit}><BarcodeScanner onScan={onScan} /></form>)
    fireEvent.click(screen.getByRole('button', { name: 'Escanear' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lector o manual' }))
    const input = screen.getByLabelText('Código leído')
    fireEvent.change(input, { target: { value: '7891000315507' } })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(onScan).toHaveBeenCalledWith('7891000315507')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mantiene abierto el escáner y muestra una lectura rechazada', async () => {
    const onScan = vi.fn(() => ({ ok: false, text: 'Código inválido' }))
    render(<BarcodeScanner onScan={onScan} label="Escanear con la cámara" />)
    await openCamera('Escanear con la cámara')
    await read('bad-code')
    expect(screen.getByRole('status')).toHaveTextContent('Código inválido')
    expect(screen.getByText('Escanear código')).toBeInTheDocument()
  })

  it('maneja el rechazo asíncrono sin cerrar ni perder el mensaje', async () => {
    const onScan = vi.fn(async () => { throw new Error('unavailable') })
    render(<BarcodeScanner onScan={onScan} label="Escanear con la cámara" />)
    await openCamera('Escanear con la cámara')
    await read('111')
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo procesar')
    expect(screen.getByText('Escanear código')).toBeInTheDocument()
  })
  beforeEach(() => {
    vi.useFakeTimers()
    camera.onDecode = null
    camera.stop.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('el recuadro entra un QR y no se pasa del visor', () => {
    expect(scanBox(320, 213)).toEqual({ width: 294, height: 149 })
    expect(scanBox(1000, 600)).toEqual({ width: 600, height: 420 })
    expect(scanBox(80, 60)).toEqual({ width: 73, height: 42 })
  })

  it('solicita cámara trasera de mayor resolución y visor móvil amplio', async () => {
    render(<BarcodeScanner onScan={vi.fn()} />)
    await openCamera('Escanear')
    expect(camera.config).toMatchObject({ videoConstraints: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } })
    expect(screen.getByRole('dialog')).toHaveClass('h-dvh')
    expect(screen.getByLabelText('Vista de la cámara')).toHaveClass('w-full')
    expect(screen.getByLabelText('Vista de la cámara')).not.toHaveClass('max-w-[320px]')
  })

  it('el mismo código no se toma dos veces mientras sigue en cuadro', () => {
    const last = { code: '7791', at: 1000 }
    expect(isRepeatedScan('7791', last, 1000 + REPEAT_SCAN_MS - 1)).toBe(true)
    expect(isRepeatedScan('7791', last, 1000 + REPEAT_SCAN_MS)).toBe(false)
    expect(isRepeatedScan('7792', last, 1001)).toBe(false)
  })

  it('sin modo continuo, se cierra con el primer código', async () => {
    const onScan = vi.fn()
    render(<BarcodeScanner onScan={onScan} label="Escanear con la cámara" />)
    await openCamera('Escanear con la cámara')
    await read(' 7791234567890 ')
    expect(onScan).toHaveBeenCalledWith('7791234567890')
    expect(screen.queryByText('Escanear código')).not.toBeInTheDocument()
  })

  it('en modo continuo sigue leyendo, cuenta y avisa lo que no encontró', async () => {
    const onScan = vi.fn((code: string) => (code === '111' ? '+1 Coca 500' : null))
    render(<BarcodeScanner continuous onScan={onScan} label="Contar con la cámara" />)
    await openCamera('Contar con la cámara')

    await read('111')
    expect(screen.getByRole('status')).toHaveTextContent('+1 Coca 500')
    expect(screen.getByText('1 leído')).toBeInTheDocument()

    // Sigue en cuadro: no suma de nuevo.
    await read('111')
    expect(onScan).toHaveBeenCalledTimes(1)

    await read('999')
    expect(screen.getByRole('status')).toHaveTextContent('No se encontró «999»')
    expect(screen.getByText('1 leído')).toBeInTheDocument()

    // Pasado el tiempo, el mismo producto vuelve a sumar.
    await act(async () => { await vi.advanceTimersByTimeAsync(REPEAT_SCAN_MS) })
    await read('111')
    expect(onScan).toHaveBeenCalledTimes(3)
    expect(screen.getByText('2 leídos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument()
  })

  it('se cierra cuando hay que elegir una variante', async () => {
    const onScan = vi.fn(() => ({ text: 'Elegí la variante de Remera', close: true }))
    render(<BarcodeScanner continuous onScan={onScan} label="Escanear con la cámara" />)
    await openCamera('Escanear con la cámara')
    await read('222')
    expect(onScan).toHaveBeenCalledWith('222')
    expect(screen.queryByText('Escanear código')).not.toBeInTheDocument()
  })
})
