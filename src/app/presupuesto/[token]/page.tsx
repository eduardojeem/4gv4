import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { formatCurrency } from '@/lib/currency'
import { QUOTE_STATUS_LABELS, isQuoteExpired, quoteCode, whatsappNumber, type QuoteStatus } from '@/lib/quotes/quote-math'
import { PrintButton } from './PrintButton'

export const dynamic = 'force-dynamic'

// Un presupuesto es de un cliente: no se indexa ni se cachea en buscadores.
export const metadata: Metadata = {
  title: 'Presupuesto',
  robots: { index: false, follow: false },
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Quote = {
  id: string
  organization_id: string
  number: number
  customer_name: string
  customer_ruc: string | null
  status: QuoteStatus
  price_mode: 'retail' | 'wholesale'
  valid_until: string | null
  notes: string | null
  currency: string
  subtotal: number
  discount_total: number
  total: number
  created_at: string
}

type Item = { id: string; description: string; sku: string | null; quantity: number; unit_price: number; discount_rate: number; line_total: number }

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function loadPublicQuote(token: string) {
  if (!UUID.test(token)) return null
  const admin = createAdminSupabase()
  const { data: quote } = await admin
    .from('quotes')
    .select('id, organization_id, number, customer_name, customer_ruc, status, price_mode, valid_until, notes, currency, subtotal, discount_total, total, created_at')
    .eq('share_token', token)
    .maybeSingle()
  if (!quote) return null
  const q = quote as Quote
  const [{ data: items }, { data: org }, { data: info }] = await Promise.all([
    admin.from('quote_items').select('id, description, sku, quantity, unit_price, discount_rate, line_total').eq('quote_id', q.id).order('position'),
    admin.from('organizations').select('name, logo_url').eq('id', q.organization_id).maybeSingle(),
    admin.from('website_settings').select('value').eq('organization_id', q.organization_id).eq('key', 'company_info').maybeSingle(),
  ])
  const company = ((info as { value?: Record<string, unknown> } | null)?.value ?? {}) as Record<string, unknown>
  const organization = org as { name?: string; logo_url?: string | null } | null
  return {
    quote: q,
    items: (items ?? []) as Item[],
    store: {
      name: text(company.name) ?? organization?.name ?? 'Tienda',
      logo: text(company.logoUrl) ?? organization?.logo_url ?? null,
      ruc: text(company.ruc),
      address: text(company.address),
      phone: text(company.phone),
      whatsapp: text(company.whatsapp),
      email: text(company.email),
    },
  }
}

const date = (value: string) => value.slice(0, 10).split('-').reverse().join('/')

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const data = await loadPublicQuote(token)
  if (!data) notFound()
  const { quote, items, store } = data
  const money = (amount: number) => formatCurrency(Number(amount), { currency: quote.currency })
  const expired = (quote.status === 'draft' || quote.status === 'sent') && isQuoteExpired(quote.valid_until)
  const closed = quote.status === 'cancelled' || quote.status === 'rejected'
  const wa = whatsappNumber(store.whatsapp)
  const acceptUrl = wa && !closed && !expired && quote.status !== 'converted'
    ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hola! Acepto el presupuesto ${quoteCode(quote.number)} por ${money(quote.total)}.`)}`
    : null
  const showDiscount = items.some((item) => Number(item.discount_rate) > 0)

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          {acceptUrl && (
            <a href={acceptUrl} className="inline-flex items-center rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5a]">
              Aceptar por WhatsApp
            </a>
          )}
          <PrintButton />
        </div>

        <article className="rounded-2xl bg-white p-6 shadow-sm sm:p-10 print:rounded-none print:p-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
            <div className="flex items-start gap-3">
              {store.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logo} alt="" className="h-14 w-14 rounded-lg object-contain" />
              )}
              <div className="text-sm">
                <p className="text-lg font-bold">{store.name}</p>
                {store.ruc && <p>RUC {store.ruc}</p>}
                {store.address && <p className="text-slate-600">{store.address}</p>}
                <p className="text-slate-600">{[store.whatsapp || store.phone, store.email].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Presupuesto</p>
              <p className="font-mono text-2xl font-bold">{quoteCode(quote.number)}</p>
              <p className="text-slate-600">Fecha: {date(quote.created_at)}</p>
              {quote.valid_until && <p className={expired ? 'font-semibold text-amber-700' : 'text-slate-600'}>Válido hasta: {date(quote.valid_until)}{expired ? ' (vencido)' : ''}</p>}
            </div>
          </header>

          {(closed || quote.status === 'converted') && (
            <p className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${closed ? 'bg-red-50 text-red-700' : 'bg-violet-50 text-violet-700'}`}>
              {quote.status === 'converted' ? 'Este presupuesto ya se convirtió en una compra. ¡Gracias!' : `Presupuesto ${QUOTE_STATUS_LABELS[quote.status].toLowerCase()}.`}
            </p>
          )}

          <section className="py-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</p>
            <p className="text-base font-semibold">{quote.customer_name}</p>
            {quote.customer_ruc && <p className="text-slate-600">RUC / CI {quote.customer_ruc}</p>}
            {quote.price_mode === 'wholesale' && <p className="text-slate-600">Precios mayoristas</p>}
          </section>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-900 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2">Descripción</th>
                  <th className="py-2 text-right">Cant.</th>
                  <th className="py-2 text-right">Precio</th>
                  {showDiscount && <th className="py-2 text-right">Desc.</th>}
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b align-top">
                    <td className="py-2 pr-3">
                      {item.description}
                      {item.sku && <span className="block text-xs text-slate-500">{item.sku}</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{money(item.unit_price)}</td>
                    {showDiscount && <td className="py-2 text-right tabular-nums">{Number(item.discount_rate) > 0 ? `${Number(item.discount_rate)}%` : '—'}</td>}
                    <td className="py-2 text-right font-medium tabular-nums">{money(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
            {Number(quote.discount_total) > 0 && (
              <>
                <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="tabular-nums">{money(quote.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600">Descuentos</dt><dd className="tabular-nums">−{money(quote.discount_total)}</dd></div>
              </>
            )}
            <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{money(quote.total)}</dd></div>
          </dl>

          {quote.notes && (
            <section className="mt-6 rounded-lg bg-slate-50 p-4 text-sm print:bg-white print:p-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Condiciones</p>
              <p className="whitespace-pre-line">{quote.notes}</p>
            </section>
          )}

          <footer className="mt-8 border-t pt-4 text-xs text-slate-500">
            Precios sujetos a disponibilidad de stock. Este presupuesto no es un comprobante de venta.
          </footer>
        </article>
      </div>
    </main>
  )
}
