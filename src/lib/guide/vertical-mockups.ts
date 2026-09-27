import type { BusinessVertical } from '@/lib/organization/business-profile'

export interface VerticalMockupData {
  verticalLabel: string
  verticalIcon: string
  business: {
    name: string
    ruc: string
    city: string
    tagline: string
    ticketHeader: string
    webFeature: string
  }
  pos: {
    scanPlaceholder: string
    item1: { name: string; detail: string; price: string }
    item2: { name: string; detail: string; price: string }
    total: string
  }
  inventory: {
    name: string
    sku: string
    barcode: string
    cost: string
    price: string
    margin: string
    stock: string
  }
  caja: {
    openingFund: string
    cashSales: string
    qrSales: string
    expenses: string
    physicalCash: string
  }
  sale: {
    number: string
    time: string
    item1: { name: string; price: string }
    item2: { name: string; price: string }
    total: string
    method: string
  }
  website: {
    storeName: string
    domain: string
    categories: { icon: string; name: string; count: string }[]
  }
  users: {
    role: string
    name: string
    email: string
    allowed1: string
    allowed2: string
    blocked1: string
    blocked2: string
  }
  repairs: {
    orderNumber: string
    device: string
    serial: string
    defect: string
    parts: { name: string; cost: string }[]
    labor: string
    total: string
    technician: string
    status: string
    warranty: string
  }
}

export const VERTICAL_MOCKUPS: Record<string, VerticalMockupData> = {
  clothing: {
    verticalLabel: 'Indumentaria y Calzado',
    verticalIcon: '👗',
    business: {
      name: 'Boutique & Moda Tendencia',
      ruc: '80094123-5',
      city: 'Asunción, Paraguay',
      tagline: 'Colección de Temporada, Calzados & Envíos',
      ticketHeader: 'Membrete con Nombre, RUC y Política de Cambios (30 días)',
      webFeature: 'Catálogo online con fotos de modelos y pedidos directos por WhatsApp',
    },
    pos: {
      scanPlaceholder: 'Escanear código de barra en etiqueta de prenda... (Talle/Color)',
      item1: { name: 'Remera Algodón Pima (Talle M)', detail: '1 un. x ₲95.000', price: '₲95.000' },
      item2: { name: 'Pantalón Denim Mom Fit (Talle 38)', detail: '1 un. x ₲165.000', price: '₲165.000' },
      total: '₲260.000',
    },
    inventory: {
      name: 'Vestido Lino Estival (Talle M - Beige)',
      sku: 'VEST-LINO-BEI-M',
      barcode: '784109283712',
      cost: '₲75.000',
      price: '₲145.000',
      margin: '48.3%',
      stock: '8 un. (Talles S, M, L)',
    },
    caja: {
      openingFund: '₲200.000',
      cashSales: '+₲1.320.000',
      qrSales: '₲940.000',
      expenses: '-₲40.000',
      physicalCash: '₲1.480.000',
    },
    sale: {
      number: 'Comprobante #000214',
      time: 'Hoy 16:45 hs',
      item1: { name: '1x Blusa Seda Floral (Talle L)', price: '₲90.000' },
      item2: { name: '1x Cinturón Cuero Sintético', price: '₲40.000' },
      total: '₲130.000',
      method: 'Transferencia Bancaria / QR',
    },
    website: {
      storeName: 'Boutique Tendencia Online',
      domain: 'tienda.4g.com.py/boutique-tendencia',
      categories: [
        { icon: '👗', name: 'Vestidos & Monos', count: '18 modelos' },
        { icon: '👚', name: 'Remeras & Tops', count: '34 modelos' },
        { icon: '👖', name: 'Jeans & Calzas', count: '22 modelos' },
      ],
    },
    users: {
      role: 'Asesora de Ventas',
      name: 'Valeria Bogado',
      email: 'valeria.ventas@boutique.com',
      allowed1: 'Cobrar prendas en Punto de Venta POS',
      allowed2: 'Consultar matriz de talles y stock por sucursal',
      blocked1: 'Bloqueado ver costo de confección/importación',
      blocked2: 'Bloqueado anular ventas o aplicar descuentos libres',
    },
    repairs: {
      orderNumber: 'OT-0089',
      device: 'Vestido de Fiesta Alta Costura (Bordado)',
      serial: 'Identificador: PREN-089-AZUL',
      defect: 'Ajuste entallado de cintura, corrección de ruedo y cambio de cierre invisible',
      parts: [
        { name: 'Cierre Invisible YKK Reforzado 40cm', cost: '₲15.000' },
        { name: 'Forro Seda Interior Antipellizco', cost: '₲25.000' },
      ],
      labor: '₲70.000',
      total: '₲110.000',
      technician: 'Sastrería & Taller de Modas',
      status: 'listo',
      warranty: 'Prueba y ajuste final de calce garantizado sin cargo adicional',
    },
  },

  food: {
    verticalLabel: 'Gastronomía y Cafetería',
    verticalIcon: '☕',
    business: {
      name: 'Café & Bistro Delicias',
      ruc: '80072911-3',
      city: 'Asunción, Paraguay',
      tagline: 'Café de Especialidad, Minutas & Delivery',
      ticketHeader: 'Ticket de comanda rápida para cocina y mostrador',
      webFeature: 'Menú digital interactivo con pedidos directos por WhatsApp',
    },
    pos: {
      scanPlaceholder: 'Buscar plato o bebida en el menú... (Atajo táctil o código)',
      item1: { name: 'Combo Hamburguesa Smash Doble + Papas', detail: '1 combo x ₲45.000', price: '₲45.000' },
      item2: { name: 'Café Cappuccino Grande con Caramelo', detail: '2 un. x ₲16.000', price: '₲32.000' },
      total: '₲77.000',
    },
    inventory: {
      name: 'Café de Especialidad Grano 500g (Origen Colombia)',
      sku: 'CAF-ESP-COL-500',
      barcode: '784201948301',
      cost: '₲38.000',
      price: '₲70.000',
      margin: '45.7%',
      stock: '19 bolsas en depósito',
    },
    caja: {
      openingFund: '₲300.000',
      cashSales: '+₲1.850.000',
      qrSales: '₲1.120.000',
      expenses: '-₲85.000',
      physicalCash: '₲2.065.000',
    },
    sale: {
      number: 'Comanda #000582',
      time: 'Hoy 13:15 hs',
      item1: { name: '1x Pizza Artesanal Muzzarella 8 porc.', price: '₲55.000' },
      item2: { name: '2x Gaseosa 500ml bien fría', price: '₲16.000' },
      total: '₲71.000',
      method: 'Efectivo / Cobro Rápido',
    },
    website: {
      storeName: 'Café & Bistro Menú Online',
      domain: 'tienda.4g.com.py/cafebistro',
      categories: [
        { icon: '🍔', name: 'Hamburguesas & Combos', count: '12 opciones' },
        { icon: '☕', name: 'Café & Pastelería', count: '24 opciones' },
        { icon: '🍕', name: 'Pizzas & Minutas', count: '15 opciones' },
      ],
    },
    users: {
      role: 'Cajero / Mostrador',
      name: 'Matías Benítez',
      email: 'matias.caja@cafebistro.com',
      allowed1: 'Cobrar rápido en POS y despachar comandas',
      allowed2: 'Abrir turno y arqueo ciego diario de caja',
      blocked1: 'Bloqueado ver costo de insumos en compras',
      blocked2: 'Bloqueado modificar precios del menú',
    },
    repairs: {
      orderNumber: 'OT-0045',
      device: 'Cafetera Express Industrial 2 Grupos (Salón)',
      serial: 'Serie Maquinaria: EXP-2G-119',
      defect: 'Pérdida de presión de vapor en lanza 2 y sarro en calderín térmico',
      parts: [
        { name: 'Kit Empaquetaduras & Sellos de Silicona', cost: '₲140.000' },
        { name: 'Válvula de Seguridad Antirretorno 1/4', cost: '₲95.000' },
      ],
      labor: '₲150.000',
      total: '₲385.000',
      technician: 'Servicio Técnico Gastronómico Especializado',
      status: 'listo',
      warranty: '90 días de garantía en estanqueidad y presión de vapor',
    },
  },

  hardware: {
    verticalLabel: 'Ferretería y Repuestos',
    verticalIcon: '🔨',
    business: {
      name: 'Ferretería & Repuestos San José',
      ruc: '80061822-4',
      city: 'San Lorenzo, Paraguay',
      tagline: 'Herramientas, Electricidad, Pinturas & Bazar',
      ticketHeader: 'Membrete fiscal con RUC, teléfono de depósito y sucursal',
      webFeature: 'Catálogo de herramientas con consulta de precios por WhatsApp',
    },
    pos: {
      scanPlaceholder: 'Escanear código de barra de herramienta o repuesto... (SKU)',
      item1: { name: 'Taladro Percutor 650W 1/2 pulg.', detail: '1 un. x ₲320.000', price: '₲320.000' },
      item2: { name: 'Caja Tornillos Drywall 6x1 x100 un.', detail: '2 cajas x ₲18.000', price: '₲36.000' },
      total: '₲356.000',
    },
    inventory: {
      name: 'Disco de Corte Diamantado 4.5 pulg.',
      sku: 'DISC-COR-45',
      barcode: '784300182914',
      cost: '₲18.000',
      price: '₲32.000',
      margin: '43.8%',
      stock: '45 un. (Alerta mín: 10)',
    },
    caja: {
      openingFund: '₲250.000',
      cashSales: '+₲2.100.000',
      qrSales: '₲1.450.000',
      expenses: '-₲60.000',
      physicalCash: '₲2.290.000',
    },
    sale: {
      number: 'Factura/Ticket #001093',
      time: 'Hoy 10:20 hs',
      item1: { name: '1x Cinta Métrica 5m Antichoque', price: '₲24.000' },
      item2: { name: '1x Martillo Mango Fibra de Vidrio', price: '₲48.000' },
      total: '₲72.000',
      method: 'QR Bancario / Débito',
    },
    website: {
      storeName: 'Ferretería San José Online',
      domain: 'tienda.4g.com.py/ferreteriasanjose',
      categories: [
        { icon: '🔨', name: 'Herramientas Eléctricas', count: '45 modelos' },
        { icon: '🔩', name: 'Tornillos & Fijaciones', count: '120 ítems' },
        { icon: '🎨', name: 'Pinturas & Selladores', count: '38 opciones' },
      ],
    },
    users: {
      role: 'Vendedor de Mostrador',
      name: 'Gustavo Duarte',
      email: 'gustavo.mostrador@ferreteria.com',
      allowed1: 'Consultar stock en depósito y sucursal',
      allowed2: 'Emitir presupuestos y cobrar en POS',
      blocked1: 'Bloqueado ver costo de importación de repuestos',
      blocked2: 'Bloqueado borrar o reajustar inventario físico',
    },
    repairs: {
      orderNumber: 'OT-0192',
      device: 'Amoladora Angular Bosch 850W Profesional',
      serial: 'Nº Serie Fabricante: BSH-850-2023-44',
      defect: 'Emite chispas en zona de carbones y engranaje de cabeza trabado',
      parts: [
        { name: 'Juego de Carbones Originales con Auto-Stop', cost: '₲35.000' },
        { name: 'Corona y Piñón Helicoidal de Tracción', cost: '₲85.000' },
      ],
      labor: '₲60.000',
      total: '₲180.000',
      technician: 'Taller de Herramientas San José',
      status: 'listo',
      warranty: '60 días de garantía en repuestos y mano de obra mecánica',
    },
  },

  cosmetics: {
    verticalLabel: 'Cosmética y Belleza',
    verticalIcon: '✨',
    business: {
      name: 'Bella Dermocosmética & Perfumes',
      ruc: '80083912-1',
      city: 'Luque, Paraguay',
      tagline: 'Cuidado Facial, Maquillaje & Fragancias',
      ticketHeader: 'Comprobante detallado con fecha de vencimiento y lote',
      webFeature: 'Vitrina virtual para que las clientas pidan por WhatsApp',
    },
    pos: {
      scanPlaceholder: 'Escanear código de barra de cosmético o perfume... (EAN)',
      item1: { name: 'Sérum Ácido Hialurónico Puro 30ml', detail: '1 un. x ₲145.000', price: '₲145.000' },
      item2: { name: 'Protector Solar Toque Seco FPS 50+', detail: '1 un. x ₲115.000', price: '₲115.000' },
      total: '₲260.000',
    },
    inventory: {
      name: 'Crema Hidratante Reafirmante 50g',
      sku: 'CREM-REAF-50',
      barcode: '784409182390',
      cost: '₲62.000',
      price: '₲118.000',
      margin: '47.5%',
      stock: '16 un. (Lote venc. 2027)',
    },
    caja: {
      openingFund: '₲150.000',
      cashSales: '+₲1.100.000',
      qrSales: '₲890.000',
      expenses: '-₲30.000',
      physicalCash: '₲1.220.000',
    },
    sale: {
      number: 'Comprobante #000349',
      time: 'Hoy 17:10 hs',
      item1: { name: '1x Labial Líquido Matte Larga Duración', price: '₲42.000' },
      item2: { name: '1x Agua Micelar Desmaquillante 400ml', price: '₲56.000' },
      total: '₲98.000',
      method: 'QR Bancario / Pix',
    },
    website: {
      storeName: 'Bella Dermocosmética Catálogo',
      domain: 'tienda.4g.com.py/bellacosmetica',
      categories: [
        { icon: '✨', name: 'Cuidado Facial & Sueros', count: '28 opciones' },
        { icon: '💄', name: 'Maquillaje Profesional', count: '46 opciones' },
        { icon: '🌸', name: 'Perfumería Importada', count: '19 fragancias' },
      ],
    },
    users: {
      role: 'Asesora de Belleza',
      name: 'Camila Villalba',
      email: 'camila.ventas@bellacosmetica.com',
      allowed1: 'Atender mostrador y registrar cobros en POS',
      allowed2: 'Consultar lotes y recomendaciones de productos',
      blocked1: 'Bloqueado ver costos de compra de laboratorio',
      blocked2: 'Bloqueado alterar descuentos autorizados',
    },
    repairs: {
      orderNumber: 'OT-0105',
      device: 'Vaporizador Facial Profesional con Ozono Estético',
      serial: 'Serie Aparato: VAP-OZ-2022',
      defect: 'Resistencia térmica no eleva temperatura y limpieza del circuito anticalcáreo',
      parts: [
        { name: 'Resistencia Blindada Cerámica 750W', cost: '₲120.000' },
      ],
      labor: '₲80.000',
      total: '₲200.000',
      technician: 'Técnico en Aparatología Estética',
      status: 'listo',
      warranty: '60 días de garantía en componente térmico',
    },
  },

  electronics: {
    verticalLabel: 'Tecnología y Celulares',
    verticalIcon: '📱',
    business: {
      name: 'HCA Celular & Tecnología',
      ruc: '80092341-2',
      city: 'Asunción, Paraguay',
      tagline: 'Equipos, Accesorios & Servicio Técnico',
      ticketHeader: 'Membrete con IMEI/Serial del equipo y garantía escrita',
      webFeature: 'Catálogo de celulares y accesorios listo para pedidos por WhatsApp',
    },
    pos: {
      scanPlaceholder: 'Escanear código de barras o escribir producto... (7840...)',
      item1: { name: 'Cargador Rápido USB-C 20W Certificado', detail: '1 un. x ₲85.000', price: '₲85.000' },
      item2: { name: 'Funda Silicona Antigolpe TPU', detail: '2 un. x ₲25.000', price: '₲50.000' },
      total: '₲135.000',
    },
    inventory: {
      name: 'Auriculares Bluetooth Pro ANC In-Ear',
      sku: 'EAR-PRO-01',
      barcode: '784001928312',
      cost: '₲95.000',
      price: '₲160.000',
      margin: '40.6%',
      stock: '14 un. (Garantía 6 meses)',
    },
    caja: {
      openingFund: '₲200.000',
      cashSales: '+₲1.450.000',
      qrSales: '₲890.000',
      expenses: '-₲50.000',
      physicalCash: '₲1.600.000',
    },
    sale: {
      number: 'Comprobante #000142',
      time: 'Hoy 14:32 hs',
      item1: { name: '1x Cargador Tipo C 20W Carga Rápida', price: '₲85.000' },
      item2: { name: '1x Vidrio Templado 9D Curvo', price: '₲25.000' },
      total: '₲110.000',
      method: 'Transferencia / QR Bancario',
    },
    website: {
      storeName: 'HCA Celular Tienda Oficial',
      domain: 'tienda.4g.com.py/hcacelular',
      categories: [
        { icon: '📱', name: 'Celulares & Tablets', count: '12 modelos' },
        { icon: '🎧', name: 'Audio & Auriculares', count: '28 modelos' },
        { icon: '🔋', name: 'Cargadores & Cables', count: '15 modelos' },
      ],
    },
    users: {
      role: 'Técnico / Vendedor',
      name: 'Carlos Mendoza',
      email: 'carlos.mendoza@negocio.com',
      allowed1: 'Cobrar en POS y recibir órdenes de taller',
      allowed2: 'Consultar catálogo y stock en tiempo real',
      blocked1: 'Bloqueado ver costo de compra de repuestos',
      blocked2: 'Bloqueado anular ventas o borrar cajas',
    },
    repairs: {
      orderNumber: 'OT-0428',
      device: 'Samsung Galaxy S22 Ultra (Phantom Black)',
      serial: 'IMEI: 354891028471920',
      defect: 'Pantalla quebrada sin imagen y batería con degradación acelerada',
      parts: [
        { name: 'Módulo Display Dynamic AMOLED 2X Original', cost: '₲680.000' },
        { name: 'Batería 5000mAh Original con Adhesivo', cost: '₲180.000' },
      ],
      labor: '₲120.000',
      total: '₲980.000',
      technician: 'Carlos Mendoza (Técnico Nivel 2)',
      status: 'listo',
      warranty: '90 días de garantía escrita en display y batería instalada',
    },
  },

  general: {
    verticalLabel: 'Comercio General y Bazar',
    verticalIcon: '🏬',
    business: {
      name: 'Comercial & Bazar Guaraní',
      ruc: '80054321-9',
      city: 'Asunción, Paraguay',
      tagline: 'Artículos de Hogar, Bazar & Regalería',
      ticketHeader: 'Membrete comercial con Nombre, RUC y teléfono',
      webFeature: 'Catálogo de productos destacados con contacto por WhatsApp',
    },
    pos: {
      scanPlaceholder: 'Escanear código de barra de producto... (EAN/SKU)',
      item1: { name: 'Juego de Vasos Vidrio Templado x6', detail: '1 set x ₲45.000', price: '₲45.000' },
      item2: { name: 'Termo Acero Inoxidable 1 Litro Frío/Calor', detail: '1 un. x ₲95.000', price: '₲95.000' },
      total: '₲140.000',
    },
    inventory: {
      name: 'Juego de Sábanas Queen 100% Algodón',
      sku: 'SAB-QUEEN-01',
      barcode: '784500918231',
      cost: '₲110.000',
      price: '₲190.000',
      margin: '42.1%',
      stock: '12 juegos en stock',
    },
    caja: {
      openingFund: '₲200.000',
      cashSales: '+₲1.600.000',
      qrSales: '₲780.000',
      expenses: '-₲45.000',
      physicalCash: '₲1.755.000',
    },
    sale: {
      number: 'Ticket #000821',
      time: 'Hoy 11:40 hs',
      item1: { name: '1x Set Organizador Multiuso Cocina', price: '₲65.000' },
      item2: { name: '2x Lámpara LED 12W Luz Cálida', price: '₲26.000' },
      total: '₲91.000',
      method: 'Efectivo / Débito',
    },
    website: {
      storeName: 'Comercial Guaraní Catálogo Web',
      domain: 'tienda.4g.com.py/comercialguarani',
      categories: [
        { icon: '🏠', name: 'Artículos para el Hogar', count: '48 productos' },
        { icon: '🎁', name: 'Bazar & Regalería', count: '65 productos' },
        { icon: '📦', name: 'Ofertas del Mes', count: '20 productos' },
      ],
    },
    users: {
      role: 'Vendedor de Salón',
      name: 'Rodrigo Gómez',
      email: 'rodrigo.ventas@comercial.com',
      allowed1: 'Cobrar en Punto de Venta POS',
      allowed2: 'Consultar catálogo y stock en salón',
      blocked1: 'Bloqueado ver costo de mercadería',
      blocked2: 'Bloqueado anular comprobantes emitidos',
    },
    repairs: {
      orderNumber: 'OT-0230',
      device: 'Termo Eléctrico Hervidor de Acero 2L',
      serial: 'Serie: TERM-2L-2023',
      defect: 'Termostato de corte no acciona y base con sulfatación',
      parts: [
        { name: 'Termostato Bimetálico 105°C', cost: '₲30.000' },
      ],
      labor: '₲45.000',
      total: '₲75.000',
      technician: 'Servicio Técnico de Bazar',
      status: 'listo',
      warranty: '60 días de garantía en termostato',
    },
  },
}

export function getVerticalMockupData(vertical?: BusinessVertical | string): VerticalMockupData {
  if (vertical && VERTICAL_MOCKUPS[vertical]) {
    return VERTICAL_MOCKUPS[vertical]
  }
  return VERTICAL_MOCKUPS.electronics
}
