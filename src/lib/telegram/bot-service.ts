/**
 * Servicio de Asistente de Clientes para Telegram Bot
 * Permite a los clientes buscar productos, consultar precios, stock y categorías en tiempo real.
 */

import { createAdminSupabase } from '@/lib/supabase/admin'
import { formatCurrency } from '@/lib/currency'

export interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name?: string; last_name?: string; username?: string }
  chat: { id: number; type: string }
  text?: string
}

export interface TelegramCallbackQuery {
  id: string
  from: { id: number; first_name?: string }
  message?: TelegramMessage
  data?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

/**
 * Envía un mensaje de texto formateado con teclado interactivo opcional a Telegram.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<boolean> {
  if (!BOT_TOKEN) return false

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Responde a un callback_query para quitar el spinner en el cliente de Telegram.
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    })
  } catch {
    // Silencioso
  }
}

/**
 * Obtiene la organización asociada al bot o la primera activa registrada.
 */
async function getTargetOrganization(admin = createAdminSupabase()) {
  const envOrgId = process.env.TELEGRAM_ORG_ID
  if (envOrgId) {
    const { data } = await admin.from('organizations').select('id, name, slug').eq('id', envOrgId).maybeSingle()
    if (data) return data
  }

  const slug = process.env.TELEGRAM_ORG_SLUG || process.env.DEFAULT_PUBLIC_ORG_SLUG
  if (slug) {
    const { data } = await admin.from('organizations').select('id, name, slug').eq('slug', slug).maybeSingle()
    if (data) return data
  }

  // Fallback inteligente: seleccionar la organización con catálogo activo
  const { data: sampleProduct } = await admin
    .from('products')
    .select('organization_id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (sampleProduct?.organization_id) {
    const { data } = await admin
      .from('organizations')
      .select('id, name, slug')
      .eq('id', sampleProduct.organization_id)
      .maybeSingle()
    if (data) return data
  }

  const { data } = await admin
    .from('organizations')
    .select('id, name, slug')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data
}

/**
 * Busca productos en la base de datos por nombre, marca, descripción, SKU o código de barras.
 */
export async function searchProducts(searchTerm: string, limit = 5) {
  const admin = createAdminSupabase()
  const org = await getTargetOrganization(admin)
  if (!org) return { org: null, products: [] }

  const cleanQuery = searchTerm.replace(/[.,()!<>=&|%:*\\]/g, '').trim()
  if (!cleanQuery) return { org, products: [] }

  let query = admin
    .from('products')
    .select('id, name, brand, sale_price, offer_price, has_offer, stock_quantity, image_url, description, barcode, sku, category:categories(id, name)')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .or(`name.ilike.%${cleanQuery}%,brand.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%,sku.ilike.%${cleanQuery}%,barcode.ilike.%${cleanQuery}%`)
    .order('stock_quantity', { ascending: false })
    .limit(limit)

  const { data, error } = await query

  if (error || !data) {
    return { org, products: [] }
  }

  return { org, products: data as unknown as BotProductItem[] }
}

/**
 * Lista las categorías principales que tienen productos disponibles.
 */
export async function getPopularCategories(limit = 6) {
  const admin = createAdminSupabase()
  const org = await getTargetOrganization(admin)
  if (!org) return []

  const { data } = await admin
    .from('categories')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
    .limit(limit)

  return data ?? []
}

/**
 * Busca productos pertenecientes a una categoría específica.
 */
export async function getProductsByCategory(categoryId: string, limit = 5) {
  const admin = createAdminSupabase()
  const org = await getTargetOrganization(admin)
  if (!org) return { org: null, products: [] }

  const { data } = await admin
    .from('products')
    .select('id, name, brand, sale_price, offer_price, has_offer, stock_quantity, image_url, description, barcode, sku')
    .eq('organization_id', org.id)
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('stock_quantity', { ascending: false })
    .limit(limit)

  return { org, products: (data ?? []) as unknown as BotProductItem[] }
}

export type BotProductItem = {
  id: string
  name: string
  brand?: string | null
  sale_price: number
  offer_price?: number | null
  has_offer?: boolean | null
  stock_quantity?: number | null
  description?: string | null
  category?: unknown
}

/**
 * Formatea el catálogo encontrado en un mensaje elegante para Telegram.
 */
function buildProductsMessage(
  title: string,
  products: BotProductItem[],
  orgSlug?: string | null,
): { text: string; markup: Record<string, unknown> } {
  if (products.length === 0) {
    return {
      text: `🔍 <b>No encontramos productos disponibles</b> para tu búsqueda.\n\nPrueba con una palabra más general (ej: <i>cargador</i>, <i>pantalla</i>, <i>funda</i>).`,
      markup: {
        inline_keyboard: [
          [
            { text: '📋 Ver Categorías', callback_data: 'cmd_categories' },
            { text: 'ℹ️ Ayuda', callback_data: 'cmd_help' },
          ],
        ],
      },
    }
  }

  const lines: string[] = [title, '']

  products.forEach((p, index) => {
    const isOffer = p.has_offer && p.offer_price && p.offer_price > 0
    const priceText = isOffer
      ? `<s>${formatCurrency(p.sale_price)}</s> <b>${formatCurrency(p.offer_price!)}</b> 🔥 <i>(En Oferta)</i>`
      : `<b>${formatCurrency(p.sale_price)}</b>`

    const stock = Number(p.stock_quantity ?? 0)
    const stockBadge = stock > 0 ? `✅ Disponible (${stock} u.)` : `⚠️ Agotado temporalmente`

    lines.push(`<b>${index + 1}. ${escapeHtml(p.name)}</b>`)
    if (p.brand) {
      lines.push(`   🏷️ <i>Marca:</i> ${escapeHtml(p.brand)}`)
    }
    lines.push(`   💰 <i>Precio:</i> ${priceText}`)
    lines.push(`   📦 <i>Stock:</i> ${stockBadge}`)
    if (p.description) {
      const shortDesc = p.description.trim().slice(0, 100)
      lines.push(`   📝 <i>Detalle:</i> ${escapeHtml(shortDesc)}${p.description.length > 100 ? '...' : ''}`)
    }
    lines.push('')
  })

  lines.push('💡 <i>Para consultar otro artículo, escribe su nombre directamente en el chat.</i>')

  const buttons: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [
    [
      { text: '📋 Ver Categorías', callback_data: 'cmd_categories' },
      { text: '🔍 Nueva Búsqueda', callback_data: 'cmd_help' },
    ],
  ]

  if (orgSlug) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://4g.com.py'
    buttons.unshift([
      { text: '🌐 Ver Tienda Online', url: `${baseUrl}/${orgSlug}` },
    ])
  }

  return {
    text: lines.join('\n'),
    markup: { inline_keyboard: buttons },
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Orquestador principal de eventos del Webhook de Telegram.
 */
export async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  // 1. Manejo de Botones interactivos (Callback Queries)
  if (update.callback_query) {
    const cq = update.callback_query
    const data = cq.data ?? ''
    const chatId = cq.message?.chat.id

    if (!chatId) return

    await answerCallbackQuery(cq.id)

    if (data === 'cmd_categories') {
      const categories = await getPopularCategories()
      if (categories.length === 0) {
        await sendTelegramMessage(chatId, '📋 No hay categorías activas en este momento.')
        return
      }

      const keyboard = categories.map((c) => [
        { text: `📁 ${c.name}`, callback_data: `cat_${c.id}` },
      ])

      await sendTelegramMessage(
        chatId,
        '📂 <b>Categorías de Productos</b>\n\nSelecciona una categoría para ver los productos disponibles:',
        { inline_keyboard: keyboard },
      )
      return
    }

    if (data.startsWith('cat_')) {
      const catId = data.replace('cat_', '')
      const { org, products } = await getProductsByCategory(catId)
      const { text, markup } = buildProductsMessage('📦 <b>Productos en esta categoría:</b>', products, org?.slug)
      await sendTelegramMessage(chatId, text, markup)
      return
    }

    if (data === 'cmd_help') {
      await sendWelcomeMessage(chatId, cq.from.first_name)
      return
    }

    return
  }

  // 2. Manejo de Mensajes de texto normales
  if (update.message?.text) {
    const chatId = update.message.chat.id
    const text = update.message.text.trim()
    const firstName = update.message.from?.first_name || 'Cliente'

    // Comandos de inicio y bienvenida
    if (text === '/start' || text.toLowerCase() === 'hola' || text === '/ayuda' || text === '/menu') {
      await sendWelcomeMessage(chatId, firstName)
      return
    }

    if (text === '/categorias' || text.toLowerCase() === 'categorias') {
      const categories = await getPopularCategories()
      const keyboard = categories.map((c) => [
        { text: `📁 ${c.name}`, callback_data: `cat_${c.id}` },
      ])
      await sendTelegramMessage(
        chatId,
        '📂 <b>Categorías Disponibles</b>\n\nElige una categoría para explorar sus productos:',
        { inline_keyboard: keyboard },
      )
      return
    }

    // Búsqueda inteligente de productos por texto
    if (text.length >= 2) {
      const { org, products } = await searchProducts(text)
      const title = `🔎 <b>Resultados para:</b> «${escapeHtml(text)}»`
      const { text: responseText, markup } = buildProductsMessage(title, products, org?.slug)
      await sendTelegramMessage(chatId, responseText, markup)
      return
    }

    await sendTelegramMessage(
      chatId,
      '✍️ Escribe al menos 2 letras del producto que buscas (por ejemplo: <i>cargador</i> o <i>pantalla</i>).',
    )
  }
}

async function sendWelcomeMessage(chatId: number | string, firstName: string): Promise<void> {
  const admin = createAdminSupabase()
  const org = await getTargetOrganization(admin)
  const storeName = org?.name ? `<b>${escapeHtml(org.name)}</b>` : 'nuestra tienda'

  const text = [
    `👋 ¡Hola <b>${escapeHtml(firstName)}</b>! Bienvenido al asistente virtual de ${storeName}.`,
    '',
    'Estoy aquí para ayudarte a encontrar productos, consultar precios y disponibilidad en tiempo real.',
    '',
    '🔎 <b>¿Cómo buscar?</b>',
    'Simplemente escribe lo que buscas en el chat (ejemplo: <i>cargador</i>, <i>iphone</i>, <i>batería</i> o el código del producto).',
  ].join('\n')

  const markup = {
    inline_keyboard: [
      [
        { text: '📋 Ver Categorías', callback_data: 'cmd_categories' },
        ...(org?.slug
          ? [{ text: '🌐 Catálogo Online', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://4g.com.py'}/${org.slug}` }]
          : []),
      ],
    ],
  }

  await sendTelegramMessage(chatId, text, markup)
}
