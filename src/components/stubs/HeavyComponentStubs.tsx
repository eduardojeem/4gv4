'use client'

// Stubs para dependencias pesadas removidas temporalmente
// Estos componentes proporcionan funcionalidad básica sin las librerías pesadas

import { toast } from 'sonner'

// Stub para browser-image-compression
export const imageCompression = async (file: File, options?: any) => {
  console.warn('Image compression disabled for bundle optimization')
  toast.warning('Compresión de imagen deshabilitada temporalmente')
  return file // Retorna el archivo sin comprimir
}

// Stub para html2canvas
export const html2canvas = async (element: HTMLElement, options?: any) => {
  console.warn('HTML2Canvas disabled for bundle optimization')
  toast.warning('Captura de pantalla deshabilitada temporalmente')
  return {
    toDataURL: () => 'data:image/png;base64,',
    toBlob: (callback: (blob: Blob | null) => void) => callback(null)
  }
}

// Stub para jsPDF
export class jsPDF {
  constructor(options?: any) {
    console.warn('PDF generation disabled for bundle optimization')
  }
  
  text(text: string, x: number, y: number) {
    return this
  }
  
  addImage(imageData: string, format: string, x: number, y: number, width: number, height: number) {
    return this
  }
  
  save(filename: string) {
    toast.warning('Generación de PDF deshabilitada temporalmente')
    return this
  }
  
  output(type: string) {
    return ''
  }
}

// Stub para XLSX
export const XLSX = {
  utils: {
    json_to_sheet: (data: any[]) => ({}),
    book_new: () => ({}),
    book_append_sheet: (workbook: any, worksheet: any, name: string) => {},
  },
  writeFile: (workbook: any, filename: string) => {
    toast.warning('Exportación de Excel deshabilitada temporalmente')
  }
}

// Stub para JSBarcode
export const JSBarcode = (canvas: HTMLCanvasElement, text: string, options?: any) => {
  console.warn('Barcode generation disabled for bundle optimization')
  toast.warning('Generación de códigos de barras deshabilitada temporalmente')
}

// Stub para QR Code scanner
export const Html5QrcodeScanner = class {
  constructor(elementId: string, config: any) {
    console.warn('QR Code scanner disabled for bundle optimization')
  }
  
  render(onScanSuccess: Function, onScanFailure?: Function) {
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

// Stub para react-window
export const FixedSizeList = ({ children, ...props }: any) => {
  console.warn('Virtual scrolling disabled for bundle optimization')
  return <div className="space-y-2">{children}</div>
}

// Stub para @tanstack/react-virtual
export const useVirtualizer = (options: any) => {
  console.warn('Virtual scrolling disabled for bundle optimization')
  return {
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: () => {},
    measure: () => {}
  }
}