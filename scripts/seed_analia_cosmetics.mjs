import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    }
  })
}
loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ORG_ID = 'c739da93-cb3c-4393-a88e-a419a004f11b'
const USER_ID = '5c6148cd-9d77-46f3-b364-c85f8cf0c4f0' // analiak026@gmail.com

async function seed() {
  console.log('--- 1. Actualizando Organización ---')
  const { error: orgErr } = await supabase
    .from('organizations')
    .update({
      name: 'Paravos Cosméticos',
      business_vertical: 'cosmetics',
      logo_url: '/branding/paravos-logo.webp',
      storefront_public: true,
      marketplace_public: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ORG_ID)

  if (orgErr) console.error('Error org update:', orgErr)
  else console.log('Organización actualizada con éxito.')

  console.log('--- 2. Creando Categorías de Cosmética ---')
  const categoryDefs = [
    { name: 'Sérums & Tratamientos Activos', description: 'Fórmulas concentradas con Ácido Hialurónico, Vitamina C y Niacinamida' },
    { name: 'Cremas Hidratantes & Nutritivas', description: 'Hidratación profunda, restauración de barrera cutánea y efecto glow' },
    { name: 'Protección Solar & Filtros', description: 'Protectores solares invisibles FPS 50+ toque seco sin residuos blancos' },
    { name: 'Limpieza Facial & Desmaquillantes', description: 'Espumas suaves, aguas micelares botánicas y geles purificantes' },
    { name: 'Mascarillas & Cuidado Especial', description: 'Tratamientos hidroplásticos, arcilla rosa desintoxicante y parches' },
    { name: 'Bálsamos & Cuidado de Labios', description: 'Reparación intensiva con manteca de karité y ácido hialurónico' },
  ]

  // Limpiar categorías existentes o actualizar
  const { data: existingCats } = await supabase.from('categories').select('id, name').eq('organization_id', ORG_ID)
  console.log('Categorías existentes antes:', existingCats?.map(c => c.name))

  const catMap = new Map()

  for (const cat of categoryDefs) {
    const found = existingCats?.find(c => c.name.toLowerCase() === cat.name.toLowerCase())
    if (found) {
      catMap.set(cat.name, found.id)
    } else {
      const { data: inserted, error: catErr } = await supabase
        .from('categories')
        .insert({
          organization_id: ORG_ID,
          name: cat.name,
          description: cat.description,
          is_active: true,
        })
        .select()
        .single()
      if (catErr) {
        console.error('Error insertando categoría', cat.name, catErr)
      } else {
        catMap.set(cat.name, inserted.id)
      }
    }
  }

  // Renombrar o asociar las 3 viejas si no se usaron
  if (existingCats && existingCats.length > 0) {
    for (const ec of existingCats) {
      if (![...catMap.values()].includes(ec.id)) {
        // delete or keep as extra
        console.log('Categoría antigua encontrada:', ec.name)
      }
    }
  }

  console.log('Categorías listas:', [...catMap.entries()])

  console.log('--- 3. Creando Productos de Cosmética ---')
  // Eliminar productos previos de esta org si existieran
  await supabase.from('products').delete().eq('organization_id', ORG_ID)

  const productsData = [
    {
      sku: 'PAR-SER-01',
      name: 'Sérum Hidratante Ácido Hialurónico Puro 2% + B5 30ml',
      description: 'Hidratación multicapa de absorción inmediata. Tres pesos moleculares para rellenar líneas finas y devolver elasticidad natural a la piel.',
      brand: 'Glowora Lab',
      category_id: catMap.get('Sérums & Tratamientos Activos') || null,
      purchase_price: 80000,
      sale_price: 145000,
      wholesale_price: 120000,
      has_offer: true,
      offer_price: 125000,
      stock_quantity: 35,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-pedestal.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-pedestal.webp'],
      is_active: true,
      featured: true,
      visibility: 'public',
      organization_id: ORG_ID,
    },
    {
      sku: 'PAR-CRM-02',
      name: 'Crema Hidratante Facial Péptidos & Niacinamida 50g',
      description: 'Restaura y fortalece la barrera lipídica cutánea. Acabado suave y aterciopelado sin sensación oleosa. Ideal para pieles sensibles y mixtas.',
      brand: 'Glowora Lab',
      category_id: catMap.get('Cremas Hidratantes & Nutritivas') || null,
      purchase_price: 105000,
      sale_price: 185000,
      wholesale_price: 155000,
      has_offer: true,
      offer_price: 155000,
      stock_quantity: 28,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-serum.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-serum.webp'],
      is_active: true,
      featured: true,
      visibility: 'public',
      organization_id: ORG_ID,
    },
    {
      sku: 'PAR-SOL-03',
      name: 'Protector Solar Invisible Fluido FPS 50+ Toque Seco 50ml',
      description: 'Protección dermatológica de amplio espectro UVA/UVB. Textura ultraligera invisible, resistente al agua y perfecta base pre-maquillaje.',
      brand: 'Paravos Shield',
      category_id: catMap.get('Protección Solar & Filtros') || null,
      purchase_price: 65000,
      sale_price: 120000,
      wholesale_price: 98000,
      has_offer: false,
      offer_price: null,
      stock_quantity: 45,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-modelo.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-modelo.webp'],
      is_active: true,
      featured: true,
      visibility: 'public',
      organization_id: ORG_ID,
    },
    {
      sku: 'PAR-LIM-04',
      name: 'Espuma Limpiadora Facial Botánica con Extracto de Té Blanco 150ml',
      description: 'Limpia profundamente los poros sin resecar ni alterar el pH natural de la piel. Calma rojeces con extractos botánicos puros.',
      brand: 'Paravos Pure',
      category_id: catMap.get('Limpieza Facial & Desmaquillantes') || null,
      purchase_price: 50000,
      sale_price: 95000,
      wholesale_price: 78000,
      has_offer: false,
      offer_price: null,
      stock_quantity: 30,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-spa.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-spa.webp'],
      is_active: true,
      featured: false,
      visibility: 'public',
      organization_id: ORG_ID,
    },
    {
      sku: 'PAR-OIL-05',
      name: 'Aceite Facial Reparador Rosa Mosqueta & Escualano Vegetal 30ml',
      description: 'Gotas de nutrición intensiva nocturna. Atenúa manchas solares, unifica el tono y deja un acabado glow natural al despertar.',
      brand: 'Paravos Botanicals',
      category_id: catMap.get('Sérums & Tratamientos Activos') || null,
      purchase_price: 90000,
      sale_price: 160000,
      wholesale_price: 130000,
      has_offer: true,
      offer_price: 135000,
      stock_quantity: 20,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-boutique.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-boutique.webp'],
      is_active: true,
      featured: true,
      visibility: 'public',
      organization_id: ORG_ID,
    },
    {
      sku: 'PAR-VIT-06',
      name: 'Sérum Antioxidante Vitamina C 15% Pura + Ácido Ferúlico 30ml',
      description: 'Potente escudo antioxidante diario. Ilumina pieles apagadas, combate radicales libres y estimula la síntesis de colágeno.',
      brand: 'Glowora Lab',
      category_id: catMap.get('Sérums & Tratamientos Activos') || null,
      purchase_price: 95000,
      sale_price: 175000,
      wholesale_price: 140000,
      has_offer: true,
      offer_price: 145000,
      stock_quantity: 25,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-pedestal.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-pedestal.webp'],
      is_active: true,
      featured: true,
      visibility: 'public',
      organization_id: ORG_ID,
    },
    {
      sku: 'PAR-MSK-07',
      name: 'Mascarilla Facial Desintoxicante Arcilla Rosa Francesa 100g',
      description: 'Efecto spa purificante en 15 minutos. Minimiza apariencia de poros y remueve impurezas sin deshidratar la superficie cutánea.',
      brand: 'Paravos Spa',
      category_id: catMap.get('Mascarillas & Cuidado Especial') || null,
      purchase_price: 45000,
      sale_price: 85000,
      wholesale_price: 68000,
      has_offer: false,
      offer_price: null,
      stock_quantity: 32,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-spa.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-spa.webp'],
      is_active: true,
      featured: false,
      visibility: 'public',
      organization_id: ORG_ID,
    },
    {
      sku: 'PAR-LIP-08',
      name: 'Bálsamo Labial Reparador Hialurónico & Karité 15g',
      description: 'Nutrición inmediata para labios secos o agrietados con acabado satinado natural. Aroma suave a vainilla y frutos rojos.',
      brand: 'Paravos Glow',
      category_id: catMap.get('Bálsamos & Cuidado de Labios') || null,
      purchase_price: 25000,
      sale_price: 48000,
      wholesale_price: 38000,
      has_offer: false,
      offer_price: null,
      stock_quantity: 50,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-serum.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-serum.webp'],
      is_active: true,
      featured: false,
      visibility: 'public',
      organization_id: ORG_ID,
    },
    {
      sku: 'PAR-EYE-09',
      name: 'Contorno de Ojos Descongestivo Cafeína 5% & Péptidos 15ml',
      description: 'Reduce ojeras pigmentarias, drena bolsas matutinas e ilumina la mirada cansada con aplicador metálico frío.',
      brand: 'Glowora Lab',
      category_id: catMap.get('Sérums & Tratamientos Activos') || null,
      purchase_price: 65000,
      sale_price: 115000,
      wholesale_price: 92000,
      has_offer: true,
      offer_price: 98000,
      stock_quantity: 26,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-modelo.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-modelo.webp'],
      is_active: true,
      featured: true,
      visibility: 'public',
      organization_id: ORG_ID,
    },
    {
      sku: 'PAR-TON-10',
      name: 'Tónico Exfoliante Renovador Glow Ácido Glicólico 7% 120ml',
      description: 'Exfoliación química suave sin granos. Elimina células muertas, suaviza la textura áspera y revela una piel luminosa y uniforme.',
      brand: 'Paravos Pure',
      category_id: catMap.get('Limpieza Facial & Desmaquillantes') || null,
      purchase_price: 60000,
      sale_price: 110000,
      wholesale_price: 88000,
      has_offer: false,
      offer_price: null,
      stock_quantity: 24,
      unit_measure: 'unidad',
      image_url: '/images/promotional-carousel/hero-cosmetica-boutique.webp',
      images: ['/images/promotional-carousel/hero-cosmetica-boutique.webp'],
      is_active: true,
      featured: false,
      visibility: 'public',
      organization_id: ORG_ID,
    },
  ]

  const { data: insertedProds, error: prodErr } = await supabase
    .from('products')
    .insert(productsData)
    .select('id, name')

  if (prodErr) {
    console.error('Error insertando productos:', prodErr)
  } else {
    console.log(`Insertados ${insertedProds.length} productos con éxito.`)
  }

  console.log('--- 4. Creando Promociones y Cupones ---')
  await supabase.from('promotions').delete().eq('organization_id', ORG_ID)

  const promoDefs = [
    {
      name: '20% OFF en Rutinas & Combos',
      code: 'GLOW20',
      description: '20% de descuento directo en combos y productos seleccionados de cuidado facial',
      type: 'percentage',
      value: 20,
      min_purchase: 150000,
      max_discount: 100000,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      usage_count: 8,
      usage_limit: 100,
      is_active: true,
      applicable_products: [],
      applicable_categories: [],
      organization_id: ORG_ID,
      public_mode: 'coupon',
    },
    {
      name: '15% OFF Primera Compra',
      code: 'BIENVENIDA15',
      description: '15% de descuento en tu primera compra online para renovar tu skincare',
      type: 'percentage',
      value: 15,
      min_purchase: 100000,
      max_discount: 50000,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      usage_count: 14,
      usage_limit: 200,
      is_active: true,
      applicable_products: [],
      applicable_categories: [],
      organization_id: ORG_ID,
      public_mode: 'coupon',
    },
    {
      name: 'Gs. 25.000 OFF en Compras Superiores a Gs. 200.000',
      code: 'PARAVOS25K',
      description: 'Descuento directo de 25.000 Guaraníes en tu carrito',
      type: 'fixed',
      value: 25000,
      min_purchase: 200000,
      max_discount: null,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString(),
      usage_count: 3,
      usage_limit: 80,
      is_active: true,
      applicable_products: [],
      applicable_categories: [],
      organization_id: ORG_ID,
      public_mode: 'coupon',
    },
  ]

  const { data: insertedPromos, error: promoErr } = await supabase
    .from('promotions')
    .insert(promoDefs)
    .select('id, code')

  if (promoErr) {
    console.error('Error insertando promociones:', promoErr)
  } else {
    console.log(`Insertadas ${insertedPromos.length} promociones con éxito.`)
  }

  console.log('--- 5. Configurando Website Settings (Banners, Ofertas, Trust Bar, Perfil) ---')
  
  // 5.1 Company info
  const companyInfoValue = {
    name: 'Paravos Cosméticos',
    slogan: 'Alta Cosmética & Cuidado Botánico',
    description: 'Boutique especializada en dermocosmética, skincare de autor y rutinas personalizadas. Envíos express a todo Paraguay y atención guiada por cosmetólogas.',
    phone: '+595 981 111 111',
    whatsapp: '+595 981 111 111',
    email: 'analiak026@gmail.com',
    address: 'Lomas Valentinas c/ Mcal. Estigarribia, Encarnación',
    mapsUrl: 'https://maps.google.com/?q=-27.33056,-55.86667',
    brandColor: 'rose',
    headerStyle: 'solid',
    storefrontStyle: 'especial-cosmeticos',
    storefrontPublic: true,
    marketplacePublic: true,
    showTopBar: true,
    hours: {
      weekdays: 'Lun a Vie: 08:30 a 19:30 hs',
      saturday: 'Sáb: 09:00 a 18:00 hs',
      sunday: 'Domingos cerrado',
    },
    instagram: 'paravos_cosmeticos',
    facebook: 'paravos_cosmeticos',
    tiktok: 'paravos_cosmeticos',
    logoUrl: '/branding/paravos-logo.webp',
    slug: 'paravos',
    businessType: 'retail',
    processSectionEnabled: true,
    servicesPageEnabled: false,
    repairTrackingEnabled: false,
  }

  // 5.2 Promotional Carousel (Hero)
  const promotionalCarouselValue = {
    enabled: true,
    autoplay: true,
    intervalSeconds: 6,
    layoutMode: 'contained',
    slides: [
      {
        id: 'slide-cosmetica-01',
        title: 'Revelá Tu Brillo Natural & Saludable',
        badge: '✨ ALTA DERMOCOSMÉTICA',
        message: 'Fórmulas botánicas y ciencia dermatológica avanzada para hidratar, proteger y transformar tu piel en 14 días.',
        imageUrl: '/images/promotional-carousel/hero-cosmetica-modelo.webp',
        imageAlt: 'Modelo con piel luminosa y radiante aplicando sérum facial',
        active: true,
        ctaText: 'Comprar Ahora',
        ctaHref: '/productos',
        textTone: 'light',
        titleSize: 'normal',
        titleColor: '',
        contentAlign: 'left',
        overlayColor: 'black',
        backgroundColor: '',
        overlayIntensity: 'medium',
        hideText: false,
      },
      {
        id: 'slide-cosmetica-02',
        title: '25% OFF en Sets & Combos de Rutina',
        badge: '🎁 EDICIÓN ESPECIAL',
        message: 'Llevate tu limpiador botánico, sérum activo y crema reafirmante con descuento directo y envío express a todo el país.',
        imageUrl: '/images/promotional-carousel/hero-cosmetica-pedestal.webp',
        imageAlt: 'Set de sérum y crema facial sobre pedestal de mármol con rosas',
        active: true,
        ctaText: 'Ver Ofertas',
        ctaHref: '/ofertas',
        textTone: 'light',
        titleSize: 'normal',
        titleColor: '',
        contentAlign: 'left',
        overlayColor: 'black',
        backgroundColor: '',
        overlayIntensity: 'strong',
        hideText: false,
      },
      {
        id: 'slide-cosmetica-03',
        title: 'Protección Solar FPS 50+ Invisible',
        badge: '☀️ FOTOPROTECCIÓN DIARIA',
        message: 'Textura ultraligera toque seco sin efecto blanco, resistente al sudor y la base perfecta para tu maquillaje.',
        imageUrl: '/images/promotional-carousel/hero-cosmetica-serum.webp',
        imageAlt: 'Protector solar y crema hidratante en ambiente de luz natural',
        active: true,
        ctaText: 'Ver Protectores',
        ctaHref: '/productos',
        textTone: 'light',
        titleSize: 'normal',
        titleColor: '',
        contentAlign: 'left',
        overlayColor: 'black',
        backgroundColor: '',
        overlayIntensity: 'strong',
        hideText: false,
      },
      {
        id: 'slide-cosmetica-04',
        title: 'Asesoramiento Personalizado de Rutina',
        badge: '💬 ATENCIÓN POR WHATSAPP',
        message: '¿No sabés qué activo necesita tu piel? Escribinos y nuestras asesoras te guían paso a paso para armar tu rutina.',
        imageUrl: '/images/promotional-carousel/hero-cosmetica-boutique.webp',
        imageAlt: 'Interior elegante de boutique de cosmética y showroom',
        active: true,
        ctaText: 'Escribinos al WhatsApp',
        ctaHref: 'https://wa.me/595981111111',
        textTone: 'light',
        titleSize: 'normal',
        titleColor: '',
        contentAlign: 'right',
        overlayColor: 'black',
        backgroundColor: '',
        overlayIntensity: 'strong',
        hideText: false,
      },
    ],
  }

  // 5.3 Offers Carousel (Página de Ofertas / Banners de promociones)
  const offersCarouselValue = {
    enabled: true,
    autoplay: true,
    intervalSeconds: 6,
    layoutMode: 'contained',
    slides: [
      {
        id: 'banner-oferta-combo-glow',
        badge: '🔥 25% OFF EXCLUSIVO',
        title: 'Set Rutina Glow Completa',
        active: true,
        ctaHref: '/productos?ofertas=true',
        ctaText: 'Comprar Set con Descuento',
        message: 'Llevate el Limpiador + Sérum Hialurónico + Crema Péptidos con descuento directo en tu compra.',
        hideText: false,
        imageAlt: 'Set de cosméticos sobre pedestal con rosas y crema de belleza',
        imageUrl: '/images/promotional-carousel/hero-cosmetica-pedestal.webp',
        textTone: 'light',
        titleSize: 'normal',
        titleColor: '',
        contentAlign: 'left',
        overlayColor: 'black',
        backgroundColor: '',
        overlayIntensity: 'strong',
      },
      {
        id: 'banner-oferta-duo-antioxidante',
        badge: '⚡ REBAJAS HASTA 30%',
        title: 'Dúo Fotoprotección & Vitamina C',
        active: true,
        ctaHref: '/productos?ofertas=true',
        ctaText: 'Ver Dúo en Oferta',
        message: 'Máxima luminosidad y protección contra manchas y radicales libres con precio especial de temporada.',
        hideText: false,
        imageAlt: 'Frascos de sérum con cuentagotas y protección solar',
        imageUrl: '/images/promotional-carousel/hero-cosmetica-modelo.webp',
        textTone: 'light',
        titleSize: 'normal',
        titleColor: '',
        contentAlign: 'left',
        overlayColor: 'black',
        backgroundColor: '',
        overlayIntensity: 'strong',
      },
      {
        id: 'banner-oferta-kit-spa-noche',
        badge: '🌸 EDICIÓN LIMITADA',
        title: 'Kit Spa Renovación Nocturna',
        active: true,
        ctaHref: '/productos?ofertas=true',
        ctaText: 'Ver Kit Spa',
        message: 'Aceite de Rosa Mosqueta puro + Mascarilla de Arcilla Rosa Francesa para nutrir y regenerar tu piel mientras dormís.',
        hideText: false,
        imageAlt: 'Frascos de cosmética natural y aceite botánico de noche',
        imageUrl: '/images/promotional-carousel/hero-cosmetica-spa.webp',
        textTone: 'light',
        titleSize: 'normal',
        titleColor: '',
        contentAlign: 'left',
        overlayColor: 'black',
        backgroundColor: '',
        overlayIntensity: 'strong',
      },
    ],
  }

  // 5.4 Offers Section
  const offersSectionValue = {
    title: 'Ofertas & Descuentos en Skincare',
    eyebrow: 'TEMPORADA DE DESCUENTOS',
    subtitle: 'Aprovechá descuentos exclusivos en combos de cuidado diario, sérums activos y fotoprotección con stock para entrega inmediata.',
    accentColor: 'rose',
    enabled: true,
    carousel: {
      enabled: true,
      autoplay: true,
      intervalSeconds: 6,
      maxItems: 8,
      title: 'Kits & Tratamientos con Precio Rebajado',
      subtitle: 'Fórmulas de alta gama con descuento directo por tiempo limitado',
    },
  }

  // 5.5 Trust Bar (sin Garantía de Originalidad)
  const trustBarValue = {
    enabled: true,
    position: 'above_carousel',
    items: [
      {
        id: 'envios',
        icon: 'truck',
        title: 'Envíos a Todo el País',
        active: true,
        description: 'Express en Encarnación y envíos rápidos a todo Paraguay',
      },
      {
        id: 'pagos',
        icon: 'credit-card',
        title: 'Pagos 100% Seguros',
        active: true,
        description: 'QR bancario, transferencias, tarjetas de crédito y efectivo',
      },
      {
        id: 'cambios',
        icon: 'package',
        title: 'Cambios y Devoluciones',
        active: true,
        description: 'Hasta 7 días para cambios directos con tu comprobante',
      },
      {
        id: 'asesoria',
        icon: 'message',
        title: 'Asesoría Personalizada',
        active: true,
        description: 'Nuestras cosmetólogas te guían por WhatsApp para armar tu rutina',
      },
    ],
  }

  // 5.6 Hero Content
  const heroContentValue = {
    enabled: true,
    badge: '✨ Alta Cosmética & Skincare',
    title: 'Revelá Tu Brillo Natural & Saludable',
    subtitle: 'Fórmulas botánicas y ciencia dermatológica avanzada para cuidar y transformar tu piel en 14 días.',
    ctaPrimaryText: 'Comprar Ahora',
    ctaSecondaryText: 'Ver Rutina',
    trustBadges: [
      '100% Vegano',
      'Cruelty Free',
      'Testado Dermatológicamente',
    ],
    trackRepairText: '¿Hiciste un pedido? Consultá el estado de tu envío',
  }

  // Upsert website_settings keys
  const settingsToUpsert = [
    { key: 'company_info', value: companyInfoValue },
    { key: 'promotional_carousel', value: promotionalCarouselValue },
    { key: 'offers_carousel', value: offersCarouselValue },
    { key: 'offers_section', value: offersSectionValue },
    { key: 'trust_bar', value: trustBarValue },
    { key: 'hero_content', value: heroContentValue },
  ]

  for (const item of settingsToUpsert) {
    const { data: existing } = await supabase
      .from('website_settings')
      .select('id')
      .eq('organization_id', ORG_ID)
      .eq('key', item.key)
      .maybeSingle()

    if (existing) {
      const { error: updErr } = await supabase
        .from('website_settings')
        .update({
          value: item.value,
          updated_at: new Date().toISOString(),
          updated_by: USER_ID,
        })
        .eq('id', existing.id)
      if (updErr) console.error(`Error actualizando ${item.key}:`, updErr)
      else console.log(`Configuración actualizada: ${item.key}`)
    } else {
      const { error: insErr } = await supabase
        .from('website_settings')
        .insert({
          organization_id: ORG_ID,
          key: item.key,
          value: item.value,
          updated_by: USER_ID,
        })
      if (insErr) console.error(`Error insertando ${item.key}:`, insErr)
      else console.log(`Configuración creada: ${item.key}`)
    }
  }

  console.log('--- ¡Seed completado con éxito! ---')
}

seed().catch(console.error)
