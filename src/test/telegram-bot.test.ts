import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseCallback, parseCommand } from '@/lib/telegram/bot-service'
import { searchTerms } from '@/lib/telegram/catalog'
import {
  priceHtml,
  productDetailMessage,
  productListMessage,
  searchPageCallback,
  stockLabel,
  welcomeMessage,
  type BotProduct,
} from '@/lib/telegram/messages'
import { webhookSecret } from '@/lib/telegram/telegram-api'

const store = { id: '11111111-1111-4111-8111-111111111111', name: 'HCA <Celular>', slug: 'hca-celular' }
const product = (over: Partial<BotProduct> = {}): BotProduct => ({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Cargador tipo C 20W',
  brand: 'Samsung',
  sale_price: 150000,
  stock_quantity: 25,
  image_url: 'https://cdn.example.com/a.jpg',
  store,
  ...over,
})

describe('mensajes del bot de Telegram', () => {
  it('no muestra el stock exacto', () => {
    expect(stockLabel(25)).toBe('✅ Disponible')
    expect(stockLabel(2)).toBe('🟡 Últimas unidades')
    expect(stockLabel(0)).toContain('Sin stock')
    const { text } = productListMessage({ title: 't', products: [product()], hasMore: false, nextPage: null, showStore: false })
    expect(text).not.toContain('25')
  })

  it('respeta el precio oculto', () => {
    expect(priceHtml({ sale_price: 150000, hide_price: true })).toContain('Consultar precio')
    expect(priceHtml({ sale_price: 150000, hide_price: true })).not.toMatch(/150/)
  })

  it('muestra la oferta sólo si es menor al precio', () => {
    expect(priceHtml({ sale_price: 150000, has_offer: true, offer_price: 120000 })).toContain('<s>')
    expect(priceHtml({ sale_price: 150000, has_offer: true, offer_price: 0 })).not.toContain('<s>')
  })

  it('escapa el HTML de los nombres', () => {
    const { text } = productListMessage({ title: 't', products: [product()], hasMore: false, nextPage: null, showStore: true })
    expect(text).toContain('HCA &lt;Celular&gt;')
  })

  it('«Ver más» sólo si el pedido entra en 64 bytes', () => {
    const base = { title: 't', products: [product()], hasMore: true, showStore: false }
    const corto = productListMessage({ ...base, nextPage: searchPageCallback(1, 'cargador') })
    expect(JSON.stringify(corto.keyboard)).toContain('q:1:cargador')
    const largo = productListMessage({ ...base, nextPage: searchPageCallback(1, 'ñ'.repeat(40)) })
    expect(JSON.stringify(largo.keyboard)).not.toContain('Ver más')
  })

  it('la ficha lleva a la página del producto y a WhatsApp de la tienda', () => {
    const reply = productDetailMessage(product(), { whatsapp: '0981 123 456' })
    const urls = reply.keyboard!.inline_keyboard.flat().map((button) => button.url).filter(Boolean)
    expect(urls.some((url) => url!.endsWith('/hca-celular/productos/22222222-2222-4222-8222-222222222222'))).toBe(true)
    expect(urls.some((url) => url!.startsWith('https://wa.me/595981123456?text='))).toBe(true)
    expect(reply.photo).toBe('https://cdn.example.com/a.jpg')
  })

  it('la ficha no manda fotos que no sean https', () => {
    expect(productDetailMessage(product({ image_url: '/local.png' }), null).photo).toBeNull()
  })

  it('el enlace de la tienda va a /inicio', () => {
    const urls = welcomeMessage('Ana', store).keyboard!.inline_keyboard.flat().map((button) => button.url).filter(Boolean)
    expect(urls[0]).toMatch(/\/hca-celular\/inicio$/)
  })
})

describe('lectura de comandos y botones', () => {
  it('entiende comandos con el nombre del bot', () => {
    expect(parseCommand('/buscar@MiBot funda a15')).toEqual({ command: 'buscar', args: 'funda a15' })
    expect(parseCommand('/start hca-celular')).toEqual({ command: 'start', args: 'hca-celular' })
    expect(parseCommand('cargador')).toBeNull()
  })

  it('valida los botones', () => {
    expect(parseCallback('p:22222222-2222-4222-8222-222222222222')).toEqual({ kind: 'product', id: '22222222-2222-4222-8222-222222222222' })
    expect(parseCallback('p:1 or 1=1')).toBeNull()
    expect(parseCallback('q:2:funda:a15')).toEqual({ kind: 'search', page: 2, query: 'funda:a15' })
    expect(parseCallback('o:999')).toEqual({ kind: 'offers', page: 50 })
    expect(parseCallback('s:all')).toEqual({ kind: 'store', id: null })
    expect(parseCallback('cmd_categories')).toBeNull()
  })

  it('limpia la búsqueda para el filtro de PostgREST', () => {
    expect(searchTerms('funda, (a15)*')).toEqual(['funda', 'a15'])
    expect(searchTerms('a')).toEqual([])
  })
})

describe('webhook', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = '123:abc'
    delete process.env.TELEGRAM_WEBHOOK_SECRET
  })
  afterEach(() => {
    process.env = { ...env }
    vi.resetModules()
  })

  it('deriva el secreto del token si no hay uno explícito', () => {
    const derived = webhookSecret()
    expect(derived).toMatch(/^[a-f0-9]{64}$/)
    process.env.TELEGRAM_WEBHOOK_SECRET = 'explicito'
    expect(webhookSecret()).toBe('explicito')
  })

  it('rechaza pedidos sin el token secreto', async () => {
    const processTelegramUpdate = vi.fn()
    vi.doMock('@/lib/telegram/bot-service', () => ({ processTelegramUpdate }))
    vi.doMock('@/lib/superadmin/auth', () => ({ getSuperAdminUser: vi.fn().mockResolvedValue(null) }))
    const { POST, GET } = await import('@/app/api/telegram/webhook/route')
    const body = JSON.stringify({ update_id: 1, message: { message_id: 1, chat: { id: 1, type: 'private' }, text: 'hola' } })

    const sinToken = await POST(new Request('http://x/api/telegram/webhook', { method: 'POST', body }))
    expect(sinToken.status).toBe(401)
    const conToken = await POST(new Request('http://x/api/telegram/webhook', {
      method: 'POST',
      body,
      headers: { 'x-telegram-bot-api-secret-token': webhookSecret()! },
    }))
    expect(conToken.status).toBe(200)
    expect(processTelegramUpdate).toHaveBeenCalledTimes(1)

    // Registrar o ver el webhook es sólo para superadmin.
    expect((await GET(new Request('http://x/api/telegram/webhook?setup=true'))).status).toBe(403)
  })
})
