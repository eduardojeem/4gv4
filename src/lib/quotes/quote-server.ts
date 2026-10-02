import type { QuoteInput } from '@/lib/quotes/quote-api'
import { QUOTE_COLUMNS, QUOTE_ITEM_COLUMNS } from '@/lib/quotes/quote-api'
import type { createClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

export async function organizationCurrency(supabase: Client, organizationId: string): Promise<string> {
  const { data } = await supabase.from('organization_settings').select('currency').eq('organization_id', organizationId).maybeSingle()
  return (data as { currency?: string } | null)?.currency || 'PYG'
}

/**
 * Los productos y variantes de las líneas tienen que ser de la empresa: el
 * id llega del navegador y la clave foránea no mira la organización.
 */
export async function assertQuoteProducts(supabase: Client, organizationId: string, items: QuoteInput['items']): Promise<string | null> {
  const productIds = [...new Set(items.map((item) => item.product_id).filter((id): id is string => Boolean(id)))]
  if (productIds.length) {
    const { data } = await supabase.from('products').select('id').eq('organization_id', organizationId).in('id', productIds)
    if ((data ?? []).length !== productIds.length) return 'Uno de los productos no existe o no es de tu empresa'
  }
  const variantPairs = items.filter((item) => item.product_id && item.variant_id)
  if (variantPairs.length) {
    const { data } = await supabase
      .from('product_variants')
      .select('id, product_id')
      .eq('organization_id', organizationId)
      .in('id', variantPairs.map((item) => item.variant_id as string))
    const valid = new Set(((data ?? []) as Array<{ id: string; product_id: string }>).map((row) => `${row.product_id}:${row.id}`))
    if (variantPairs.some((item) => !valid.has(`${item.product_id}:${item.variant_id}`))) return 'Una de las variantes no existe'
  }
  return null
}

export type StoredQuote = Record<string, unknown> & { id: string; status: string; share_token: string; sale_id: string | null; items: unknown[] }

export async function loadQuote(supabase: Client, organizationId: string, id: string): Promise<StoredQuote | null> {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select(QUOTE_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle()
  if (error || !quote) return null
  const { data: items } = await supabase
    .from('quote_items')
    .select(QUOTE_ITEM_COLUMNS)
    .eq('quote_id', id)
    .order('position')
  return Object.assign({}, quote as unknown as StoredQuote, { items: (items ?? []) as unknown[] })
}
