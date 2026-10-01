/**
 * Asistente de clientes por Telegram: busca productos, muestra la ficha con
 * foto, ofertas, categorías y el contacto de la tienda.
 *
 * Un solo bot sirve a todas las tiendas. Cada chat elige la suya con el enlace
 * `t.me/<bot>?start=<slug>` o con /tienda; sin elegir, busca en las tiendas del
 * marketplace. Nunca cae en una tienda cualquiera.
 */

import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  categoriesWithProducts,
  chatStore,
  listStores,
  offers,
  productById,
  productsInCategory,
  rememberChatStore,
  searchProducts,
  storeById,
  storeBySlug,
  storeContact,
} from '@/lib/telegram/catalog'
import {
  NON_TEXT_MESSAGE,
  SHORT_QUERY_MESSAGE,
  UNAVAILABLE_MESSAGE,
  categoriesMessage,
  contactMessage,
  escapeHtml,
  helpMessage,
  needStoreMessage,
  productDetailMessage,
  productListMessage,
  searchPageCallback,
  storeChosenMessage,
  storesMessage,
  welcomeMessage,
  type BotStore,
  type Reply,
} from '@/lib/telegram/messages'
import { answerCallbackQuery, sendMessage, sendPhoto } from '@/lib/telegram/telegram-api'

export interface TelegramMessage {
  message_id: number
  from?: { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
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

type Admin = ReturnType<typeof createAdminSupabase>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `/buscar@MiBot funda a15` → { command: 'buscar', args: 'funda a15' } */
export function parseCommand(text: string): { command: string; args: string } | null {
  const match = text.trim().match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  return match ? { command: match[1].toLowerCase(), args: (match[2] ?? '').trim() } : null
}

/** Lo que pide un botón. Lo que no se reconoce se ignora. */
export type CallbackAction =
  | { kind: 'menu'; item: 'cats' | 'help' | 'stores' | 'contact' }
  | { kind: 'product'; id: string }
  | { kind: 'category'; id: string; page: number }
  | { kind: 'search'; page: number; query: string }
  | { kind: 'offers'; page: number }
  | { kind: 'store'; id: string | null }

export function parseCallback(data: string): CallbackAction | null {
  const [kind, ...rest] = data.split(':')
  const page = (value: string | undefined) => Math.min(50, Math.max(0, Number.parseInt(value ?? '0', 10) || 0))
  switch (kind) {
    case 'm':
      return ['cats', 'help', 'stores', 'contact'].includes(rest[0])
        ? { kind: 'menu', item: rest[0] as 'cats' | 'help' | 'stores' | 'contact' }
        : null
    case 'p':
      return UUID.test(rest[0] ?? '') ? { kind: 'product', id: rest[0] } : null
    case 'c':
      return UUID.test(rest[0] ?? '') ? { kind: 'category', id: rest[0], page: page(rest[1]) } : null
    case 'q': {
      const query = rest.slice(1).join(':')
      return query ? { kind: 'search', page: page(rest[0]), query } : null
    }
    case 'o':
      return { kind: 'offers', page: page(rest[0]) }
    case 's':
      if (rest[0] === 'all') return { kind: 'store', id: null }
      return UUID.test(rest[0] ?? '') ? { kind: 'store', id: rest[0] } : null
    default:
      return null
  }
}

async function reply(chatId: number, message: Reply) {
  if (message.photo) return sendPhoto(chatId, message.photo, message.text, message.keyboard)
  return sendMessage(chatId, message.text, message.keyboard)
}

/** Lo que necesita cada respuesta, leído una sola vez por mensaje. */
class Conversation {
  private resolved: Promise<{ store: BotStore | null; chosen: boolean }> | null = null

  constructor(
    readonly admin: Admin,
    readonly chatId: number,
    readonly firstName: string,
  ) {}

  store() {
    this.resolved ??= chatStore(this.admin, this.chatId)
    return this.resolved.then((result) => result.store)
  }

  async chooseStore(store: BotStore | null) {
    const persisted = await rememberChatStore(this.admin, this.chatId, store)
    this.resolved = Promise.resolve({ store, chosen: true })
    return reply(this.chatId, storeChosenMessage(store, persisted))
  }

  async search(query: string, page = 0) {
    const store = await this.store()
    const result = await searchProducts(this.admin, store, query, page)
    const where = store ? ` en ${escapeHtml(store.name)}` : ''
    return reply(this.chatId, productListMessage({
      title: `🔎 <b>«${escapeHtml(query)}»</b>${where}${page ? ` · página ${page + 1}` : ''}`,
      ...result,
      nextPage: searchPageCallback(page + 1, query),
      showStore: !store,
      emptyHint: store
        ? `No encontré eso en ${escapeHtml(store.name)}. Probá con otra palabra, o buscá en todas las tiendas con /tienda.`
        : undefined,
    }))
  }

  async offers(page = 0) {
    const store = await this.store()
    const result = await offers(this.admin, store, page)
    return reply(this.chatId, productListMessage({
      title: `🔥 <b>Ofertas${store ? ` de ${escapeHtml(store.name)}` : ''}</b>${page ? ` · página ${page + 1}` : ''}`,
      ...result,
      nextPage: `o:${page + 1}`,
      showStore: !store,
      emptyHint: 'No hay ofertas publicadas en este momento.',
    }))
  }

  async categories() {
    const store = await this.store()
    if (!store) return reply(this.chatId, needStoreMessage('las categorías'))
    return reply(this.chatId, categoriesMessage(store, await categoriesWithProducts(this.admin, store)))
  }

  async category(id: string, page: number) {
    const store = await this.store()
    if (!store) return reply(this.chatId, needStoreMessage('las categorías'))
    const result = await productsInCategory(this.admin, store, id, page)
    return reply(this.chatId, productListMessage({
      title: `📂 <b>Productos de la categoría</b>${page ? ` · página ${page + 1}` : ''}`,
      ...result,
      nextPage: `c:${id}:${page + 1}`,
      showStore: false,
      emptyHint: 'Esta categoría no tiene productos publicados.',
    }))
  }

  async product(id: string) {
    const product = await productById(this.admin, id)
    if (!product) return reply(this.chatId, UNAVAILABLE_MESSAGE)
    return reply(this.chatId, productDetailMessage(product, await storeContact(this.admin, product.store)))
  }

  async stores(term?: string) {
    const [store, stores] = await Promise.all([this.store(), listStores(this.admin, term)])
    return reply(this.chatId, storesMessage(store, stores, term))
  }

  /** `/tienda nombre`: con una sola coincidencia (o el slug exacto) la elige directamente. */
  async findStore(term: string) {
    const exact = await storeBySlug(this.admin, term.replace(/\s+/g, '-'))
    if (exact) return this.chooseStore(exact)
    const stores = await listStores(this.admin, term)
    if (stores.length === 1) return this.chooseStore(stores[0])
    return reply(this.chatId, storesMessage(await this.store(), stores, term))
  }

  async contact() {
    const store = await this.store()
    if (!store) return reply(this.chatId, needStoreMessage('el contacto'))
    return reply(this.chatId, contactMessage(store, await storeContact(this.admin, store)))
  }

  async welcome(startPayload?: string) {
    if (startPayload) {
      // El enlace de la tienda: t.me/<bot>?start=<slug>
      const store = await storeBySlug(this.admin, startPayload)
      if (store) {
        await rememberChatStore(this.admin, this.chatId, store)
        this.resolved = Promise.resolve({ store, chosen: true })
      }
    }
    return reply(this.chatId, welcomeMessage(this.firstName, await this.store()))
  }

  async help() {
    return reply(this.chatId, helpMessage(await this.store()))
  }
}

async function handleText(chat: Conversation, text: string) {
  const command = parseCommand(text)
  if (command) {
    switch (command.command) {
      case 'start':
        return chat.welcome(command.args.split(/\s+/)[0] || undefined)
      case 'ayuda':
      case 'help':
      case 'menu':
        return chat.help()
      case 'buscar':
        return command.args.length >= 2 ? chat.search(command.args) : reply(chat.chatId, SHORT_QUERY_MESSAGE)
      case 'categorias':
        return chat.categories()
      case 'ofertas':
        return chat.offers()
      case 'tienda':
      case 'tiendas':
        return command.args ? chat.findStore(command.args) : chat.stores()
      case 'todas':
        return chat.chooseStore(null)
      case 'contacto':
        return chat.contact()
      default:
        return chat.help()
    }
  }

  const lower = text.toLowerCase()
  if (['hola', 'menu', 'menú', 'ayuda', 'inicio'].includes(lower)) return chat.welcome()
  if (['categorias', 'categorías'].includes(lower)) return chat.categories()
  if (lower === 'ofertas') return chat.offers()
  if (text.length < 2) return reply(chat.chatId, SHORT_QUERY_MESSAGE)
  return chat.search(text.slice(0, 80))
}

async function handleCallback(chat: Conversation, action: CallbackAction) {
  switch (action.kind) {
    case 'menu':
      if (action.item === 'cats') return chat.categories()
      if (action.item === 'stores') return chat.stores()
      if (action.item === 'contact') return chat.contact()
      return chat.help()
    case 'product':
      return chat.product(action.id)
    case 'category':
      return chat.category(action.id, action.page)
    case 'search':
      return chat.search(action.query, action.page)
    case 'offers':
      return chat.offers(action.page)
    case 'store': {
      if (!action.id) return chat.chooseStore(null)
      const store = await storeById(chat.admin, action.id)
      return store ? chat.chooseStore(store) : reply(chat.chatId, { text: 'Esa tienda ya no está disponible.' })
    }
  }
}

export async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const callback = update.callback_query
  if (callback) {
    // Quitar el reloj del botón siempre, aunque después no haya nada que hacer.
    await answerCallbackQuery(callback.id)
    const chatInfo = callback.message?.chat
    const action = parseCallback(callback.data ?? '')
    if (!chatInfo || chatInfo.type !== 'private' || !action) return
    await handleCallback(new Conversation(createAdminSupabase(), chatInfo.id, callback.from.first_name ?? ''), action)
    return
  }

  const message = update.message
  // Sólo chats privados: en un grupo el bot contestaría cada mensaje de todos.
  if (!message || message.chat.type !== 'private' || message.from?.is_bot) return
  const chat = new Conversation(createAdminSupabase(), message.chat.id, message.from?.first_name ?? '')
  if (!message.text?.trim()) {
    await reply(chat.chatId, NON_TEXT_MESSAGE)
    return
  }
  await handleText(chat, message.text.trim())
}
