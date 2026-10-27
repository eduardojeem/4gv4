export interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  discount?: number
  isService?: boolean
}

export interface PaymentSplit {
  id: string
  method: 'cash' | 'card' | 'transfer' | 'credit' | 'store_credit'
  amount: number
  reference?: string
  cardLast4?: string
}

export interface ReceiptData {
  /**
   * Marca el ticket como reimpresion de una venta ya emitida. Se imprime
   * visible para que una copia no se confunda con el original en una revision
   * contable: el numero y la fecha son los de la venta original, no los de hoy.
   */
  isReprint?: boolean
  receiptNumber: string
  date: string
  time: string
  cashier: string
  cashRegister?: string
  shift?: string
  customer?: {
    name: string
    phone: string
    email: string
  }
  items: CartItem[]
  subtotal: number
  totalDiscount: number
  tax: number
  repairCost?: number
  total: number
  payments: PaymentSplit[]
  change?: number
  loyaltyPoints?: number
  creditInfo?: {
    baseTotal: number
    interestAmount: number
    financedTotal: number
    installmentCount: number
    installmentAmount: number
    frequency: string
    interestRate: number
    firstDueDate: string
    firstInstallmentTiming?: 'at_start' | 'next_cycle'
    startDate?: string
    lastInstallmentAmount?: number
    firstPayment?: { amount: number; method: 'cash' | 'transfer'; bank?: string; reference?: string; cashReceived?: number; change?: number; paymentId: string }
    remainingBalance?: number
    installments?: Array<{ number: number; dueDate: string; amount: number }>
  }
}

export type ReceiptDocumentKind = 'internal' | 'fiscal'

export interface ReceiptPaymentSummary {
  cashPaid: number
  nonCashPaid: number
  change: number | null
  financedPrincipal: number
  financedTotal: number
  /** Saldo a favor aplicado: paga parte de la venta pero no es dinero que entró hoy. */
  storeCreditApplied: number
  /**
   * Total de la operación con la financiación: lo pagado al contado (incluido el
   * saldo a favor) más el total financiado. La primera cuota cobrada al emitir
   * ya está dentro del financiado: sumarla otra vez inflaba el total.
   */
  totalWithFinancing: number
  installments: NonNullable<ReceiptData['creditInfo']>['installments']
  firstDueDate: string | null
  collectedToday: number
  financedBalance: number
  paymentState: 'PAGADO' | 'COBRO PARCIAL + CRÉDITO' | 'CRÉDITO REGISTRADO'
}

export function buildReceiptPaymentSummary(receiptData: ReceiptData): ReceiptPaymentSummary {
  const creditInfo = receiptData.creditInfo
  const immediatePayments = receiptData.payments.filter(payment => payment.method !== 'credit')
  const firstPayment = creditInfo?.firstPayment
  const cashPaid = immediatePayments
    .filter(payment => payment.method === 'cash')
    .reduce((total, payment) => total + payment.amount, 0)
    + (firstPayment?.method === 'cash' ? firstPayment.amount : 0)
  const nonCashPaid = immediatePayments
    .filter(payment => payment.method !== 'cash' && payment.method !== 'store_credit')
    .reduce((total, payment) => total + payment.amount, 0)
    + (firstPayment && firstPayment.method !== 'cash' ? firstPayment.amount : 0)
  const storeCreditApplied = immediatePayments
    .filter(payment => payment.method === 'store_credit')
    .reduce((total, payment) => total + payment.amount, 0)
  const paidUpfront = immediatePayments.reduce((total, payment) => total + payment.amount, 0)
  const collectedToday = cashPaid + nonCashPaid
  const financedBalance = creditInfo
    ? creditInfo.remainingBalance ?? Math.max(0, creditInfo.financedTotal - (firstPayment?.amount || 0))
    : 0

  return {
    cashPaid,
    nonCashPaid,
    change: !creditInfo && (receiptData.change ?? 0) > 0 ? receiptData.change! : null,
    financedPrincipal: creditInfo?.baseTotal ?? 0,
    financedTotal: creditInfo?.financedTotal ?? 0,
    storeCreditApplied,
    totalWithFinancing: paidUpfront + (creditInfo?.financedTotal ?? 0),
    installments: creditInfo?.installments,
    firstDueDate: creditInfo?.firstDueDate ?? null,
    collectedToday,
    financedBalance,
    paymentState: !creditInfo
      ? 'PAGADO'
      : collectedToday > 0
        ? 'COBRO PARCIAL + CRÉDITO'
        : 'CRÉDITO REGISTRADO',
  }
}

/** Vuelto entregado al cobrar la primera cuota en efectivo. */
export function firstPaymentChange(firstPayment: NonNullable<NonNullable<ReceiptData['creditInfo']>['firstPayment']>): number {
  if (firstPayment.method !== 'cash') return 0
  const change = Number(firstPayment.change)
  if (Number.isFinite(change)) return Math.max(0, change)
  return Math.max(0, Number(firstPayment.cashReceived ?? firstPayment.amount) - firstPayment.amount)
}

// Generar número de ticket único
export const generateReceiptNumber = (): string => {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const time = now.getTime().toString().slice(-6)

  return `${year}${month}${day}-${time}`
}

// Formatear fecha y hora
export const formatDateTime = () => {
  const now = new Date()
  const date = now.toLocaleDateString('es-PY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const time = now.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  return { date, time }
}

interface Calculations {
  subtotal: number
  totalDiscount: number
  tax: number
  repairCost?: number
  total: number
  change?: number
  loyaltyPoints?: number
  creditInfo?: ReceiptData['creditInfo']
}

interface Customer {
  name: string
  phone: string
  email: string
}

// Crear datos del ticket
export const createReceiptData = (
  cart: CartItem[],
  calculations: Calculations,
  payments: PaymentSplit[],
  customer?: Customer,
  cashier: string = 'Sistema POS',
  cashRegister?: string,
  shift?: string
): ReceiptData => {
  const { date, time } = formatDateTime()

  return {
    receiptNumber: generateReceiptNumber(),
    date,
    time,
    cashier,
    cashRegister,
    shift,
    customer: customer ? {
      name: customer.name,
      phone: customer.phone,
      email: customer.email
    } : undefined,
    items: cart,
    subtotal: calculations.subtotal,
    totalDiscount: calculations.totalDiscount || 0,
    tax: calculations.tax,
    repairCost: calculations.repairCost || 0,
    total: calculations.total,
    payments,
    change: (calculations.change || 0) > 0 ? calculations.change : undefined,
    loyaltyPoints: calculations.loyaltyPoints || 0,
    creditInfo: calculations.creditInfo
  }
}

/** Absolutiza rutas relativas para que carguen en la ventana de impresion. */
const toAbsoluteAssetUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed
  if (typeof window === 'undefined') return trimmed
  try {
    return new URL(trimmed, window.location.origin).toString()
  } catch {
    return trimmed
  }
}

export interface CompanyInfo {
  name: string
  address: string
  phone: string
  email: string
  ruc?: string
  /**
   * Logo de la organizacion. Sin esto el ticket cae al monograma de dos letras:
   * el tipo no lo declaraba y la plantilla nunca lo dibujaba, asi que el logo
   * no se imprimia nunca aunque estuviera configurado.
   */
  logoUrl?: string
  /** Los termicos rinden mejor el logo en blanco y negro que en color. */
  monochromeLogo?: boolean
}

const sanitizeUnsupportedColorFunctions = (raw: string): string => {
  return raw.replace(/\b(?:oklch|lch|lab)\([^)]+\)/gi, 'rgb(120, 120, 120)')
}

const sanitizeCloneStylesForHtml2Canvas = (clonedDoc: Document): void => {
  clonedDoc.querySelectorAll('style').forEach((styleEl) => {
    const css = styleEl.textContent || ''
    const sanitized = sanitizeUnsupportedColorFunctions(css)
    if (sanitized !== css) styleEl.textContent = sanitized
  })

  clonedDoc.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const inline = el.getAttribute('style') || ''
    const sanitized = sanitizeUnsupportedColorFunctions(inline)
    if (sanitized !== inline) el.setAttribute('style', sanitized)
  })
}

/** Funciones de color que html2canvas no sabe leer. */
const UNSUPPORTED_COLOR = /\b(?:oklch|oklab|lch|lab|color-mix|color)\(/i

const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'fill',
  'stroke',
] as const

let colorProbe: CanvasRenderingContext2D | null | undefined

/** El navegador si entiende `lab()`: se pinta un pixel y se lee como RGB. */
const toRgb = (value: string): string => {
  if (colorProbe === undefined) {
    colorProbe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  }
  if (!colorProbe) return 'rgb(0, 0, 0)'
  colorProbe.clearRect(0, 0, 1, 1)
  colorProbe.fillStyle = '#000'
  colorProbe.fillStyle = value
  colorProbe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = colorProbe.getImageData(0, 0, 1, 1).data
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
}

/**
 * Pasa a RGB los colores ya calculados del ticket clonado.
 *
 * Limpiar las etiquetas <style> no alcanzaba: Tailwind llega por hojas
 * enlazadas y el navegador devuelve sus colores calculados como `lab()` u
 * `oklch()`. html2canvas los lee de ahi, no del CSS, y fallaba con
 * "unsupported color function lab": Descargar y Compartir no armaban la imagen.
 */
const normalizeComputedColorsForHtml2Canvas = (clonedDoc: Document, root?: HTMLElement): void => {
  const view = clonedDoc.defaultView
  const target = root ?? clonedDoc.body
  if (!view || !target) return

  const elements = [target, ...Array.from(target.querySelectorAll<HTMLElement>('*'))]
  const updates: Array<[HTMLElement, string, string]> = []

  for (const el of elements) {
    const computed = view.getComputedStyle(el)
    for (const property of COLOR_PROPERTIES) {
      const value = computed.getPropertyValue(property)
      if (value && UNSUPPORTED_COLOR.test(value)) updates.push([el, property, toRgb(value)])
    }
    // Sombras y degradados con esos colores no se pueden traducir uno a uno: en
    // un ticket no aportan nada, asi que se quitan.
    if (UNSUPPORTED_COLOR.test(computed.getPropertyValue('box-shadow'))) updates.push([el, 'box-shadow', 'none'])
    if (UNSUPPORTED_COLOR.test(computed.getPropertyValue('background-image'))) updates.push([el, 'background-image', 'none'])
  }

  // Se escribe despues de leer todo, para no recalcular estilos en cada vuelta.
  for (const [el, property, value] of updates) el.style.setProperty(property, value, 'important')
}

const prepareCloneForHtml2Canvas = (clonedDoc: Document, root?: HTMLElement): void => {
  sanitizeCloneStylesForHtml2Canvas(clonedDoc)
  normalizeComputedColorsForHtml2Canvas(clonedDoc, root)
}

// Imprimir ticket - Captura el contenido del modal directamente
/**
 * Imprime cuando la ventana termino de cargar, no a ciegas.
 *
 * Antes se disparaba `print()` con un setTimeout fijo: si el logo tardaba mas
 * que ese plazo, el ticket salia sin logo. Ahora se espera al evento `load` —que
 * ya incluye las imagenes— con el timeout como red de seguridad por si la
 * imagen nunca resuelve.
 */
const printWhenReady = (printWindow: Window, fallbackDelay = 1500): void => {
  let printed = false

  const runPrint = () => {
    if (printed) return
    printed = true
    try {
      printWindow.focus()
      printWindow.print()
    } catch (error) {
      console.error('Error printing:', error)
      printWindow.close()
    }
  }

  try {
    if (printWindow.document.readyState === 'complete') {
      // Ya cargo: un respiro minimo para que el layout se estabilice.
      setTimeout(runPrint, 150)
    } else {
      printWindow.addEventListener('load', () => setTimeout(runPrint, 150))
    }
  } catch {
    // Si no se puede escuchar el evento, queda el plazo de seguridad.
  }

  setTimeout(runPrint, fallbackDelay)
}

export const printReceipt = (receiptData: ReceiptData, companyInfo?: CompanyInfo): void => {
  // Intentar capturar el contenido del modal primero
  const receiptElement = document.getElementById('receipt-content')

  if (receiptElement) {
    // Si existe el elemento del modal, clonar su contenido
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Por favor, permita las ventanas emergentes para imprimir')
      return
    }

    // Obtener todos los estilos de la página
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n')
        } catch (_e) {
          return ''
        }
      })
      .join('\n')

    // Crear HTML con el contenido clonado
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket - ${receiptData.receiptNumber}</title>
        <style>
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 5mm;
            }
            .print\\:hidden {
              display: none !important;
            }
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 80mm;
            margin: 0 auto;
            padding: 8px;
            background: white;
            color: black;
          }

          ${styles}

          /* Asegurar que los colores se impriman */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          ${HIGH_CONTRAST_PRINT_CSS}
        </style>
      </head>
      <body>
        ${receiptElement.innerHTML}
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()

    printWhenReady(printWindow)
  } else {
    // Fallback: usar el HTML generado si no existe el modal
    printReceiptFallback(receiptData, companyInfo)
  }
}

/**
 * Imprime un ticket cuyos datos todavía hay que pedir. La ventana se abre en el
 * mismo clic —si se abre después de esperar, el navegador la bloquea como
 * emergente— y el ticket se escribe cuando llegan los datos.
 */
export const printReceiptWhenReady = async (
  receiptData: Promise<ReceiptData | null>,
  companyInfo?: CompanyInfo,
): Promise<boolean> => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Por favor, permita las ventanas emergentes para imprimir')
    return false
  }
  try {
    printWindow.document.title = 'Preparando ticket…'
  } catch {}

  let data: ReceiptData | null
  try {
    data = await receiptData
  } catch (error) {
    printWindow.close()
    throw error
  }
  if (!data || printWindow.closed) {
    printWindow.close()
    return false
  }
  printWindow.document.write(generatePrintHTML(data, companyInfo))
  printWindow.document.close()
  printWhenReady(printWindow)
  return true
}

// Fallback: Imprimir usando HTML generado
const printReceiptFallback = (receiptData: ReceiptData, companyInfo?: CompanyInfo): void => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Por favor, permita las ventanas emergentes para imprimir')
    return
  }

  const printContent = generatePrintHTML(receiptData, companyInfo)

  printWindow.document.write(printContent)
  printWindow.document.close()

  printWhenReady(printWindow)
}

// Generar HTML para impresión con diseño mejorado
export const generatePrintHTML = (
  rawReceiptData: ReceiptData,
  companyInfo?: CompanyInfo,
  documentKind: ReceiptDocumentKind = 'internal',
): string => {
  // Nombres de productos, clientes y referencias entran escapados: el ticket se
  // escribe en una ventana del mismo origen que la app.
  const receiptData = escapeHtmlDeep(rawReceiptData)
  const company = escapeHtmlDeep(companyInfo || config.company)

  // El config global lo llama `logo` y CompanyInfo `logoUrl`: se acepta
  // cualquiera de los dos para que el ticket no dependa de cual llego.
  const rawLogoUrl =
    ('logoUrl' in company ? company.logoUrl : undefined)
    ?? ('logo' in company ? company.logo : undefined)
    ?? undefined
  // La ventana de impresion es `about:blank`, asi que una ruta relativa como
  // `/uploads/logo.png` no resuelve contra nada y la imagen sale rota.
  const companyLogoUrl = toAbsoluteAssetUrl(rawLogoUrl)
  const monochromeLogo = 'monochromeLogo' in company ? company.monochromeLogo : false

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      // Sin emojis: la impresora termica no los tiene y salen como cuadrados.
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito',
      store_credit: 'Saldo a favor'
    }
    return labels[method as keyof typeof labels] || method
  }

  const creditInfo = receiptData.creditInfo
  const summary = buildReceiptPaymentSummary(receiptData)
  const collectedToday = summary.collectedToday
  const financedBalance = summary.financedBalance
  const paymentState = summary.paymentState

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ticket - ${receiptData.receiptNumber}</title>
      <style>
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 5mm;
          }
          /* Sin esto el navegador descarta fondos e imagenes al imprimir: es
             la razon por la que ni el logo ni el circulo del monograma salian. */
          body, .logo, .logo-img, .ticket-number {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          max-width: 80mm;
          margin: 0 auto;
          padding: 8px;
          color: #000;
        }

        .header {
          text-align: center;
          border-bottom: 2px dashed #333;
          padding-bottom: 12px;
          margin-bottom: 12px;
          background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);
          padding-top: 12px;
        }

        .logo-img {
          display: block;
          margin: 0 auto 8px auto;
          max-height: 52px;
          max-width: 180px;
          object-fit: contain;
          image-rendering: -webkit-optimize-contrast;
        }

        .logo {
          width: 50px;
          height: 50px;
          background: #000;
          color: #fff;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .header h1 {
          font-size: 18px;
          font-weight: bold;
          margin: 5px 0 2px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .header .subtitle {
          font-size: 11px;
          font-weight: 600;
          color: #666;
          margin: 2px 0;
        }

        .header p {
          margin: 2px 0;
          font-size: 9px;
          color: #666;
        }

        .ticket-number {
          background: #f0f0f0;
          border-left: 4px solid #000;
          padding: 8px 10px;
          margin: 10px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ticket-number .label {
          font-size: 10px;
          color: #666;
        }

        .ticket-number .number {
          font-size: 14px;
          font-weight: bold;
          font-family: 'Courier New', monospace;
        }

        .info-section {
          margin: 10px 0;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 10px;
        }

        .info-row .label {
          color: #666;
        }

        .info-row .value {
          font-weight: 600;
        }

        .separator {
          border-top: 1px dashed #999;
          margin: 12px 0;
        }

        .section-title {
          text-align: center;
          font-weight: bold;
          font-size: 11px;
          background: #f5f5f5;
          padding: 6px;
          margin: 10px 0 8px 0;
          border-radius: 3px;
        }

        .products.compact .section-title {
          font-size: 9px;
          padding: 4px;
          margin: 7px 0 5px;
        }

        .products.compact .item {
          font-size: 9px;
          margin-bottom: 6px;
          padding-bottom: 5px;
        }

        .products.compact .item-header {
          gap: 6px;
          margin-bottom: 1px;
          line-height: 1.2;
        }

        .item {
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px dotted #ddd;
        }

        .item:last-child {
          border-bottom: none;
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          font-weight: 600;
          margin-bottom: 3px;
        }

        .item-name {
          flex: 1;
          line-height: 1.3;
        }

        .item-price {
          font-weight: bold;
          white-space: nowrap;
          margin-left: 8px;
        }

        .tag-service {
          display: inline-block;
          font-size: 8px;
          font-weight: bold;
          color: #0066cc;
          background: #e6f2ff;
          border: 1px solid #b3d9ff;
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: 6px;
        }

        .item-details {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #666;
          margin-top: 2px;
        }

        .item-discount {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #28a745;
          font-weight: 600;
          margin-top: 2px;
        }

        .totals {
          margin: 12px 0;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: 11px;
        }

        .total-row.discount {
          color: #28a745;
          font-weight: 600;
        }

        .total-row.final {
          background: #f0f0f0;
          padding: 7px 8px;
          margin-top: 6px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .total-row.final.financed {
          align-items: center;
          gap: 8px;
          line-height: 1.15;
        }

        .total-row.final.financed span:first-child {
          min-width: 0;
          font-size: 10px;
        }

        .total-row.final.financed span:last-child {
          flex: 0 0 auto;
          white-space: nowrap;
        }

        .payment-section {
          margin: 12px 0;
        }

        .payment-item {
          background: #f8f8f8;
          padding: 8px 10px;
          margin: 4px 0;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .payment-item.change {
          background: #e8f5e9;
          color: #2e7d32;
          font-weight: bold;
        }

        .payment-status {
          text-align: center;
          background: #e8f5e9;
          color: #2e7d32;
          padding: 8px;
          margin: 8px 0;
          border-radius: 4px;
          font-weight: bold;
          font-size: 12px;
        }

        .loyalty-box {
          background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%);
          border: 1px solid #ffc107;
          padding: 10px;
          text-align: center;
          margin: 12px 0;
          border-radius: 4px;
        }

        .loyalty-box .text {
          font-weight: bold;
          color: #856404;
          font-size: 11px;
        }

        .warranty-box {
          background: #e3f2fd;
          border: 1px solid #2196f3;
          padding: 10px;
          text-align: center;
          margin: 12px 0;
          border-radius: 4px;
        }

        .warranty-box .title {
          font-weight: bold;
          color: #1565c0;
          font-size: 11px;
          margin-bottom: 3px;
        }

        .warranty-box .subtitle {
          font-size: 9px;
          color: #1976d2;
        }

        .footer {
          text-align: center;
          font-size: 9px;
          margin-top: 15px;
          border-top: 1px dashed #999;
          padding-top: 12px;
          color: #666;
        }

        .footer .thanks {
          font-weight: bold;
          font-size: 11px;
          color: #000;
          margin-bottom: 5px;
        }

        .footer .contact {
          margin: 3px 0;
        }

        .footer .id {
          font-family: 'Courier New', monospace;
          font-size: 8px;
          margin-top: 8px;
          color: #999;
        }

        ${HIGH_CONTRAST_PRINT_CSS}
      </style>
    </head>
    <body>
      <!-- Encabezado -->
      <div class="header">
        ${companyLogoUrl
          ? `<img src="${companyLogoUrl}" class="logo-img" alt="${company.name}"${monochromeLogo ? ' style="filter: grayscale(100%) contrast(240%);"' : ''} />`
          : `<div class="logo">${company.name ? company.name.substring(0, 2).toUpperCase() : 'Mi'}</div>`}
        <h1>${company.name}</h1>
        ${'ruc' in company && company.ruc ? `<p style="font-weight: bold; font-size: 10px;">RUC: ${company.ruc}</p>` : ''}
        ${company.address ? `<p>${company.address}</p>` : ''}
        ${company.phone ? `<p>Tel: ${company.phone}</p>` : ''}
        ${company.email ? `<p>${company.email}</p>` : ''}
      </div>

      ${receiptData.isReprint ? `
      <div style="margin: 6px 0; padding: 4px; border: 2px dashed #000; text-align: center; font-weight: bold; letter-spacing: 2px; font-size: 12px;">
        REIMPRESIÓN
      </div>
      ` : ''}

      <!-- Número de ticket -->
      <div class="ticket-number">
        <span class="label">Ticket N°</span>
        <span class="number">${receiptData.receiptNumber}</span>
      </div>

      <!-- Información de la venta -->
      <div class="info-section">
        <div class="info-row">
          <span class="label">Fecha:</span>
          <span class="value">${receiptData.date} ${receiptData.time}</span>
        </div>
        ${receiptData.cashRegister ? `
          <div class="info-row">
            <span class="label">Caja:</span>
            <span class="value">${receiptData.cashRegister}</span>
          </div>
        ` : ''}
        ${receiptData.shift ? `
          <div class="info-row">
            <span class="label">Turno:</span>
            <span class="value">${receiptData.shift}</span>
          </div>
        ` : ''}
        <div class="info-row">
          <span class="label">Cajero:</span>
          <span class="value">${receiptData.cashier}</span>
        </div>
        ${receiptData.customer ? `
          <div class="separator"></div>
          <div class="info-row">
            <span class="label">Cliente:</span>
            <span class="value">${receiptData.customer.name}</span>
          </div>
          ${receiptData.customer.phone?.trim() ? `
          <div class="info-row">
            <span class="label">Teléfono:</span>
            <span class="value">${receiptData.customer.phone}</span>
          </div>` : ''}
        ` : ''}
      </div>

      <div class="separator"></div>

      <!-- Productos -->
      <div class="products compact">
      <div class="section-title">DETALLE DE PRODUCTOS</div>

      ${receiptData.items.map(item => `
        <div class="item">
          <div class="item-header">
            <span class="item-name">
              ${item.name}
              ${item.isService ? `<span class="tag-service">SERVICIO</span>` : ''}
            </span>
            <span class="item-price">${formatCurrency(item.price * item.quantity)}</span>
          </div>
           <div class="item-details">
             ${item.sku ? `<span>SKU: ${item.sku}</span>` : '<span></span>'}
            <span>${item.quantity} × ${formatCurrency(item.price)}</span>
          </div>
          ${item.discount && item.discount > 0 ? `
            <div class="item-discount">
              <span>Descuento:</span>
              <span>-${formatCurrency(item.discount)}</span>
            </div>
          ` : ''}
        </div>
      `).join('')}
      </div>

      <div class="separator"></div>

      <!-- Totales -->
      <div class="totals">
        ${(() => {
          const totalAmount = receiptData.total

          return `
            <div class="total-row">
              <span>Subtotal (${receiptData.items.length} ${receiptData.items.length === 1 ? 'item' : 'items'}):</span>
              <span>${formatCurrency(receiptData.subtotal)}</span>
            </div>
            ${receiptData.totalDiscount > 0 ? `
              <div class="total-row discount">
                <span>Descuento:</span>
                <span>-${formatCurrency(receiptData.totalDiscount)}</span>
              </div>
            ` : ''}
            ${creditInfo ? `
              <div style="border: 1px solid #bbb; border-radius: 4px; margin: 8px 0; padding: 8px;">
                <div class="total-row"><span>Capital financiado:</span><span>${formatCurrency(creditInfo.baseTotal)}</span></div>
                <div class="total-row"><span>Costo financiero:</span><span>+${formatCurrency(creditInfo.interestAmount)}</span></div>
                <div class="total-row"><strong>Total financiado:</strong><strong>${formatCurrency(creditInfo.financedTotal)}</strong></div>
                <div style="font-size: 9px; margin-top: 4px;">${creditInfo.installmentCount} cuotas desde ${formatCurrency(creditInfo.installmentAmount)} · Primera cuota: ${formatPosCreditDueDate(creditInfo.firstDueDate)}</div>
              </div>
            ` : ''}
            ${documentKind === 'fiscal' && receiptData.tax > 0 ? `
              <div class="total-row" style="font-size: 10px; color: #555;">
                <span>IVA incluido:</span>
                <span>${formatCurrency(receiptData.tax)}</span>
              </div>
            ` : ''}
            <div class="total-row final pc-total${creditInfo ? ' financed' : ''}">
               <span>${creditInfo ? 'TOTAL CON FINANCIACIÓN:' : 'TOTAL:'}</span>
               <span>${formatCurrency(creditInfo ? summary.totalWithFinancing : totalAmount)}</span>
            </div>
          `
        })()}
      </div>

      <div class="separator"></div>

      <!-- Métodos de pago -->
      <div class="section-title">FORMA DE PAGO</div>
      <div class="payment-section">
        ${receiptData.payments.map(payment => `
          <div class="payment-item">
            <span>
              ${getPaymentMethodLabel(payment.method)}
              ${payment.reference ? ` (${payment.reference})` : ''}
              ${payment.cardLast4 ? ` ****${payment.cardLast4}` : ''}
            </span>
            <span style="font-weight: bold;">${formatCurrency(payment.amount)}</span>
          </div>
        `).join('')}
        ${!creditInfo && receiptData.change && receiptData.change > 0 ? `
          <div class="payment-item change">
            <span>Cambio:</span>
            <span>${formatCurrency(receiptData.change)}</span>
          </div>
        ` : ''}
        ${creditInfo?.firstPayment ? `
          <div style="border-top: 1px dashed #999; margin-top: 8px; padding-top: 6px;">
            <div class="payment-item"><strong>Primera cuota PAGADA:</strong><strong>${formatCurrency(creditInfo.firstPayment.amount)}</strong></div>
            <div class="payment-item"><span>Medio:</span><span>${creditInfo.firstPayment.method === 'cash' ? 'Efectivo' : 'Transferencia'}</span></div>
            ${creditInfo.firstPayment.method === 'transfer' ? `<div style="font-size: 9px;">${creditInfo.firstPayment.bank ? `Banco/cuenta: ${creditInfo.firstPayment.bank}. ` : ''}Referencia: ${creditInfo.firstPayment.reference ?? ''}</div>` : ''}
            ${creditInfo.firstPayment.method === 'cash' ? `<div class="payment-item"><span>Recibido:</span><span>${formatCurrency(creditInfo.firstPayment.cashReceived ?? creditInfo.firstPayment.amount)}</span></div>` : ''}
            ${creditInfo.firstPayment.method === 'cash' && firstPaymentChange(creditInfo.firstPayment) > 0 ? `<div class="payment-item change"><span>Vuelto de la cuota:</span><span>${formatCurrency(firstPaymentChange(creditInfo.firstPayment))}</span></div>` : ''}
            <div style="font-size: 9px;">Este cobro cancela la cuota 1; no es un cargo adicional.</div>
          </div>
        ` : ''}
        ${creditInfo ? `
          <div style="border-top: 1px dashed #999; margin-top: 8px; padding-top: 6px;">
            <div class="payment-item"><span>Cobrado hoy:</span><strong>${formatCurrency(collectedToday)}</strong></div>
            <div class="payment-item"><span>Saldo financiado:</span><strong>${formatCurrency(financedBalance)}</strong></div>
          </div>
        ` : ''}
        <div class="payment-status">${paymentState}</div>
      </div>

      ${receiptData.loyaltyPoints && receiptData.loyaltyPoints > 0 ? `
        <div class="separator"></div>
        <div class="loyalty-box">
          <div class="text">¡Ganaste ${receiptData.loyaltyPoints} puntos de lealtad!</div>
        </div>
      ` : ''}

      <!-- Pie del ticket -->
      <div class="footer">
        <div class="thanks">¡Gracias por su compra!</div>
        <div>Conserve este ticket como comprobante</div>
        <div class="separator"></div>
        ${documentKind === 'internal' ? `<div style="font-size: 8px; color: #999; margin: 6px 0; padding: 6px; border: 1px solid #eee; border-radius: 3px;">
          <strong style="display: block; margin-bottom: 2px; color: #666;">DOCUMENTO NO FISCAL</strong>
          Este ticket es un comprobante interno de venta y NO tiene validez
          tributaria ante la DNIT. No sustituye factura legal.<br>
          Solicite su factura con timbrado vigente si la necesita.
        </div>` : ''}
        ${receiptData.isReprint
          ? `<div class="id"><strong>REIMPRESIÓN</strong> del ${receiptData.date} ${receiptData.time}</div>
             <div class="id">Reimpreso: ${new Date().toLocaleString('es-PY')}</div>`
          : `<div class="id">Generado: ${new Date().toLocaleString('es-PY')}</div>`}
      </div>
    </body>
    </html>
  `
}

// Descargar ticket como PDF real
export const downloadReceipt = async (receiptData: ReceiptData, companyInfo?: CompanyInfo): Promise<void> => {
  try {
    // Importar dinámicamente para evitar problemas de SSR
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default

    const element = document.getElementById('receipt-content')
    if (!element) {
      // Sin la vista del ticket en pantalla (p. ej. desde otra sección) se baja la versión imprimible.
      downloadReceiptHTML(receiptData, companyInfo)
      toast.info('Se descargó el ticket para imprimir', { description: 'Abrilo y elegí «Guardar como PDF» si lo necesitás en PDF.' })
      return
    }

    // Generar canvas del ticket
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
        prepareCloneForHtml2Canvas(clonedDoc, clonedElement)
      }
    })

    // Crear PDF
    const imgData = canvas.toDataURL('image/png')
    // La hoja mide lo que mide el ticket: con 297 mm fijos un ticket largo se
    // cortaba y uno corto quedaba con media hoja en blanco.
    const imgWidth = 80
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [imgWidth, Math.max(60, Math.ceil(imgHeight))],
    })

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(`ticket-${receiptData.receiptNumber}.pdf`)
  } catch (error) {
    console.error('Error generating PDF:', error)
    downloadReceiptHTML(receiptData, companyInfo)
    toast.warning('No se pudo armar el PDF', { description: 'Se descargó el ticket para imprimir en su lugar.' })
  }
}

// Fallback: Descargar como HTML
const downloadReceiptHTML = (receiptData: ReceiptData, companyInfo?: CompanyInfo): void => {
  const printContent = generatePrintHTML(receiptData, companyInfo)
  const blob = new Blob([printContent], { type: 'text/html' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `ticket-${receiptData.receiptNumber}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

const PAYMENT_LABELS: Record<PaymentSplit['method'], string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  credit: 'Crédito',
  store_credit: 'Saldo a favor',
}

/** Lo minimo del emisor que necesita el texto: el nombre basta, el telefono suma. */
type ShareCompany = string | Pick<CompanyInfo, 'name'> & Partial<Pick<CompanyInfo, 'phone'>>

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'semanales',
  biweekly: 'quincenales',
  monthly: 'mensuales',
}

/**
 * El ticket en texto, para WhatsApp o para pegar.
 *
 * Usa el formato propio de WhatsApp (*negrita*, _cursiva_) y va por secciones
 * —productos, pago, credito— para que en el telefono se lea de un vistazo:
 * cuanto pago, como y, si fue a credito, cuanto le queda y cuando vence.
 */
export function buildReceiptShareText(receiptData: ReceiptData, company: ShareCompany): string {
  const companyName = typeof company === 'string' ? company : company.name
  const companyPhone = typeof company === 'string' ? '' : company.phone?.trim() ?? ''
  const creditInfo = receiptData.creditInfo
  const summary = buildReceiptPaymentSummary(receiptData)
  const firstName = receiptData.customer?.name?.trim().split(/\s+/)[0]

  const items = receiptData.items.flatMap((item) => {
    const discount = item.discount ?? 0
    const lineTotal = item.price * item.quantity - discount
    return [
      `• ${item.quantity} × ${item.name} — *${formatCurrency(lineTotal)}*`,
      ...(item.quantity > 1 ? [`   _${formatCurrency(item.price)} c/u_`] : []),
      ...(discount > 0 ? [`   _Descuento: -${formatCurrency(discount)}_`] : []),
    ]
  })

  const totals = [
    ...(receiptData.totalDiscount > 0
      ? [`Subtotal: ${formatCurrency(receiptData.subtotal)}`, `Descuento: -${formatCurrency(receiptData.totalDiscount)}`]
      : []),
    creditInfo
      ? `*Total con financiación: ${formatCurrency(summary.totalWithFinancing)}*`
      : `*Total: ${formatCurrency(receiptData.total)}*`,
  ]

  // La linea "credito" del pago no es dinero que entro: se explica abajo.
  const payments = [
    ...receiptData.payments
      .filter((payment) => payment.method !== 'credit')
      .map((payment) => {
        const detail = payment.cardLast4 ? ` (****${payment.cardLast4})` : payment.reference ? ` (ref. ${payment.reference})` : ''
        return `• ${PAYMENT_LABELS[payment.method] ?? payment.method}${detail}: ${formatCurrency(payment.amount)}`
      }),
    ...(summary.change !== null ? [`• Vuelto: ${formatCurrency(summary.change)}`] : []),
    `✅ *${summary.paymentState}*`,
  ]

  const credit = creditInfo
    ? [
        '*Crédito*',
        `• Total financiado: ${formatCurrency(creditInfo.financedTotal)}`,
        `• ${creditInfo.installmentCount} cuotas ${FREQUENCY_LABELS[creditInfo.frequency] ?? ''} de ${formatCurrency(creditInfo.installmentAmount)}`.replace(/\s{2,}/g, ' '),
        ...(creditInfo.lastInstallmentAmount !== undefined && creditInfo.lastInstallmentAmount !== creditInfo.installmentAmount
          ? [`• Última cuota: ${formatCurrency(creditInfo.lastInstallmentAmount)}`]
          : []),
        creditInfo.firstPayment
          ? `• Primera cuota pagada: ${formatCurrency(creditInfo.firstPayment.amount)}`
          : `• Primera cuota: *${formatPosCreditDueDate(creditInfo.firstDueDate)}*`,
        `• *Saldo pendiente: ${formatCurrency(summary.financedBalance)}*`,
      ]
    : []

  const sections = [
    [
      `*${companyName}*`,
      `🧾 Ticket *${receiptData.receiptNumber}* · ${receiptData.date} ${receiptData.time}`,
      ...(receiptData.isReprint ? ['_Reimpresión_'] : []),
    ],
    [firstName ? `Hola ${firstName}, gracias por tu compra. Este es el detalle:` : 'Gracias por tu compra. Este es el detalle:'],
    ['*Productos*', ...items],
    totals,
    ['*Pago*', ...payments],
    credit,
    [
      ...(companyPhone ? [`Consultas: ${companyPhone}`] : []),
      '_Comprobante interno, no válido como factura._',
    ],
  ]

  return sections
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.join('\n'))
    .join('\n\n')
}

/** Teléfono para wa.me: solo dígitos y, si empieza con 0 (0981…), con el 595 de Paraguay. */
export function whatsappNumber(phone: string | undefined | null): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 6) return null
  return digits.startsWith('0') ? `595${digits.slice(1)}` : digits
}

/** Enlace para mandar el ticket por WhatsApp: al cliente si tiene teléfono; si no, para elegir el contacto. */
export function receiptWhatsAppHref(receiptData: ReceiptData, company: ShareCompany): string {
  const number = whatsappNumber(receiptData.customer?.phone)
  const text = encodeURIComponent(buildReceiptShareText(receiptData, company))
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`
}

export const sendReceiptByWhatsApp = (receiptData: ReceiptData, companyInfo?: CompanyInfo): void => {
  const company = { name: companyInfo?.name || config.company.name, phone: companyInfo?.phone }
  window.open(receiptWhatsAppHref(receiptData, company), '_blank', 'noopener,noreferrer')
}

const isShareCancelled = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

// Compartir el ticket: como imagen si el dispositivo lo permite; si no, como texto.
export const shareReceipt = async (receiptData: ReceiptData, companyInfo?: CompanyInfo): Promise<void> => {
  const company = { name: companyInfo?.name || config.company.name, phone: companyInfo?.phone }
  const shareText = buildReceiptShareText(receiptData, company)
  const title = `Ticket ${receiptData.receiptNumber}`

  try {
    const element = document.getElementById('receipt-content')
    if (element && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
          prepareCloneForHtml2Canvas(clonedDoc, clonedElement)
        }
      })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      const file = blob ? new File([blob], `ticket-${receiptData.receiptNumber}.png`, { type: 'image/png' }) : null
      // En compu muchos navegadores comparten texto pero no archivos: se pregunta antes.
      if (file && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text: shareText, files: [file] })
        return
      }
    }
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text: shareText })
      return
    }
  } catch (error) {
    // Cerrar la ventana de compartir no es un error: antes abría una segunda con el texto.
    if (isShareCancelled(error)) return
    console.error('Error sharing receipt:', error)
  }

  fallbackShare(shareText)
}

// Compartir alternativo (copiar al portapapeles)
const fallbackShare = (text: string): void => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Ticket copiado', { description: 'Pegalo en WhatsApp, un mail o donde lo necesites.' })
    }).catch(() => {
      showShareModal(text)
    })
  } else {
    showShareModal(text)
  }
}

// Mostrar modal con información para compartir
const showShareModal = (text: string): void => {
  const modal = document.createElement('div')
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `

  const content = document.createElement('div')
  content.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 400px;
    width: 90%;
  `

  content.innerHTML = `
    <h3 style="margin-top: 0;">Compartir Ticket</h3>
    <textarea readonly style="width: 100%; height: 220px; margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px;"></textarea>
    <div style="text-align: right;">
      <button onclick="this.closest('[style*=fixed]').remove()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Cerrar</button>
    </div>
  `
  // Como valor y no dentro del HTML: un nombre de producto con "<" rompia el
  // contenido o inyectaba marcado.
  const textarea = content.querySelector('textarea')
  if (textarea) textarea.value = text

  modal.appendChild(content)
  document.body.appendChild(modal)

  // Cerrar al hacer clic fuera
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove()
    }
  })
}
import { config } from './config'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { formatPosCreditDueDate } from '@/lib/credits/pos-credit-summary'
import { HIGH_CONTRAST_PRINT_CSS } from '@/lib/print-contrast'
import { escapeHtmlDeep } from '@/lib/html-escape'
