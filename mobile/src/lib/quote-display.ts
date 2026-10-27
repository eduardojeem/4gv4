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
  try {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: currency || 'PYG',
      maximumFractionDigits: currency === 'PYG' ? 0 : 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `Gs. ${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString('es-PY')}`;
  }
}
