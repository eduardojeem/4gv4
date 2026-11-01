import {
  Activity,
  Bot,
  Code2,
  Cpu,
  CreditCard,
  Database,
  Globe,
  Layers,
  Mail,
  Server,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { ExpenseCategory, ExpenseCurrency, ExpenseRecurrence } from './platform-finance'

/**
 * Catálogo del Stack Tecnológico, Software y Servicios de Infraestructura
 * utilizados por el equipo para crear, hospedar, compilar y operar MiTienda.
 */

export interface PlatformSystemTool {
  id: string
  name: string
  provider: string
  category: ExpenseCategory
  role: string
  description: string
  typicalPricing: string
  defaultCurrency: ExpenseCurrency
  defaultAmount: number
  defaultRecurrence: ExpenseRecurrence
  defaultFxRate: number
  icon: LucideIcon
  keyFeatures: string[]
  websiteUrl?: string
  dashboardUrl?: string
}

export const PLATFORM_SYSTEM_TOOLS: readonly PlatformSystemTool[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    provider: 'Vercel',
    category: 'infraestructura',
    role: 'Hosting Next.js 16 y Red Edge CDN',
    description:
      'Plataforma serverless y red de borde (Edge CDN) donde se ejecuta la aplicación web Next.js 16, el panel administrativo y las tiendas públicas con SSR/ISR de alta velocidad y certificados SSL automáticos.',
    typicalPricing: 'USD 20 / mes (Plan Pro) + cómputo serverless',
    defaultCurrency: 'USD',
    defaultAmount: 20,
    defaultRecurrence: 'monthly',
    defaultFxRate: 7500,
    icon: Globe,
    keyFeatures: [
      'Next.js 16 App Router & Server Actions',
      'Edge CDN global y caché distribuida',
      'Despliegues automáticos desde Git',
      'SSL comodín para subdominios y dominios propios',
    ],
    websiteUrl: 'https://vercel.com',
    dashboardUrl: 'https://vercel.com/dashboard',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    provider: 'Supabase',
    category: 'infraestructura',
    role: 'Base de Datos PostgreSQL, Auth y Storage',
    description:
      'Infraestructura backend central. Aloja la base de datos PostgreSQL 15 multi-tenant protegida por Row Level Security (RLS), Supabase Auth con soporte 2FA TOTP, almacenamiento S3 para fotos del catálogo y WebSockets Realtime para pedidos en mostrador y delivery.',
    typicalPricing: 'USD 25 / mes (Plan Pro) + cómputo y storage',
    defaultCurrency: 'USD',
    defaultAmount: 25,
    defaultRecurrence: 'monthly',
    defaultFxRate: 7500,
    icon: Database,
    keyFeatures: [
      'PostgreSQL 15 con extensiones y RLS estricto',
      'Supabase Auth (JWT, sesiones reales y 2FA TOTP)',
      'Supabase Storage (catálogo de fotos e imágenes)',
      'WebSockets Realtime para pedidos y monitor de caja',
    ],
    websiteUrl: 'https://supabase.com',
    dashboardUrl: 'https://supabase.com/dashboard',
  },
  {
    id: 'expo',
    name: 'Expo & EAS (Expo Application Services)',
    provider: 'Expo',
    category: 'herramientas',
    role: 'Framework Móvil React Native y Cloud Build',
    description:
      'Ecosistema para compilar, probar y distribuir la aplicación móvil nativa de MiTienda para Android e iOS. Provee compilaciones nativas en la nube (EAS Build), actualizaciones OTA instantáneas (EAS Update) y firma de APK/AAB.',
    typicalPricing: 'Gratis con cuota / USD 29 / mes (EAS Production)',
    defaultCurrency: 'USD',
    defaultAmount: 29,
    defaultRecurrence: 'monthly',
    defaultFxRate: 7500,
    icon: Smartphone,
    keyFeatures: [
      'React Native & Expo Router multiplataforma',
      'Compilación en la nube (EAS Build Android/iOS)',
      'Actualizaciones inmediatas sin pasar por tienda (OTA Updates)',
      'Publicación automatizada (EAS Submit)',
    ],
    websiteUrl: 'https://expo.dev',
    dashboardUrl: 'https://expo.dev/accounts',
  },
  {
    id: 'claude',
    name: 'Claude API (Anthropic)',
    provider: 'Anthropic',
    category: 'herramientas',
    role: 'Inteligencia Artificial y Modelos de Lenguaje',
    description:
      'API de Inteligencia Artificial para asistencia técnica, redacción automática de descripciones de productos, catalogación de inventario, soporte guiado y desarrollo asistido de la plataforma.',
    typicalPricing: 'Pago por uso (USD ~0.003 - 0.015 / 1K tokens)',
    defaultCurrency: 'USD',
    defaultAmount: 20,
    defaultRecurrence: 'monthly',
    defaultFxRate: 7500,
    icon: Bot,
    keyFeatures: [
      'Modelos Claude 3.5 Sonnet y Haiku de alta velocidad',
      'Generación inteligente de fichas y textos comerciales',
      'Asistencia automatizada al comerciante',
      'Análisis avanzado de catálogos y descripciones',
    ],
    websiteUrl: 'https://anthropic.com',
    dashboardUrl: 'https://console.anthropic.com',
  },
  {
    id: 'gemini',
    name: 'Google Gemini API',
    provider: 'Google Cloud',
    category: 'herramientas',
    role: 'IA Multimodal y Visión Artificial',
    description:
      'Modelos Gemini 1.5 Flash y Pro con capacidades multimodales para procesar imágenes de tickets, comprobantes de pago bancarios, códigos de barras, y cálculo de similitud semántica en búsquedas de catálogo.',
    typicalPricing: 'Capa gratuita + USD 0.35 - 3.50 / millón de tokens',
    defaultCurrency: 'USD',
    defaultAmount: 15,
    defaultRecurrence: 'monthly',
    defaultFxRate: 7500,
    icon: Sparkles,
    keyFeatures: [
      'Gemini 1.5 Flash multimodal ultra-rápido',
      'Extracción visual de datos en comprobantes de pago',
      'Embeddings semánticos para búsqueda de catálogo',
      'Baja latencia y costos optimizados por tokens',
    ],
    websiteUrl: 'https://ai.google.dev',
    dashboardUrl: 'https://aistudio.google.com',
  },
  {
    id: 'dominio',
    name: 'Dominios y Gestión DNS',
    provider: 'NIC.py / Registrar',
    category: 'infraestructura',
    role: 'Nombres de Dominio Oficiales y Enrutamiento',
    description:
      'Registro anual de los dominios oficiales de la plataforma (.com.py territorial vía NIC.py y .com global), enrutamiento Anycast DNS en la nube, protección contra ataques y certificados de seguridad TLS.',
    typicalPricing: 'Gs. 200.000 / año (NIC.py) + USD 12 / año (.com)',
    defaultCurrency: 'PYG',
    defaultAmount: 220000,
    defaultRecurrence: 'yearly',
    defaultFxRate: 1,
    icon: Server,
    keyFeatures: [
      'Dominios de marca territorial .com.py y .com',
      'Gestión de subdominios comerciales automáticos',
      'Servidores DNS con Anycast de baja latencia',
      'Renovación anual y protección de identidad',
    ],
    websiteUrl: 'https://www.nic.py',
  },
  {
    id: 'resend',
    name: 'Resend',
    provider: 'Resend',
    category: 'herramientas',
    role: 'Envío de Correos Transaccionales y 2FA',
    description:
      'Servicio de correo electrónico transaccional con alta entregabilidad y autenticación DKIM/SPF. Envía notificaciones de pedidos nuevos, comprobantes de compra, bienvenidas a tiendas y códigos de verificación 2FA.',
    typicalPricing: 'Gratis hasta 3.000 emails / USD 20 / mes (50.000 emails)',
    defaultCurrency: 'USD',
    defaultAmount: 20,
    defaultRecurrence: 'monthly',
    defaultFxRate: 7500,
    icon: Mail,
    keyFeatures: [
      'Entregabilidad directa a bandeja de entrada (DKIM/SPF)',
      'Plantillas modernas con React Email',
      'Notificaciones de compra para clientes y comercios',
      'Alertas de seguridad y códigos 2FA',
    ],
    websiteUrl: 'https://resend.com',
    dashboardUrl: 'https://resend.com/overview',
  },
  {
    id: 'github',
    name: 'GitHub & CI/CD',
    provider: 'GitHub',
    category: 'herramientas',
    role: 'Control de Versiones y Pipelines de CI/CD',
    description:
      'Alojamiento del repositorio central de código fuente de la plataforma (web y app móvil), ramas de desarrollo, control de cambios, auditoría de seguridad y ejecución de tests en GitHub Actions.',
    typicalPricing: 'Gratis para equipos pequeños / USD 4 por usuario / mes (Plan Team)',
    defaultCurrency: 'USD',
    defaultAmount: 4,
    defaultRecurrence: 'monthly',
    defaultFxRate: 7500,
    icon: Code2,
    keyFeatures: [
      'Repositorio privado con control de ramas y worktrees',
      'GitHub Actions para pruebas automatizadas y typecheck',
      'Auditoría continua de dependencias (Dependabot)',
      'Gestión de versiones y etiquetas de release',
    ],
    websiteUrl: 'https://github.com',
    dashboardUrl: 'https://github.com/eduardojeem/4gv4',
  },
  {
    id: 'app-stores',
    name: 'Cuentas de Desarrollador Móvil (Google Play & Apple)',
    provider: 'Google Play & Apple Developer',
    category: 'otros',
    role: 'Publicación en Tiendas Móviles Oficiales',
    description:
      'Membresías de desarrollador necesarias para publicar, certificar y mantener disponible la app móvil de MiTienda en Google Play Store (Android) y Apple App Store (iOS).',
    typicalPricing: 'Google Play: USD 25 (único) / Apple: USD 99 / año',
    defaultCurrency: 'USD',
    defaultAmount: 99,
    defaultRecurrence: 'yearly',
    defaultFxRate: 7500,
    icon: Layers,
    keyFeatures: [
      'Publicación oficial en Google Play Store (Android)',
      'Publicación oficial en Apple App Store (iOS)',
      'Firma criptográfica de binarios y certificados de producción',
      'Métricas de descargas, reseñas y estabilidad de la app',
    ],
    websiteUrl: 'https://play.google.com/console',
  },
  {
    id: 'pagopar',
    name: 'Pasarela de Cobros (Pagopar / Bancard)',
    provider: 'Pagopar',
    category: 'comisiones',
    role: 'Cobro de Suscripciones y Pagos Online',
    description:
      'Pasarela de cobro que procesa los pagos de las suscripciones de los comercios a la plataforma y habilita el checkout online en las tiendas web (tarjetas de crédito, débito, QR y transferencias SIPAP).',
    typicalPricing: 'Comisión por transacción (~3.5% a 5% + IVA)',
    defaultCurrency: 'PYG',
    defaultAmount: 0,
    defaultRecurrence: 'monthly',
    defaultFxRate: 1,
    icon: CreditCard,
    keyFeatures: [
      'Cobro de planes de suscripción de la plataforma',
      'Procesamiento de tarjetas Visa, Mastercard, Panal',
      'Pagos QR interoperables Bancard y transferencias SIPAP',
      'Webhooks de conciliación automática en tiempo real',
    ],
    websiteUrl: 'https://www.pagopar.com',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    provider: 'Sentry',
    category: 'herramientas',
    role: 'Monitoreo de Errores y Telemetría en Producción',
    description:
      'Supervisión continua en tiempo real de excepciones no capturadas en frontend, backend y app móvil. Alerta al instante ante caídas de servicio o errores que afecten las ventas de los comercios.',
    typicalPricing: 'Gratis (Developer) / USD 26 / mes (Plan Team)',
    defaultCurrency: 'USD',
    defaultAmount: 26,
    defaultRecurrence: 'monthly',
    defaultFxRate: 7500,
    icon: Activity,
    keyFeatures: [
      'Rastreo de errores en Next.js, APIs y React Native',
      'Stack traces detallados con contexto de usuario y sesión',
      'Alertas críticas inmediatas por email / webhook',
      'Métricas de rendimiento y tiempos de respuesta',
    ],
    websiteUrl: 'https://sentry.io',
  },
]
