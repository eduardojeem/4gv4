import { z } from 'zod';

const text = z.string().nullable().optional();
const money = z.number().finite().nonnegative();
const optionalMoney = money.nullable().optional();
const dateTime = z.string().datetime({ offset: true });
const common = {
  receiptNumber: z.string().trim().min(1),
  customerName: z.string().min(1),
  businessName: text, businessRuc: text, businessPhone: text, businessAddress: text,
  currency: z.string().regex(/^[A-Z]{3}$/),
  timeZone: z.string().min(1),
  paymentMethod: z.enum(['cash', 'card', 'transfer']),
  notes: text,
};
const snapshotSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('credit'), input: z.object({
    ...common, paymentDate: dateTime, paymentAmount: money.positive(),
    reference: text, customerRuc: text, creditCode: text, creditLabel: text,
    installmentNumber: optionalMoney, currentCreditBalance: optionalMoney,
    totalCreditAmount: optionalMoney, totalPaidAmount: optionalMoney,
  }) }),
  z.object({ kind: z.literal('global'), input: z.object({
    ...common, paidAt: dateTime, totalAmount: money.positive(),
    customerDocument: text, referenceNumber: text, voucherNumber: text,
    excessToStoreCredit: money, otherPendingAmount: optionalMoney,
    allocations: z.array(z.object({
      id: z.string(), type: z.enum(['repair', 'installment']), title: z.string(),
      allocatedAmount: money, totalAmount: money, newPending: money,
    })).min(1),
  }) }),
]);

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const methodNames = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

/** Uses the immutable payment snapshot, never today's customer balances/settings. */
export function paymentReceiptHtml(snapshot: unknown): string {
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) throw new Error('El comprobante guardado está incompleto. No se generó un PDF.');
  const receipt = parsed.data;
  const input = receipt.input;
  const formatMoney = (amount: number) => escapeHtml(new Intl.NumberFormat('es-PY', {
    style: 'currency', currency: input.currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount));
  const date = receipt.kind === 'credit' ? receipt.input.paymentDate : receipt.input.paidAt;
  let formattedDate: string;
  try {
    formattedDate = new Intl.DateTimeFormat('es-PY', {
      timeZone: input.timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(date));
  } catch { throw new Error('No se pudo verificar la fecha del comprobante.'); }
  const line = (label: string, value: string) => '<div class="row"><span>' + escapeHtml(label) + '</span><b>' + value + '</b></div>';
  const amount = receipt.kind === 'credit' ? receipt.input.paymentAmount : receipt.input.totalAmount;
  let detail: string;
  if (receipt.kind === 'credit') {
    const original = receipt.input;
    detail = [
      original.creditCode ? line('Crédito', escapeHtml(original.creditCode)) : '',
      original.creditLabel ? line('Detalle', escapeHtml(original.creditLabel)) : '',
      original.installmentNumber != null ? line('Cuota', escapeHtml(original.installmentNumber)) : '',
      original.currentCreditBalance != null ? line('Saldo al registrar el pago', formatMoney(original.currentCreditBalance)) : '',
      original.reference ? line('Referencia / cupón', escapeHtml(original.reference)) : '',
    ].join('');
  } else {
    const original = receipt.input;
    const applied = original.allocations.reduce((sum, item) => sum + item.allocatedAmount, 0);
    if (Math.abs(applied + original.excessToStoreCredit - original.totalAmount) > 0.011)
      throw new Error('El importe del comprobante no coincide con sus aplicaciones.');
    detail = '<table><thead><tr><th>Concepto</th><th>Aplicado</th><th>Saldo al pagar</th></tr></thead><tbody>' +
      original.allocations.map(item => '<tr><td>' + escapeHtml(item.title) + '</td><td>' +
        formatMoney(item.allocatedAmount) + '</td><td>' + formatMoney(item.newPending) + '</td></tr>').join('') +
      '</tbody></table>' +
      (original.excessToStoreCredit > 0 ? line('Saldo a favor', formatMoney(original.excessToStoreCredit)) : '') +
      (original.referenceNumber ? line('Referencia', escapeHtml(original.referenceNumber)) : '') +
      (original.voucherNumber ? line('Cupón', escapeHtml(original.voucherNumber)) : '');
  }
  return [
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">',
    '<title>Comprobante de pago</title><style>',
    '@page{margin:32px}body{font-family:Arial,sans-serif;font-size:13px;color:#172033;line-height:1.5}h1{font-size:23px;margin:0}h2{font-size:17px;margin:0 0 6px}.header{border-bottom:3px solid #334155;padding-bottom:20px}.muted{color:#526173;font-size:11px}.section{padding:18px 0;border-bottom:1px solid #dce2e8}.row{display:flex;justify-content:space-between;gap:20px;margin:7px 0}.row b{text-align:right}.total{background:#eef2f6;border-radius:8px;padding:16px;margin:20px 0;font-size:20px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:9px 5px;border-bottom:1px solid #dce2e8;text-align:right;vertical-align:top}th:first-child,td:first-child{text-align:left;width:48%}thead{display:table-header-group}tr{break-inside:avoid}b,td,p{overflow-wrap:anywhere}footer{margin-top:22px;font-size:10px;color:#526173}',
    '</style></head><body><header class="header">',
    input.businessName ? '<h2>' + escapeHtml(input.businessName) + '</h2>' : '',
    input.businessRuc ? '<div>RUC: ' + escapeHtml(input.businessRuc) + '</div>' : '',
    input.businessAddress ? '<div class="muted">' + escapeHtml(input.businessAddress) + '</div>' : '',
    input.businessPhone ? '<div class="muted">Tel.: ' + escapeHtml(input.businessPhone) + '</div>' : '',
    '<h1>Comprobante de pago</h1><div>N.º ' + escapeHtml(input.receiptNumber) + '</div>',
    '<div class="muted">' + escapeHtml(formattedDate) + ' · ' + escapeHtml(input.timeZone) + '</div></header>',
    '<section class="section">' + line('Cliente', escapeHtml(input.customerName)) +
      line('Medio de pago', escapeHtml(methodNames[input.paymentMethod])) + '</section>',
    '<section class="section">' + detail + '</section>',
    '<div class="total">' + line('Total cobrado', formatMoney(amount)) + '</div>',
    input.notes ? '<p>Observaciones: ' + escapeHtml(input.notes) + '</p>' : '',
    '<footer>Comprobante de un pago registrado. No sustituye una factura fiscal. Los saldos corresponden al momento del pago.',
    input.paymentMethod !== 'cash' ? ' El registro no confirma la acreditación bancaria.' : '',
    '</footer></body></html>',
  ].join('');
}
