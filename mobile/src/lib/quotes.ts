import { apiFetch } from './api';
import type { QuoteStatus } from './quote-display';
export { formatQuoteAmount, quoteCode, quoteStatusLabel } from './quote-display';

export type { QuoteStatus } from './quote-display';
export type QuoteFilter = 'all' | 'open' | 'closed' | QuoteStatus;

export type MobileQuote = {
  id: string;
  number: number;
  customer_name: string;
  status: QuoteStatus;
  total: number;
  currency: string;
  valid_until: string | null;
  created_at: string;
};

export type MobileQuotePage = {
  available: boolean;
  quotes: MobileQuote[];
  pagination: { page: number; pageSize: number; total: number };
};

export async function fetchQuotes(params: { page?: number; status?: QuoteFilter; query?: string } = {}) {
  const search = new URLSearchParams({ page: String(params.page ?? 1) });
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.query?.trim()) search.set('q', params.query.trim());
  return apiFetch<MobileQuotePage>(`/api/mobile/quotes?${search.toString()}`);
}
