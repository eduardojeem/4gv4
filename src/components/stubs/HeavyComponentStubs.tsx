'use client'

// Stubs para dependencias pesadas removidas temporalmente
// Estos componentes proporcionan funcionalidad básica sin las librerías pesadas

import { toast } from 'sonner'

// Tipos internos de stubs
interface ImageCompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  [key: string]: unknown;
}

// Stub para browser-image-compression
export const imageCompression = async (file: File, _options?: ImageCompressionOptions) => {
  console.warn('Image compression disabled for bundle optimization')
  toast.warning('Compresión de imagen deshabilitada temporalmente')
  return file // Retorna el archivo sin comprimir
}

// Stub para html2canvas
export const html2canvas = async (_element: HTMLElement, _options?: Record<string, unknown>) => {
  console.warn('HTML2Canvas disabled for bundle optimization')
  toast.warning('Captura de pantalla deshabilitada temporalmente')
  return {
    toDataURL: () => 'data:image/png;base64,',
    toBlob: (callback: (blob: Blob | null) => void) => callback(null)
  }
}

// Tipos internos para jsPDF stub
interface JsPDFOptions {
  orientation?: string;
  unit?: string;
  format?: string;
  [key: string]: unknown;
}

// Stub para jsPDF
export class jsPDF {
  constructor(_options?: JsPDFOptions) {
    console.warn('PDF generation disabled for bundle optimization')
  }

  text(_text: string, _x: number, _y: number) {
    return this
  }

  addImage(_imageData: string, _format: string, _x: number, _y: number, _width: number, _height: number) {
    return this
  }

  save(_filename: string) {
    toast.warning('Generación de PDF deshabilitada temporalmente')
    return this
  }

  output(_type: string) {
    return ''
  }
}

// Tipos internos para XLSX stub
interface XLSXWorksheet {
  [key: string]: unknown;
}
interface XLSXWorkbook {
  SheetNames?: string[];
  [key: string]: unknown;
}

// Stub para XLSX
export const XLSX = {
  utils: {
    json_to_sheet: (_data: unknown[]): XLSXWorksheet => ({}),
    book_new: (): XLSXWorkbook => ({}),
    book_append_sheet: (_workbook: XLSXWorkbook, _worksheet: XLSXWorksheet, _name: string) => {},
  },
  writeFile: (_workbook: XLSXWorkbook, _filename: string) => {
    toast.warning('Exportación de Excel deshabilitada temporalmente')
  }
}

// Stub para JSBarcode
interface JSBarcodeOptions {
  format?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export const JSBarcode = (_canvas: HTMLCanvasElement, _text: string, _options?: JSBarcodeOptions) => {
  console.warn('Barcode generation disabled for bundle optimization')
  toast.warning('Generación de códigos de barras deshabilitada temporalmente')
}

// Tipos para Html5QrcodeScanner stub
interface Html5QrcodeConfig {
  fps?: number;
  qrbox?: number;
  [key: string]: unknown;
}

// Stub para QR Code scanner
export const Html5QrcodeScanner = class {
  constructor(_elementId: string, _config: Html5QrcodeConfig) {
    console.warn('QR Code scanner disabled for bundle optimization')
  }

  render(_onScanSuccess: (decodedText: string, result: unknown) => void, _onScanFailure?: (message: string, error: unknown) => void) {
    toast.warning('Escáner QR deshabilitado temporalmente')
  }

  clear() {
    return Promise.resolve()
  }
}

// Stub para ZXing library
export const BrowserMultiFormatReader = class {
  constructor() {
    console.warn('Barcode reader disabled for bundle optimization')
  }

  decodeFromVideoDevice() {
    toast.warning('Lector de códigos de barras deshabilitado temporalmente')
    return Promise.reject('Disabled for optimization')
  }

  reset() {}
}

// Tipos para react-window / react-virtual stubs
interface FixedSizeListProps {
  children: React.ReactNode;
  itemCount?: number;
  itemSize?: number;
  height?: number;
  width?: number;
  [key: string]: unknown;
}

// Stub para react-window
export const FixedSizeList = ({ children, ..._props }: FixedSizeListProps) => {
  console.warn('Virtual scrolling disabled for bundle optimization')
  return <div className="space-y-2">{children}</div>
}

interface VirtualizerOptions {
  count?: number;
  estimateSize?: () => number;
  [key: string]: unknown;
}

// Stub para @tanstack/react-virtual
export const useVirtualizer = (_options: VirtualizerOptions) => {
  console.warn('Virtual scrolling disabled for bundle optimization')
  return {
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: () => {},
    measure: () => {}
  }
}
