import { formatMobileCurrency } from './regional-format';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted' | 'cancelled';

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  converted: 'Vendido',
  cancelled: 'Anulado',
};

export function quoteCode(number: number) {
  return `P-${String(number).padStart(5, '0')}`;
}

export function quoteStatusLabel(status: QuoteStatus) {
  return STATUS_LABELS[status];
}

export function formatQuoteAmount(amount: number, currency: string) {
  return formatMobileCurrency(amount, currency || 'PYG');
}
