import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { lineTotal, unitPrice, type CartLine, type cartTotals, type PaymentInput, type PosSession, type PriceMode } from './pos';
import { FREQUENCY_LABEL, shortDate, type CreditPlan, type CreditTerms } from './pos-credit';
import { secureStorage } from './secure-storage';

/**
 * Comprobante de venta del POS para imprimir (impresora térmica o común, por
 * el servicio de impresión del sistema) o compartir en PDF. Lleva los mismos
 * datos que el ticket del POS web.
 */

export type PaperFormat = '58mm' | '80mm' | 'A4';

export type SaleReceipt = {
  business: PosSession['business'];
  saleId: string;
  date: Date;
  branchName?: string;
  registerName?: string;
  customer?: { name: string; ruc?: string | null; phone?: string | null } | null;
  lines: CartLine[];
  priceMode: PriceMode;
  totals: ReturnType<typeof cartTotals>;
  pricing: PosSession['pricing'];
  payments: PaymentInput[];
  change: number;
  points?: number;
  notes?: string;
  /** Venta a crédito: el plan de cuotas firmado. */
  credit?: { terms: CreditTerms; plan: CreditPlan } | null;
};

const PAPER_KEY = 'pos.receipt.paper';

export async function savedPaper(): Promise<PaperFormat> {
  const value = await secureStorage.getItem(PAPER_KEY).catch(() => null);
  return value === '58mm' || value === 'A4' ? value : '80mm';
}

export async function rememberPaper(format: PaperFormat) {
  await secureStorage.setItem(PAPER_KEY, format).catch(() => undefined);
}

const METHOD: Record<PaymentInput['method'], string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', credit: 'A crédito' };
const gs = (value: number) => `Gs. ${Math.round(value).toLocaleString('es-PY')}`;
const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const saleNumber = (saleId: string) => saleId.slice(0, 8).toUpperCase();

// Ancho en puntos (72 por pulgada), que es lo que espera expo-print.
const WIDTH: Record<PaperFormat, number> = { '58mm': 164, '80mm': 227, A4: 595 };

export function receiptHtml(receipt: SaleReceipt, format: PaperFormat) {
  const ticket = format !== 'A4';
  const narrow = format === '58mm';
  const { business, totals } = receipt;
  const when = receipt.date.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const issuer = [business.ruc ? `RUC ${business.ruc}` : '', business.address, business.phone ? `Tel. ${business.phone}` : ''].filter(Boolean);

  const items = receipt.lines
    .map((line) => {
      const unit = unitPrice(line.product, receipt.priceMode);
      const discount = line.discount > 0 ? `<div class="sub">Desc. −${gs(line.discount)}</div>` : '';
      return ticket
        ? `<div class="item"><div class="name">${esc(line.product.name)}</div><div class="row"><span>${line.quantity} × ${gs(unit)}</span><b>${gs(lineTotal(line, receipt.priceMode))}</b></div>${discount}</div>`
        : `<tr><td>${esc(line.product.name)}${line.product.sku ? `<div class="sub">${esc(line.product.sku)}</div>` : ''}${discount}</td><td class="num">${line.quantity}</td><td class="num">${gs(unit)}</td><td class="num"><b>${gs(lineTotal(line, receipt.priceMode))}</b></td></tr>`;
    })
    .join('');

  const totalRows = [
    ['Subtotal', gs(totals.subtotal)],
    totals.discount > 0 ? ['Descuentos', `−${gs(totals.discount)}`] : null,
    !receipt.pricing.pricesIncludeTax && totals.tax > 0 ? [`IVA ${receipt.pricing.taxRate}%`, gs(totals.tax)] : null,
  ]
    .filter((row): row is string[] => Boolean(row))
    .map(([label, value]) => `<div class="row"><span>${label}</span><span>${value}</span></div>`)
    .join('');

  const paymentRows = [
    ...receipt.payments.map((payment) => {
      const extra = payment.method === 'card' && payment.cardLast4 ? ` ****${esc(payment.cardLast4)}` : payment.method === 'transfer' && payment.reference ? ` · Ref. ${esc(payment.reference)}` : '';
      return `<div class="row"><span>${METHOD[payment.method]}${extra}</span><span>${gs(payment.amount)}</span></div>`;
    }),
    receipt.change > 0 ? `<div class="row"><span>Vuelto</span><span>${gs(receipt.change)}</span></div>` : '',
  ].join('');

  const includedTax =
    receipt.pricing.pricesIncludeTax && receipt.pricing.taxRate > 0
      ? `<div class="sub center">IVA incluido (${receipt.pricing.taxRate}%): ${gs(totals.total - totals.total / (1 + receipt.pricing.taxRate / 100))}</div>`
      : '';

  const credit = receipt.credit
    ? `<div class="sep"></div><div class="center title">PLAN DE CUOTAS</div>
<div class="row"><span>Financiado</span><span>${gs(receipt.credit.plan.principal)}</span></div>
${receipt.credit.plan.interestAmount > 0 ? `<div class="row"><span>Interés ${receipt.credit.terms.interestRate}%</span><span>${gs(receipt.credit.plan.interestAmount)}</span></div>` : ''}
<div class="row"><b>Total en cuotas</b><b>${gs(receipt.credit.plan.financedTotal)}</b></div>
<div class="sub">${receipt.credit.plan.installments.length} cuota(s) ${FREQUENCY_LABEL[receipt.credit.terms.frequency].toLowerCase()}</div>
${receipt.credit.plan.installments.map((row) => `<div class="row"><span>${row.number}. ${shortDate(row.dueDate)}${row.number === 1 && receipt.credit?.terms.firstPayment ? ' · PAGADA' : ''}</span><span>${gs(row.amount)}</span></div>`).join('')}
${receipt.credit.terms.firstPayment ? `<div class="sub">Cuota 1 cobrada al vender (${receipt.credit.terms.firstPayment.method === 'cash' ? 'efectivo' : 'transferencia'}).</div>` : ''}
<div class="sign">Firma del cliente</div>`
    : '';

  const customer = receipt.customer
    ? `<div class="block"><div><b>Cliente:</b> ${esc(receipt.customer.name)}</div>${receipt.customer.ruc ? `<div><b>CI/RUC:</b> ${esc(receipt.customer.ruc)}</div>` : ''}${receipt.customer.phone ? `<div><b>Tel.:</b> ${esc(receipt.customer.phone)}</div>` : ''}</div>`
    : '';

  const page = ticket ? `@page{size:${format} auto;margin:2mm}` : '@page{size:A4;margin:14mm}';
  const css = ticket
    ? `body{width:${narrow ? '54mm' : '74mm'};font-size:${narrow ? 10 : 12}px}`
    : 'body{max-width:180mm;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:8px}th{text-align:left;border-bottom:1.5px solid #000;padding:6px 4px;font-size:11px;text-transform:uppercase}td{border-bottom:1px solid #ddd;padding:6px 4px;vertical-align:top}.num{text-align:right;white-space:nowrap}.totals{margin-left:auto;width:45%}';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${page}*{box-sizing:border-box}body{margin:0 auto;font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#000;line-height:1.35}
.center{text-align:center}.biz{font-size:1.45em;font-weight:800}.sub{font-size:.85em;color:#333}.title{font-weight:800;letter-spacing:.06em;margin-top:6px}
.sep{border-top:1px dashed #000;margin:7px 0}.row{display:flex;justify-content:space-between;gap:6px}.item{margin:4px 0}.name{font-weight:600}
.total{display:flex;justify-content:space-between;font-size:1.35em;font-weight:900;margin:4px 0}.block{margin:4px 0}.thanks{margin-top:10px;font-weight:700}.sign{margin-top:28px;border-top:1px solid #000;padding-top:3px;text-align:center;font-size:.85em}
${css}</style></head><body>
<div class="center"><div class="biz">${esc(business.name)}</div>${issuer.map((line) => `<div class="sub">${esc(line)}</div>`).join('')}
<div class="title">COMPROBANTE DE VENTA</div><div class="sub">N.º ${saleNumber(receipt.saleId)} · ${when}</div>
${receipt.branchName || receipt.registerName ? `<div class="sub">${esc([receipt.branchName, receipt.registerName].filter(Boolean).join(' · '))}</div>` : ''}
<div class="sub">Documento interno · no válido como factura</div></div>
<div class="sep"></div>${customer}${customer ? '<div class="sep"></div>' : ''}
${ticket ? items : `<table><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Total</th></tr></thead><tbody>${items}</tbody></table>`}
<div class="sep"></div><div class="${ticket ? '' : 'totals'}">${totalRows}<div class="total"><span>TOTAL</span><span>${gs(totals.total)}</span></div>${includedTax}
<div class="sep"></div>${paymentRows}</div>${credit}
${receipt.priceMode === 'wholesale' ? '<div class="sub center">Precio mayorista</div>' : ''}
${receipt.points ? `<div class="sub center">+${receipt.points} puntos de fidelidad</div>` : ''}
${receipt.notes?.trim() ? `<div class="block sub">Nota: ${esc(receipt.notes.trim())}</div>` : ''}
<div class="center thanks">¡Gracias por tu compra!</div></body></html>`;
}

/** Alto aproximado del ticket para el PDF (la térmica corta sola; el PDF necesita un alto). */
function ticketHeight(receipt: SaleReceipt) {
  const credit = receipt.credit ? 120 + receipt.credit.plan.installments.length * 14 : 0;
  return Math.round(260 + receipt.lines.length * 34 + receipt.payments.length * 14 + (receipt.customer ? 50 : 0) + (receipt.notes ? 30 : 0) + credit);
}

export async function printReceipt(receipt: SaleReceipt, format: PaperFormat) {
  await Print.printAsync({ html: receiptHtml(receipt, format), width: WIDTH[format], ...(format === 'A4' ? { height: 842 } : {}) });
}

export async function shareReceiptPdf(receipt: SaleReceipt, format: PaperFormat) {
  const { uri } = await Print.printToFileAsync({
    html: receiptHtml(receipt, format),
    width: WIDTH[format],
    height: format === 'A4' ? 842 : ticketHeight(receipt),
  });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este teléfono no permite compartir archivos.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Comprobante ${saleNumber(receipt.saleId)}` });
}
