import { describe, it, expect } from 'vitest'
import {
  buildProductWhatsAppMessage,
  formatWhatsAppPhone
} from '@/lib/whatsapp'

describe('WhatsApp Product Inquiry & Order Message Builder', () => {
  it('formats phone numbers properly with country code', () => {
    expect(formatWhatsAppPhone('0981123456')).toBe('595981123456')
    expect(formatWhatsAppPhone('+595 981 123 456')).toBe('595981123456')
    expect(formatWhatsAppPhone('595981123456')).toBe('595981123456')
    // Cargado como «595» + «0981…»: el 0 local sobra y wa.me rechaza el número.
    expect(formatWhatsAppPhone('5950981123456')).toBe('595981123456')
  })

  it('generates a rich message for a simple in-stock product with store name and link', () => {
    const msg = buildProductWhatsAppMessage({
      storeName: '4G Celulares',
      productName: 'iPhone 15 Pro Max 256GB',
      price: 8500000,
      sku: 'IPH15PM-256',
      inStock: true,
      stockQuantity: 4,
      productUrl: 'https://midominio.com/4g-celulares/productos/iphone-15',
      intent: 'inquiry',
    })

    expect(msg).toContain('¡Hola *4G Celulares*! 👋')
    expect(msg).toContain('Me interesa este producto de su tienda:')
    expect(msg).toContain('🏷️ *iPhone 15 Pro Max 256GB*')
    expect(msg).toContain('🔢 *Código / SKU:* IPH15PM-256')
    expect(msg).toContain('💰 *Precio:*')
    expect(msg).toContain('📦 *Disponibilidad:* En stock (4 unid.)')
    expect(msg).toContain('🔗 *Ver producto:* https://midominio.com/4g-celulares/productos/iphone-15')
    expect(msg).toContain('¿Podrían brindarme más información sobre este artículo? ¡Muchas gracias!')
  })

  it('generates an order request with quantity, discount and total calculation', () => {
    const msg = buildProductWhatsAppMessage({
      storeName: 'Moda Urbana',
      productName: 'Camisa Lino Classic',
      price: 120000,
      originalPrice: 150000,
      variantName: 'Azul Marino / L',
      quantity: 3,
      inStock: true,
      intent: 'order',
      customerNote: '¿Hacen envíos a Villa Morra hoy por la tarde?',
    })

    expect(msg).toContain('¡Quiero pedir este producto de su tienda online! 🛍️')
    expect(msg).toContain('✨ *Opción:* Azul Marino / L')
    expect(msg).toContain('20% OFF')
    expect(msg).toContain('🛒 *Cantidad:* 3 unid. · *Total:*')
    expect(msg).toContain('💬 *Nota / Consulta:* ¿Hacen envíos a Villa Morra hoy por la tarde?')
    expect(msg).toContain('¿Cómo podemos coordinar el pago y la entrega? ¡Muchas gracias!')
  })

  /** La portada escribe sin producto puntual: mandaba «Precio: Gs. 0». */
  it('omite el precio cuando no hay uno que informar', () => {
    const msg = buildProductWhatsAppMessage({
      storeName: 'Moda Urbana',
      productName: 'Colección de productos y novedades',
      price: 0,
      intent: 'inquiry',
    })

    expect(msg).not.toContain('*Precio:*')
    expect(msg).toContain('🏷️ *Colección de productos y novedades*')
  })

  /** WhatsApp abre enlaces, no rutas: `/tienda/productos/1` era texto muerto. */
  it('no manda enlaces ni fotos que no se puedan abrir', () => {
    const msg = buildProductWhatsAppMessage({
      productName: 'Remera',
      price: 50000,
      productUrl: '/tienda/productos/1',
      imageUrl: '/images/products/remera.jpg',
    })

    expect(msg).not.toContain('*Ver producto:*')
    expect(msg).not.toContain('*Foto:*')

    const conEnlaces = buildProductWhatsAppMessage({
      productName: 'Remera',
      price: 50000,
      productUrl: 'https://tienda.com/productos/1',
      imageUrl: 'https://cdn.tienda.com/remera.jpg',
    })
    expect(conEnlaces).toContain('🔗 *Ver producto:* https://tienda.com/productos/1')
    expect(conEnlaces).toContain('🖼️ *Foto:* https://cdn.tienda.com/remera.jpg')
  })

  it('formats correctly when product is out of stock', () => {
    const msg = buildProductWhatsAppMessage({
      productName: 'PlayStation 5 Slim',
      price: 4500000,
      inStock: false,
      intent: 'inquiry',
    })

    expect(msg).toContain('¡Hola! 👋')
    expect(msg).toContain('📦 *Estado:* Temporalmente agotado (consultar reposición)')
  })

  it('handles installment text and custom questions', () => {
    const msg = buildProductWhatsAppMessage({
      storeName: 'TecnoShop',
      productName: 'Notebook Asus i7',
      price: 6000000,
      installmentText: 'Hasta 12 cuotas de Gs. 550.000',
      intent: 'installments',
    })

    expect(msg).toContain('Quiero consultar las opciones de financiación y cuotas para este producto:')
    expect(msg).toContain('💳 *Financiación:* Hasta 12 cuotas de Gs. 550.000')
    expect(msg).toContain('¿Cuáles son las tarjetas y planes en cuotas habilitados? ¡Gracias!')
  })
})
