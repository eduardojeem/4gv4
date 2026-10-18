import { getThermalPrintHtml } from './thermal-print'

/**
 * Entrega de comprobantes: impresión nativa de tickets y PDF para hojas/descarga.
 *
 * Antes ambas pantallas hacian `doc.output('dataurlnewwindow')` despues de un
 * `await`. Al haber pasado por el await, el navegador ya no reconoce la accion
 * como originada por el clic del usuario y bloquea la ventana como emergente:
 * el boton "Imprimir" no hacia absolutamente nada, sin ventana ni aviso.
 *
 * Los tickets registrados usan HTML con ancho flexible: Chrome puede recortar
 * un PDF de 80 mm al imprimirlo a tamaño real sobre un área útil más angosta.
 * El iframe evita ventanas emergentes. A4 mantiene el visor PDF y las descargas
 * conservan el documento original.
 */

/** Lo minimo que se necesita de jsPDF, para no importar el paquete aca. */
type PrintablePdf = {
  autoPrint: () => void
  output: (type: 'blob') => Blob
  save: (filename: string) => void
}

/** Cuanto se espera a que el visor cargue antes de darlo por fallido. */
const LOAD_TIMEOUT_MS = 10_000

/**
 * El iframe debe seguir vivo mientras el dialogo de impresion este abierto: si
 * se quita antes, el dialogo se cierra solo. No hay forma de saber cuando el
 * usuario termina, asi que se limpia bastante despues.
 */
const CLEANUP_DELAY_MS = 60_000

export async function printPdfDocument(doc: PrintablePdf): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('La impresión solo está disponible en el navegador.')
  }

  const thermalHtml = getThermalPrintHtml(doc)
  // A4 retains the PDF viewer; rolls use native layout inside the printable
  // area instead of Chrome cropping a nominal 80 mm PDF at actual size.
  if (!thermalHtml) doc.autoPrint()

  const blobUrl = thermalHtml ? undefined : URL.createObjectURL(doc.output('blob'))
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = thermalHtml
    ? 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0'
    : 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  if (thermalHtml) frame.setAttribute('sandbox', 'allow-same-origin allow-modals')

  const cleanup = () => {
    window.setTimeout(() => {
      frame.remove()
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }, CLEANUP_DELAY_MS)
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error('El visor de PDF tardó demasiado en abrir.')),
        LOAD_TIMEOUT_MS,
      )

      frame.onload = () => {
        window.clearTimeout(timer)
        resolve()
      }
      frame.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error('No se pudo cargar el comprobante.'))
      }

      if (thermalHtml) frame.srcdoc = thermalHtml
      else frame.src = blobUrl!
      document.body.appendChild(frame)
    })

    // Respaldo para los visores que ignoran la orden embebida en el PDF.
    const printWindow = frame.contentWindow
    if (!printWindow || typeof printWindow.print !== 'function') throw new Error('No se pudo abrir la impresión del comprobante.')
    printWindow.focus()
    printWindow.print()
    cleanup()
  } catch (error) {
    frame.remove()
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    throw error
  }
}

export function downloadPdfDocument(doc: PrintablePdf, filename: string): void {
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

export type ShareResult = 'shared' | 'cancelled' | 'downloaded'

/**
 * Compartir el PDF (WhatsApp, mail…) desde el menú del teléfono o la compu. Si
 * el dispositivo no comparte archivos, se descarga para mandarlo a mano.
 * Cerrar el menú sin elegir no es un error.
 */
export async function sharePdfDocument(doc: PrintablePdf, filename: string, text: string): Promise<ShareResult> {
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  const file = new File([doc.output('blob')], name, { type: 'application/pdf' })
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name, text })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Sin el gesto del usuario a mano (tardó en armarse) algunos navegadores lo niegan: se descarga.
    }
  }
  downloadPdfDocument(doc, name)
  return 'downloaded'
}
