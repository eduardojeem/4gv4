/**
 * Entrega de comprobantes en PDF: imprimir y descargar.
 *
 * Antes ambas pantallas hacian `doc.output('dataurlnewwindow')` despues de un
 * `await`. Al haber pasado por el await, el navegador ya no reconoce la accion
 * como originada por el clic del usuario y bloquea la ventana como emergente:
 * el boton "Imprimir" no hacia absolutamente nada, sin ventana ni aviso.
 *
 * La carga en un iframe oculto no abre ventanas, asi que ningun bloqueador
 * interviene. Ademas evita meter el PDF entero dentro de una URL de datos.
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

  // Deja la orden de imprimir dentro del propio PDF: los visores que la
  // respetan abren el dialogo sin que haga falta llamarlo desde el iframe.
  doc.autoPrint()

  const blobUrl = URL.createObjectURL(doc.output('blob'))
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'

  const cleanup = () => {
    window.setTimeout(() => {
      frame.remove()
      URL.revokeObjectURL(blobUrl)
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

      frame.src = blobUrl
      document.body.appendChild(frame)
    })

    // Respaldo para los visores que ignoran la orden embebida en el PDF.
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    cleanup()
  } catch (error) {
    frame.remove()
    URL.revokeObjectURL(blobUrl)
    throw error
  }
}

export function downloadPdfDocument(doc: PrintablePdf, filename: string): void {
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
