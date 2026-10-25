import { escapeHtml } from '@/lib/html-escape'
import { installmentProgressLayout } from './installment-progress-layout'

export type ThermalPrintSection = {
  title: string
  columns?: string[]
  rows: string[][]
  installmentProgress?: { paid: number; total: number }
}

type ThermalPrintInput = {
  title: string
  issuer: string[]
  metadata: string[]
  sections: ThermalPrintSection[]
  contentWidthMm: number
  fontSizePt: number
  footer: string
  signature?: boolean
}

// The print view belongs to this document, never to another customer's receipt.
// Weak keys also release the HTML when the PDF is no longer referenced.
const thermalDocuments = new WeakMap<object, string>()

export function getThermalPrintHtml(doc: object): string | undefined {
  return thermalDocuments.get(doc)
}

/** Native HTML printing reflows within the driver's usable width. A fixed-width
 * PDF can instead be cropped by Chrome's default/actual-size scaling. */
export function registerThermalPrintDocument(doc: object, input: ThermalPrintInput): void {
  const lines = (values: string[]) => values.filter(Boolean).map(value => `<p>${escapeHtml(value)}</p>`).join('')
  const sections = input.sections.filter(section => section.rows.length).map(section => {
    const head = section.columns
      ? `<thead><tr>${section.columns.map(value => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead>`
      : ''
    const rows = section.rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')
    const progress = section.installmentProgress
    const layout = progress && installmentProgressLayout(progress.total, progress.paid, input.contentWidthMm)
    let progressHtml = ''
    if (progress && layout) {
      // SVG foregrounds remain printable when background graphics are disabled.
      const boxes = layout.boxes.map(box =>
        `<rect x="${box.x + 0.15}" y="${box.y + 0.15}" width="3.7" height="3.7" fill="${box.paid ? '#000' : 'none'}" stroke="#000" stroke-width="0.3"/>`
      ).join('')
      progressHtml = `<div class="installment-progress" role="progressbar" aria-label="Cuotas pagadas" aria-valuemin="0" aria-valuenow="${progress.paid}" aria-valuemax="${progress.total}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" style="width:${layout.width}mm;max-width:100%;height:auto" aria-hidden="true">${boxes}</svg><p>${layout.label}</p></div>`
    }
    return `<section><h2>${escapeHtml(section.title)}</h2><table class="${section.columns ? 'schedule' : 'pairs'}">${head}<tbody>${rows}</tbody></table>${progressHtml}</section>`
  }).join('')
  thermalDocuments.set(doc, `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(input.title)}</title><style>
@page{margin:2mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%;height:auto;color:#000;background:#fff}
body{font-family:Arial,Helvetica,sans-serif;font-size:${input.fontSizePt}pt;font-weight:700;line-height:1.35}
main{width:100%;max-width:${input.contentWidthMm}mm;margin:0;overflow:visible}
p,h1,h2{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
header{text-align:center;margin-bottom:3mm}
header p:first-child{font-size:1.25em}
h1{font-size:1.2em;margin:2mm 0}
h2{font-size:1em;border-bottom:.3mm solid #000;padding:1mm 0;break-after:avoid}
section{margin:3mm 0}
.installment-progress{margin-top:2mm;break-inside:avoid;text-align:center}
.installment-progress svg{display:block;margin:0 auto 2mm}
table{width:100%;table-layout:fixed;border-collapse:collapse}
td,th{padding:1mm .5mm;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal}
.pairs td:first-child{width:40%}.pairs td:last-child{width:60%}
thead{display:table-header-group}tr{break-inside:avoid}
footer{margin-top:5mm;text-align:center;break-inside:avoid}
.signature{border-top:.2mm dashed #000;margin:8mm 4mm 3mm;padding-top:2mm}
</style></head><body><main><header>${lines(input.issuer)}<h1>${escapeHtml(input.title)}</h1>${lines(input.metadata)}</header>
${sections}<footer>${input.signature ? '<p class="signature">Firma / Sello de cobranza</p>' : ''}<p>${escapeHtml(input.footer)}</p></footer>
</main></body></html>`)
}
