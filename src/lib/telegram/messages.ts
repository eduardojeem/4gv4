/**
 * Los textos y botones del bot. Funciones puras: reciben los datos ya leídos y
 * devuelven HTML de Telegram, así se prueban sin Supabase ni red.
 */

import { formatCurrency } from '@/lib/currency'
import { siteUrl } from '@/lib/site-url'
import type { InlineButton, InlineKeyboard } from '@/lib/telegram/telegram-api'

export type BotStore = { id: string; name: string; slug: string }

export type BotProduct = {
  id: string
  name: string
  brand?: string | null
  description?: string | null
  sale_price: number
  offer_price?: number | null
  has_offer?: boolean | null
  hide_price?: boolean | null
  stock_quantity?: number | null
  image_url?: string | null
  images?: string[] | null
  store: BotStore
}

export type BotCategory = { id: string; name: string; count: number }

export type StoreContact = {
  whatsapp?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  instagram?: string | null
}

export type Reply = { text: string; keyboard?: InlineKeyboard; photo?: string | null }

export const PAGE_SIZE = 5
/** Telegram rechaza el botón entero si `callback_data` pasa de 64 bytes. */
const CALLBACK_DATA_MAX_BYTES = 64

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function cut(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

function fitsCallback(data: string): boolean {
  return new TextEncoder().encode(data).length <= CALLBACK_DATA_MAX_BYTES
}

/**
 * Cuánto hay, sin dar el número exacto: el inventario de la tienda no es
 * información para cualquiera que le escriba al bot.
 */
export function stockLabel(quantity: number | null | undefined): string {
  const qty = Number(quantity ?? 0)
  if (qty <= 0) return '⚠️ Sin stock por ahora'
  if (qty <= 3) return '🟡 Últimas unidades'
  return '✅ Disponible'
}

/** Respeta «ocultar precio»: la tienda lo negocia por WhatsApp. */
export function priceHtml(product: Pick<BotProduct, 'sale_price' | 'offer_price' | 'has_offer' | 'hide_price'>): string {
  if (product.hide_price) return '💬 <i>Consultar precio</i>'
  const offer = Number(product.offer_price ?? 0)
  if (product.has_offer && offer > 0 && offer < Number(product.sale_price)) {
    return `<s>${formatCurrency(product.sale_price)}</s> <b>${formatCurrency(offer)}</b> 🔥`
  }
  return `<b>${formatCurrency(product.sale_price)}</b>`
}

export function storeUrl(store: BotStore): string {
  return siteUrl(`/${store.slug}/inicio`)
}

export function productUrl(product: { id: string; store: BotStore }): string {
  return siteUrl(`/${product.store.slug}/productos/${product.id}`)
}

export function productPhoto(product: Pick<BotProduct, 'image_url' | 'images'>): string | null {
  const url = (Array.isArray(product.images) && product.images[0]) || product.image_url || null
  return url && /^https:\/\//i.test(url) ? url : null
}

function whatsappLink(phone: string, message: string): string | null {
  let digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return null
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (!digits.startsWith('595')) digits = `595${digits}`
  else if (digits.startsWith('5950')) digits = `595${digits.slice(4)}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

const MENU_ROW: InlineButton[] = [
  { text: '📂 Categorías', callback_data: 'm:cats' },
  { text: '🔥 Ofertas', callback_data: 'o:0' },
]

export function welcomeMessage(firstName: string, store: BotStore | null): Reply {
  const name = escapeHtml(cut(firstName || 'hola', 40))
  const lines = store
    ? [
        `👋 ¡Hola <b>${name}</b>! Soy el asistente de <b>${escapeHtml(store.name)}</b>.`,
        '',
        'Te ayudo a encontrar productos, ver precios y saber si hay stock.',
      ]
    : [
        `👋 ¡Hola <b>${name}</b>! Busco productos en las tiendas de MiTiendaPy.`,
        '',
        'Elegí una tienda con /tienda o escribí directamente lo que buscás y te muestro de todas.',
      ]
  lines.push(
    '',
    '🔎 <b>Escribí lo que buscás</b>: <i>cargador tipo c</i>, <i>funda a15</i> o un código de barras.',
  )
  const keyboard: InlineButton[][] = [MENU_ROW, [{ text: '🏪 Elegir tienda', callback_data: 'm:stores' }]]
  if (store) {
    keyboard[1].push({ text: '📞 Contacto', callback_data: 'm:contact' })
    keyboard.push([{ text: '🌐 Ver la tienda online', url: storeUrl(store) }])
  }
  return { text: lines.join('\n'), keyboard: { inline_keyboard: keyboard } }
}

export function helpMessage(store: BotStore | null): Reply {
  return {
    text: [
      '<b>Cómo usar el asistente</b>',
      '',
      '🔎 Escribí el nombre, la marca o el código del producto.',
      '/categorias — ver por categoría',
      '/ofertas — productos en oferta',
      '/tienda — ver o cambiar de tienda',
      '/contacto — WhatsApp y dirección',
      '',
      store ? `Tienda actual: <b>${escapeHtml(store.name)}</b>` : 'Estás buscando en <b>todas las tiendas</b>.',
    ].join('\n'),
    keyboard: { inline_keyboard: [MENU_ROW] },
  }
}

/**
 * Lista de resultados. Cada producto tiene su botón para abrir la ficha, y
 * «Ver más» sólo aparece si el siguiente pedido entra en los 64 bytes.
 */
export function productListMessage(params: {
  title: string
  products: BotProduct[]
  hasMore: boolean
  /** callback_data de la página siguiente, o null si no hay paginado. */
  nextPage: string | null
  /** Sin tienda elegida los resultados mezclan tiendas: se muestra de cuál es cada uno. */
  showStore: boolean
  emptyHint?: string
}): Reply {
  const { title, products, hasMore, nextPage, showStore } = params
  if (products.length === 0) {
    return {
      text: `${title}\n\n${params.emptyHint ?? 'No encontré productos. Probá con una palabra más general (ej: <i>cargador</i>, <i>funda</i>).'}`,
      keyboard: { inline_keyboard: [MENU_ROW] },
    }
  }

  const lines = [title, '']
  products.forEach((product, index) => {
    lines.push(`<b>${index + 1}. ${escapeHtml(cut(product.name, 80))}</b>`)
    const meta = [product.brand ? escapeHtml(product.brand) : null, showStore ? `🏪 ${escapeHtml(product.store.name)}` : null].filter(Boolean)
    if (meta.length) lines.push(`   ${meta.join(' · ')}`)
    lines.push(`   ${priceHtml(product)} · ${stockLabel(product.stock_quantity)}`)
    lines.push('')
  })
  lines.push('<i>Tocá un producto para ver la foto y consultarlo.</i>')

  const keyboard: InlineButton[][] = products.map((product, index) => [
    { text: `${index + 1}. ${cut(product.name, 40)}`, callback_data: `p:${product.id}` },
  ])
  if (hasMore && nextPage && fitsCallback(nextPage)) keyboard.push([{ text: '➡️ Ver más', callback_data: nextPage }])
  keyboard.push(MENU_ROW)
  return { text: lines.join('\n'), keyboard: { inline_keyboard: keyboard } }
}

export function productDetailMessage(product: BotProduct, contact: StoreContact | null): Reply {
  const lines = [`<b>${escapeHtml(cut(product.name, 120))}</b>`]
  if (product.brand) lines.push(`🏷️ ${escapeHtml(product.brand)}`)
  lines.push('', `💰 ${priceHtml(product)}`, `📦 ${stockLabel(product.stock_quantity)}`, `🏪 ${escapeHtml(product.store.name)}`)
  if (product.description?.trim()) lines.push('', escapeHtml(cut(product.description, 400)))

  const url = productUrl(product)
  const keyboard: InlineButton[][] = [[{ text: '🌐 Ver en la tienda', url }]]
  const phone = contact?.whatsapp || null
  const wa = phone
    ? whatsappLink(phone, `Hola! Vi este producto y quiero consultar: ${product.name}\n${url}`)
    : null
  if (wa) keyboard.unshift([{ text: product.hide_price ? '💬 Consultar precio por WhatsApp' : '💬 Consultar por WhatsApp', url: wa }])
  keyboard.push(MENU_ROW)

  return { text: lines.join('\n'), keyboard: { inline_keyboard: keyboard }, photo: productPhoto(product) }
}

export function categoriesMessage(store: BotStore, categories: BotCategory[]): Reply {
  if (categories.length === 0) {
    return { text: `📂 <b>${escapeHtml(store.name)}</b> todavía no tiene categorías con productos publicados.` }
  }
  return {
    text: `📂 <b>Categorías de ${escapeHtml(store.name)}</b>\n\nElegí una para ver sus productos:`,
    keyboard: {
      inline_keyboard: categories.map((category) => [
        { text: `${cut(category.name, 40)} (${category.count})`, callback_data: `c:${category.id}:0` },
      ]),
    },
  }
}

export function storesMessage(current: BotStore | null, stores: BotStore[], searched?: string): Reply {
  const lines: string[] = []
  if (searched) {
    lines.push(stores.length ? `🏪 Tiendas que coinciden con «${escapeHtml(searched)}»:` : `No encontré tiendas con «${escapeHtml(searched)}».`)
  } else {
    lines.push(current ? `🏪 Estás en <b>${escapeHtml(current.name)}</b>.` : '🏪 Estás buscando en <b>todas las tiendas</b>.')
    lines.push('', 'Elegí otra o escribí <code>/tienda nombre</code>.')
  }
  const keyboard: InlineButton[][] = stores.map((store) => [{ text: cut(store.name, 40), callback_data: `s:${store.id}` }])
  if (current) keyboard.push([{ text: '🌎 Buscar en todas las tiendas', callback_data: 's:all' }])
  return { text: lines.join('\n'), keyboard: keyboard.length ? { inline_keyboard: keyboard } : undefined }
}

export function storeChosenMessage(store: BotStore | null, persisted: boolean): Reply {
  const text = store
    ? `✅ Listo, ahora busco en <b>${escapeHtml(store.name)}</b>.\n\nEscribí lo que necesitás.`
    : '✅ Listo, ahora busco en <b>todas las tiendas</b>.'
  return {
    text: persisted ? text : `${text}\n\n<i>No pude guardar la elección: si no la recuerdo, volvé a elegirla.</i>`,
    keyboard: { inline_keyboard: [MENU_ROW] },
  }
}

export function contactMessage(store: BotStore, contact: StoreContact | null): Reply {
  const lines = [`📞 <b>${escapeHtml(store.name)}</b>`, '']
  if (contact?.whatsapp) lines.push(`💬 WhatsApp: ${escapeHtml(contact.whatsapp)}`)
  if (contact?.phone && contact.phone !== contact.whatsapp) lines.push(`☎️ Teléfono: ${escapeHtml(contact.phone)}`)
  if (contact?.email) lines.push(`✉️ ${escapeHtml(contact.email)}`)
  if (contact?.address) lines.push(`📍 ${escapeHtml(contact.address)}`)
  if (contact?.instagram) lines.push(`📸 Instagram: ${escapeHtml(contact.instagram)}`)
  if (lines.length === 2) lines.push('La tienda todavía no cargó sus datos de contacto.')

  const keyboard: InlineButton[][] = []
  const wa = contact?.whatsapp ? whatsappLink(contact.whatsapp, `Hola ${store.name}! Te escribo desde Telegram.`) : null
  if (wa) keyboard.push([{ text: '💬 Escribir por WhatsApp', url: wa }])
  keyboard.push([{ text: '🌐 Ver la tienda online', url: storeUrl(store) }])
  return { text: lines.join('\n'), keyboard: { inline_keyboard: keyboard } }
}

export function needStoreMessage(action: string): Reply {
  return {
    text: `Para ver ${action} primero elegí una tienda.`,
    keyboard: { inline_keyboard: [[{ text: '🏪 Elegir tienda', callback_data: 'm:stores' }]] },
  }
}

export const NON_TEXT_MESSAGE: Reply = {
  text: 'Por ahora entiendo texto 🙂 Escribí el nombre del producto o su código de barras.',
}

export const SHORT_QUERY_MESSAGE: Reply = {
  text: '✍️ Escribí al menos 2 letras de lo que buscás (ej: <i>cargador</i>, <i>pantalla</i>).',
}

export const UNAVAILABLE_MESSAGE: Reply = {
  text: 'Ese producto ya no está disponible. Probá buscando de nuevo.',
  keyboard: { inline_keyboard: [MENU_ROW] },
}

/** Pedido de la página siguiente de una búsqueda. */
export function searchPageCallback(page: number, query: string): string {
  return `q:${page}:${query}`
}
