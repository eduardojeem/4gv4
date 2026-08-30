'use client'

import { createElement, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Loader2, Save, Briefcase, Wrench, Shield, Package, Check, Plus, Trash2,
  Smartphone, Monitor, Battery, Cpu, Zap, Headset, ArrowUp, ArrowDown,
  Clock, Sparkles, Laptop, Edit3, Droplet, Camera,
  Eye, EyeOff, Receipt, Wallet, Landmark, Banknote, CreditCard,
  AlertTriangle, CheckCircle2, Globe, RotateCcw, Search, Download,
  Tag, Timer, ExternalLink, Star, ChevronDown, ChevronUp, Globe2,
  ListTodo, LayoutGrid, Rocket, Lightbulb
} from 'lucide-react'
import { Service, ServicesSectionSettings } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { getActivePublicServices } from '@/lib/website/services'
import { isServiceLikeProduct } from '@/lib/products/is-service-like'
import { formatPrice, cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const ICON_OPTIONS = [
  { value: 'smartphone', label: 'Celular',    icon: Smartphone },
  { value: 'monitor',    label: 'Pantalla',   icon: Monitor    },
  { value: 'battery',    label: 'Batería',    icon: Battery    },
  { value: 'cpu',        label: 'Procesador', icon: Cpu        },
  { value: 'zap',        label: 'Carga',      icon: Zap        },
  { value: 'wrench',     label: 'Reparación', icon: Wrench     },
  { value: 'shield',     label: 'Garantía',   icon: Shield     },
  { value: 'package',    label: 'Insumos',    icon: Package    },
  { value: 'headset',    label: 'Soporte',    icon: Headset    },
  { value: 'laptop',     label: 'Laptop',     icon: Laptop     },
  { value: 'clock',      label: 'Tiempo',     icon: Clock      },
  { value: 'sparkles',   label: 'Especial',   icon: Sparkles   },
  { value: 'droplet',    label: 'Agua',       icon: Droplet    },
  { value: 'camera',     label: 'Cámara',     icon: Camera     },
  { value: 'microchip',  label: 'Chip',       icon: Cpu        },
  { value: 'receipt',    label: 'Facturas',   icon: Receipt    },
  { value: 'wallet',     label: 'Billetera',  icon: Wallet     },
  { value: 'landmark',   label: 'Banco',      icon: Landmark   },
  { value: 'banknote',   label: 'Efectivo',   icon: Banknote   },
  { value: 'credit-card',label: 'Tarjeta',    icon: CreditCard },
]

const COLOR_OPTIONS = [
  { value: 'blue',    label: 'Azul',      bg: 'bg-blue-500',    light: 'bg-blue-50 text-blue-600 border-blue-200'   },
  { value: 'green',   label: 'Verde',     bg: 'bg-green-500',   light: 'bg-green-50 text-green-600 border-green-200' },
  { value: 'purple',  label: 'Púrpura',   bg: 'bg-purple-500',  light: 'bg-purple-50 text-purple-600 border-purple-200' },
  { value: 'orange',  label: 'Naranja',   bg: 'bg-orange-500',  light: 'bg-orange-50 text-orange-600 border-orange-200' },
  { value: 'red',     label: 'Rojo',      bg: 'bg-red-500',     light: 'bg-red-50 text-red-600 border-red-200'      },
  { value: 'indigo',  label: 'Indigo',    bg: 'bg-indigo-500',  light: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  { value: 'teal',    label: 'Teal',      bg: 'bg-teal-500',    light: 'bg-teal-50 text-teal-600 border-teal-200'   },
  { value: 'yellow',  label: 'Amarillo',  bg: 'bg-yellow-400',  light: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  { value: 'cyan',    label: 'Cyan',      bg: 'bg-cyan-500',    light: 'bg-cyan-50 text-cyan-600 border-cyan-200'   },
  { value: 'pink',    label: 'Rosa',      bg: 'bg-pink-500',    light: 'bg-pink-50 text-pink-600 border-pink-200'   },
  { value: 'rose',    label: 'Rose',      bg: 'bg-rose-500',    light: 'bg-rose-50 text-rose-600 border-rose-200'   },
  { value: 'amber',   label: 'Ámbar',     bg: 'bg-amber-500',   light: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'emerald', label: 'Esmeralda', bg: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'sky',     label: 'Cielo',     bg: 'bg-sky-500',     light: 'bg-sky-50 text-sky-600 border-sky-200'      },
]

const CATEGORY_SUGGESTIONS = [
  'Reparaciones',
  'Mantenimiento',
  'Instalaciones',
  'Confección',
  'Belleza & Cuidado',
  'Pagos y servicios',
  'Envíos & Logística',
  'Asesoría técnica',
]

const DURATION_SUGGESTIONS = [
  '30 a 60 min',
  'En el día',
  '24 a 48 hs',
  'En el momento',
  'A coordinar',
]

const PRICE_NOTE_SUGGESTIONS = [
  'Según modelo',
  'Presupuesto sin cargo',
  'Materiales incluidos',
  'Sujeto a diagnóstico',
  'Consultar comisión',
]

const BENEFIT_SUGGESTIONS = [
  'Garantía escrita',
  'Repuestos 100% originales',
  'Diagnóstico rápido',
  'Atención personalizada',
  'Comprobante oficial',
  'Técnicos certificados',
]

export interface PresetServiceItem extends Omit<Service, 'id'> {
  verticalCategory: string
  verticalBadge: string
}

const PRESET_SERVICES: PresetServiceItem[] = [
  // ── Tecnología & Celulares ──
  {
    verticalCategory: 'Tecnología',
    verticalBadge: '📱 Celulares & PC',
    title: 'Cambio de pantalla y display',
    description: 'Reemplazo de módulo y pantalla con repuestos de calidad y calibración.',
    icon: 'monitor',
    color: 'blue',
    benefits: ['Repuestos testeados', 'Garantía escrita de 30 días', 'Calibración táctil'],
    active: true,
    price: 'Desde Gs. 150.000',
    priceNote: 'según modelo',
    duration: '45 a 90 min',
    category: 'Reparaciones',
    featured: true,
    ctaUrl: '/inicio#contacto',
  },
  {
    verticalCategory: 'Tecnología',
    verticalBadge: '📱 Celulares & PC',
    title: 'Cambio de batería',
    description: 'Instalación de batería nueva con máxima salud y ciclos completos.',
    icon: 'battery',
    color: 'emerald',
    benefits: ['Baterías de alta capacidad', 'Garantía escrita', 'Instalación en el día'],
    active: true,
    price: 'Desde Gs. 90.000',
    priceNote: 'según marca',
    duration: '30 a 45 min',
    category: 'Reparaciones',
    ctaUrl: '/inicio#contacto',
  },
  {
    verticalCategory: 'Tecnología',
    verticalBadge: '📱 Celulares & PC',
    title: 'Mantenimiento y limpieza técnica',
    description: 'Limpieza interna, cambio de pasta térmica y optimización de rendimiento.',
    icon: 'cpu',
    color: 'purple',
    benefits: ['Pasta térmica premium', 'Limpieza de placa y disipador', 'Diagnóstico térmico'],
    active: true,
    price: 'Gs. 80.000',
    priceNote: 'precio fijo',
    duration: 'En el día',
    category: 'Mantenimiento',
    ctaUrl: '/inicio#contacto',
  },

  // ── Moda & Confección ──
  {
    verticalCategory: 'Moda',
    verticalBadge: '👗 Ropa & Calzado',
    title: 'Ajustes y dobladillos de prendas',
    description: 'Ajuste de cintura, botamangas, cierres y entalles a medida para tus prendas.',
    icon: 'sparkles',
    color: 'rose',
    benefits: ['Terminaciones prolijas', 'Prueba previa', 'Entrega rápida'],
    active: true,
    price: 'Desde Gs. 30.000',
    priceNote: 'según tipo de prenda',
    duration: '24 a 48 hs',
    category: 'Confección',
    featured: true,
    ctaUrl: '/inicio#contacto',
  },
  {
    verticalCategory: 'Moda',
    verticalBadge: '👗 Ropa & Calzado',
    title: 'Confección y prendas personalizadas',
    description: 'Diseño y confección de prendas exclusivas a pedido con telas a elección.',
    icon: 'package',
    color: 'pink',
    benefits: ['Corte a medida', 'Asesoramiento en diseño', 'Materiales de calidad'],
    active: true,
    price: 'A presupuestar',
    priceNote: 'según diseño',
    duration: '3 a 5 días',
    category: 'Confección',
    ctaUrl: '/inicio#contacto',
  },

  // ── Cosmética & Belleza ──
  {
    verticalCategory: 'Belleza',
    verticalBadge: '💄 Estética & Cuidado',
    title: 'Tratamiento facial y skincare',
    description: 'Limpieza profunda, hidratación y cuidado facial con productos profesionales.',
    icon: 'droplet',
    color: 'pink',
    benefits: ['Productos dermatológicos', 'Evaluación de tipo de piel', 'Resultados inmediatos'],
    active: true,
    price: 'Gs. 120.000',
    priceNote: 'por sesión',
    duration: '60 min',
    category: 'Belleza & Cuidado',
    featured: true,
    ctaUrl: '/inicio#contacto',
  },

  // ── Ferretería & Hogar ──
  {
    verticalCategory: 'Ferretería',
    verticalBadge: '🔨 Hogar & Técnico',
    title: 'Instalaciones y mantenimiento',
    description: 'Servicio técnico especializado para instalaciones eléctricas y del hogar.',
    icon: 'wrench',
    color: 'orange',
    benefits: ['Herramientas profesionales', 'Presupuesto sin cargo', 'Personal calificado'],
    active: true,
    price: 'A convenir',
    priceNote: 'según trabajo',
    duration: 'A coordinar',
    category: 'Instalaciones',
    ctaUrl: '/inicio#contacto',
  },

  // ── Pagos & Servicios Financieros ──
  {
    verticalCategory: 'Financiero',
    verticalBadge: '💳 Pagos & Giros',
    title: 'Pago de facturas y servicios',
    description: 'Cobro de facturas con comprobante oficial para tus clientes (ANDE, ESSAP, Telefonía).',
    icon: 'receipt',
    color: 'emerald',
    benefits: ['ANDE, ESSAP, Tigo, Personal', 'Comprobante al instante', 'Sin filas'],
    active: true,
    price: 'Sin costo adicional',
    priceNote: 'servicio oficial',
    duration: 'En el momento',
    category: 'Pagos y servicios',
    featured: true,
    ctaUrl: '/inicio#contacto',
  },
  {
    verticalCategory: 'Financiero',
    verticalBadge: '💳 Pagos & Giros',
    title: 'Billeteras y giros de dinero',
    description: 'Cargas, retiros y envíos de dinero por billeteras digitales nacionales e internacionales.',
    icon: 'wallet',
    color: 'sky',
    benefits: ['Cargas y retiros', 'Tigo Money, Giros Claro, Zimple', 'Comprobante seguro'],
    active: true,
    price: 'Según operador',
    priceNote: 'comisión estándar',
    duration: 'En el momento',
    category: 'Billeteras digitales',
    ctaUrl: '/inicio#contacto',
  },
]

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function isServiceReady(s: Service) {
  const b = (s.benefits || []).map(x => x.trim()).filter(Boolean)
  return s.title.trim().length >= 3 && s.description.trim().length >= 10 && b.length >= 1 && b.length <= 10
}
function createServiceId(label?: string) {
  return `service-${Date.now()}${label ? `-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : ''}`
}
function getIconComp(value: string) {
  return ICON_OPTIONS.find(o => o.value === value)?.icon ?? Wrench
}
function getColorLight(value: string) {
  return COLOR_OPTIONS.find(o => o.value === value)?.light ?? 'bg-blue-50 text-blue-600 border-blue-200'
}
function getColorBg(value: string) {
  return COLOR_OPTIONS.find(o => o.value === value)?.bg ?? 'bg-blue-500'
}

// ─────────────────────────────────────────────
// ServiceCardPreview — vista previa pública
// ─────────────────────────────────────────────

function ServiceCardPreview({ service }: { service: Service }) {
  const IconComp = getIconComp(service.icon)
  const colorLight = getColorLight(service.color)
  const benefits = (service.benefits || []).map(b => b.trim()).filter(Boolean)
  const ready = isServiceReady(service)

  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', colorLight)}>
            {createElement(IconComp, { className: 'h-5 w-5' })}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5 items-center">
              <p className="text-sm font-bold text-foreground leading-tight">
                {service.title || <span className="italic text-muted-foreground">Sin título</span>}
              </p>
              {service.featured && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Star className="h-2.5 w-2.5" /> Destacado
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {service.description || <span className="italic">Sin descripción</span>}
            </p>
          </div>
        </div>

        {(service.price || service.duration || service.category) && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {service.category && <span className="flex items-center gap-1 text-muted-foreground"><Tag className="h-3 w-3" />{service.category}</span>}
            {service.price && <span className="font-semibold text-foreground">{service.price}{service.priceNote && <span className="font-normal text-muted-foreground"> · {service.priceNote}</span>}</span>}
            {service.duration && <span className="flex items-center gap-1 text-muted-foreground"><Timer className="h-3 w-3" />{service.duration}</span>}
          </div>
        )}

        {benefits.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {benefits.slice(0, 4).map((b, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                <Check className="h-2.5 w-2.5 text-emerald-500" />{b}
              </span>
            ))}
            {benefits.length > 4 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{benefits.length - 4}</span>}
          </div>
        )}

        {service.ctaUrl && (
          <div className="flex items-center gap-1 text-[11px] text-primary">
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{service.ctaUrl}</span>
          </div>
        )}
      </div>

      {!ready && (
        <div className="border-t bg-amber-50/60 px-4 py-2 flex items-center gap-2 text-[11px] text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Completa título, descripción y al menos 1 beneficio
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Tipo para importar del inventario
// ─────────────────────────────────────────────
interface ImportableProduct {
  id: string
  name: string
  description: string | null
  sale_price: number | null
  brand: string | null
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export function ServicesManager() {
  const { settings, isLoading, error, isSaving, updateSetting, updateSettings } = useAdminWebsiteSettings()
  const [servicesDraft, setServicesDraft] = useState<Service[] | null>(null)
  const [sectionDraft, setSectionDraft] = useState<ServicesSectionSettings | null>(null)

  // Modal edición
  const [editOpen, setEditOpen]           = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [editingIndex, setEditingIndex]   = useState<number | null>(null)
  const [isApplying, setIsApplying]       = useState(false)

  // Modal importar
  const [importOpen, setImportOpen]       = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importProducts, setImportProducts] = useState<ImportableProduct[]>([])
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [importSearch, setImportSearch]   = useState('')

  // Servicios de Reparaciones en tiempo real
  const [inventoryServices, setInventoryServices] = useState<Array<{
    id: string
    name: string
    description?: string
    sale_price?: number | null
    brand?: string | null
    category?: string | null
    visibility: 'public' | 'hidden'
    is_active?: boolean
  }>>([])
  const [invFilter, setInvFilter] = useState<'all' | 'public' | 'hidden' | 'available'>('all')
  const [invSearch, setInvSearch] = useState('')
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [showInventorySection, setShowInventorySection] = useState(true)

  // Plantillas expandibles y filtros
  const [presetsOpen, setPresetsOpen]                 = useState(false)
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<string>('all')
  const [showServicesGuide, setShowServicesGuide]     = useState(false)

  // Filtro lista
  const [searchQuery, setSearchQuery]     = useState('')

  // Visibilidad página en borrador (no auto-guardado)
  const [pageEnabledDraft, setPageEnabledDraft] = useState<boolean | null>(null)

  // Scroll al final
  const listEndRef = useRef<HTMLDivElement>(null)

  // Cargar servicios activos del inventario de reparaciones
  useEffect(() => {
    let isMounted = true
    async function loadInvServices() {
      setLoadingInventory(true)
      try {
        let all: any[] = []
        const serviceCatIds = new Set<string>()

        // Intento 1: Cliente directo de Supabase con sesión activa
        try {
          const supabase = createClient()
          const { data: catData } = await supabase
            .from('categories')
            .select('id, name')

          if (catData) {
            catData.forEach(c => {
              const cn = (c.name || '').toLowerCase()
              if (cn.includes('servicio') || cn.includes('mano de obra') || cn.includes('reparaci') || cn.includes('tecnic') || cn.includes('taller')) {
                serviceCatIds.add(c.id)
              }
            })
          }

          const { data: dbProducts, error: dbErr } = await supabase
            .from('products')
            .select('id, sku, name, description, sale_price, unit_measure, is_active, visibility, category_id, category:categories(name)')
            .limit(200)

          if (!dbErr && Array.isArray(dbProducts) && dbProducts.length > 0) {
            all = dbProducts
          }
        } catch {
          // fallback a endpoints API
        }

        // Intento 2: Si no trajo directo, consultar endpoints de API
        if (all.length === 0) {
          let res = await fetch('/api/products?per_page=200&is_active=true')
          if (!res.ok) {
            res = await fetch('/api/products?per_page=200')
          }
          if (res.ok) {
            const body = await res.json()
            all = (body.data?.products ?? body.products ?? []) as Array<any>
          }
        }

        const mappedServices = all
          .map(p => {
            const catName = typeof p.category === 'object' ? p.category?.name : (p.category || '')
            const isCategoryMatch = Boolean(p.category_id && serviceCatIds.has(p.category_id))
            const isServiceLike = isServiceLikeProduct({
              name: p.name,
              sku: p.sku,
              unit_measure: p.unit_measure,
              category: { name: catName }
            }) || isCategoryMatch || (p.unit_measure || '').toLowerCase() === 'servicio'

            return {
              id: p.id,
              name: p.name,
              description: p.description || '',
              sale_price: p.sale_price ?? null,
              brand: p.brand ?? null,
              category: catName || 'Servicio Técnico',
              visibility: (p.visibility === 'hidden' ? 'hidden' : 'public') as 'public' | 'hidden',
              is_active: p.is_active !== false,
              isServiceLike,
            }
          })
          // Mostrar ÚNICAMENTE los ítems de servicios
          .filter(p => p.isServiceLike)

        if (isMounted) {
          setInventoryServices(mappedServices)
        }
      } catch {
        // silent fallback
      } finally {
        if (isMounted) setLoadingInventory(false)
      }
    }
    loadInvServices()
    return () => { isMounted = false }
  }, [])

  const defaults = getWebsiteSettingsDefaults()
  const services      = servicesDraft ?? settings?.services ?? defaults.services
  const savedServices = settings?.services ?? defaults.services
  const sectionText   = sectionDraft ?? settings?.services_section ?? defaults.services_section

  const savedPageEnabled = settings?.company_info?.servicesPageEnabled !== false
  const pageEnabled      = pageEnabledDraft !== null ? pageEnabledDraft : savedPageEnabled

  const hasChanges = servicesDraft !== null || sectionDraft !== null || pageEnabledDraft !== null

  const activeCount       = getActivePublicServices(services).length
  const savedActive       = getActivePublicServices(savedServices).length
  const pagePublished     = savedPageEnabled && savedActive > 0
  const hasUnsavedPublish = (pageEnabled && activeCount > 0 && hasChanges) || (pageEnabledDraft !== null)

  // Filtrado
  const q = searchQuery.toLowerCase()
  const filteredServices = q
    ? services.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
      )
    : services

  // Dirty tracking
  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const scrollToEnd = () => setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 150)

  const handleSaveAll = async () => {
    const invalid = services.find(s => !isServiceReady(s))
    if (invalid) {
      toast.error('Hay servicios incompletos', { description: 'Revisa título (mín. 3 letras), descripción (mín. 10) y al menos 1 beneficio.' })
      return
    }

    const payload: Partial<WebsiteSettings> = {
      services,
      ...(sectionDraft ? { services_section: sectionDraft } : {}),
    }

    if (pageEnabledDraft !== null) {
      payload.company_info = {
        ...(settings?.company_info ?? defaults.company_info),
        servicesPageEnabled: pageEnabledDraft,
      }
    }

    const r = await updateSettings(payload)
    if (r.success) {
      toast.success('Catálogo y visibilidad guardados con éxito')
      setServicesDraft(null)
      setSectionDraft(null)
      setPageEnabledDraft(null)
    } else {
      toast.error(r.error || 'Error al guardar')
    }
  }

  const handleDiscard = () => {
    setServicesDraft(null)
    setSectionDraft(null)
    setPageEnabledDraft(null)
  }

  const handleOpenEdit = (index: number) => {
    const s = services[index]
    if (!s) return
    setEditingService({ ...s, benefits: [...s.benefits] })
    setEditingIndex(index)
    setEditOpen(true)
  }

  const handleOpenAdd = () => {
    if (services.length >= 10) { toast.error('Límite: 10 servicios por catálogo'); return }
    setEditingService({ id: createServiceId(), title: '', description: '', icon: 'wrench', color: 'blue', benefits: [''], active: true })
    setEditingIndex(null)
    setEditOpen(true)
  }

  const handleApplyChanges = async () => {
    if (!editingService || isApplying) return
    setIsApplying(true)
    try {
      const title       = editingService.title.trim()
      const description = editingService.description.trim()
      const benefits    = editingService.benefits.map(b => b.trim()).filter(Boolean)
      if (title.length < 3)                        { toast.error('El título necesita al menos 3 caracteres'); return }
      if (description.length < 10)                 { toast.error('La descripción necesita al menos 10 caracteres'); return }
      if (benefits.length < 1 || benefits.length > 10) { toast.error('Agrega entre 1 y 10 beneficios'); return }

      const normalized: Service = { ...editingService, title, description, benefits }
      const updated = [...services]
      if (editingIndex !== null) updated[editingIndex] = normalized
      else updated.push(normalized)

      setServicesDraft(updated)
      setEditOpen(false)
      setEditingService(null)
      setEditingIndex(null)
      if (editingIndex === null) scrollToEnd()
      toast.success(editingIndex !== null ? 'Servicio actualizado' : 'Servicio agregado', { description: 'Guardá el catálogo para publicar los cambios.' })
    } finally { setIsApplying(false) }
  }

  const handleAddPreset = (preset: Omit<Service, 'id'>) => {
    if (services.length >= 10) { toast.error('Límite: 10 servicios'); return }
    setServicesDraft([...services, { ...preset, id: createServiceId(preset.title), benefits: [...preset.benefits] }])
    scrollToEnd()
    toast.success(`"${preset.title}" agregado`, { description: 'Revisá y guardá para publicar.' })
  }

  const handleOpenPresetForEdit = (preset: typeof PRESET_SERVICES[0]) => {
    if (services.length >= 10) { toast.error('Límite: 10 servicios por catálogo'); return }
    setEditingService({
      id: createServiceId(preset.title),
      title: preset.title,
      description: preset.description,
      category: preset.category,
      price: preset.price,
      priceNote: preset.priceNote,
      duration: preset.duration,
      icon: preset.icon,
      color: preset.color,
      benefits: [...preset.benefits],
      featured: preset.featured,
      active: true,
    })
    setEditingIndex(null)
    setEditOpen(true)
  }

  const handleMove = (index: number, dir: 'up' | 'down') => {
    const ni = dir === 'up' ? index - 1 : index + 1
    if (ni < 0 || ni >= services.length) return
    const u = [...services];
    [u[index], u[ni]] = [u[ni], u[index]]
    setServicesDraft(u)
  }

  const handleDelete = (index: number) => {
    const name = services[index]?.title || `Servicio ${index + 1}`
    if (!confirm(`¿Eliminar "${name}"?`)) return
    setServicesDraft(services.filter((_, i) => i !== index))
    toast.success('Servicio eliminado')
  }

  const handleDeleteAll = () => {
    if (services.length === 0) return
    if (!confirm('¿Estás seguro de que deseas eliminar TODOS los servicios del catálogo?')) return
    setServicesDraft([])
    toast.success('Catálogo vaciado')
  }

  const handleToggleActive = (index: number) => {
    const u = [...services]
    u[index] = { ...u[index], active: !u[index].active }
    setServicesDraft(u)
  }

  const handlePageVisibilityToggle = (enabled: boolean) => {
    setPageEnabledDraft(enabled)
  }

  const [togglingVisibilityId, setTogglingVisibilityId] = useState<string | null>(null)

  const handleToggleProductVisibility = async (productId: string, currentVisibility: 'public' | 'hidden') => {
    const nextVisibility = currentVisibility === 'public' ? 'hidden' : 'public'
    setTogglingVisibilityId(productId)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('products')
        .update({ visibility: nextVisibility })
        .eq('id', productId)

      if (error) {
        const res = await fetch(`/api/products/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: nextVisibility }),
        })
        if (!res.ok) throw error
      }

      setInventoryServices(prev =>
        prev.map(p => (p.id === productId ? { ...p, visibility: nextVisibility } : p))
      )

      toast.success(
        nextVisibility === 'hidden'
          ? 'Servicio ocultado en tienda (estado Interno)'
          : 'Servicio marcado como Público en tienda'
      )
    } catch (e: any) {
      toast.error('No se pudo actualizar la visibilidad en el inventario', { description: e?.message })
    } finally {
      setTogglingVisibilityId(null)
    }
  }

  const handleRemoveFromCatalogByTitle = (title: string) => {
    const updated = services.filter(s => s.title.toLowerCase() !== title.toLowerCase())
    setServicesDraft(updated)
    toast.success(`"${title}" quitado del catálogo web`, {
      description: 'Presioná "Guardar catálogo" abajo para confirmar los cambios.',
    })
  }

  const handleQuickAddFromInventory = (p: { id: string; name: string; description?: string; sale_price?: number | null; category?: string | null; visibility?: string }) => {
    if (services.length >= 10) {
      toast.error('Límite de 10 servicios alcanzado en el catálogo web')
      return
    }
    const already = services.some(s => s.title.toLowerCase() === p.name.toLowerCase())
    if (already) {
      toast.info(`"${p.name}" ya se encuentra en tu catálogo web`)
      return
    }
    const newSvc: Service = {
      id: createServiceId(p.name),
      title: p.name,
      description: p.description || 'Servicio profesional garantizado.',
      icon: 'wrench',
      color: 'blue',
      benefits: ['Presupuesto sin compromiso', 'Garantía del servicio', 'Atención personalizada'],
      active: true,
      price: p.sale_price ? formatPrice(p.sale_price) : undefined,
      category: p.category || 'Servicio Técnico',
      source: 'inventory',
    }
    setServicesDraft([...services, newSvc])
    toast.success(`"${p.name}" añadido al catálogo web`, { description: 'Guardá el catálogo abajo para publicarlo.' })
  }

  // ── Importar del inventario ────────────────────────────────────────────────

  const handleOpenImport = async () => {
    setImportOpen(true)
    setImportLoading(true)
    setSelectedIds(new Set())
    setImportSearch('')
    try {
      const res  = await fetch('/api/products?per_page=100&is_active=true')
      if (!res.ok) throw new Error()
      const body = await res.json()
      const all = (body.data?.products ?? body.products ?? []) as Array<ImportableProduct & {
        unit_measure?: string
        product_type?: string
      }>
      setImportProducts(
        all
          .filter(p => (p.unit_measure || '').toLowerCase() === 'servicio' || p.product_type === 'service')
          .map(p => ({ id: p.id, name: p.name, description: p.description ?? '', sale_price: p.sale_price ?? null, brand: p.brand ?? null }))
      )
    } catch { toast.error('No se pudo cargar el inventario') }
    finally   { setImportLoading(false) }
  }

  const handleConfirmImport = () => {
    if (selectedIds.size === 0) { toast.error('Selecciona al menos uno'); return }
    const available = 10 - services.length
    if (selectedIds.size > available) { toast.error(`Solo podés agregar ${available} más (límite: 10)`); return }
    const existing = new Set(services.map(s => s.title.toLowerCase()))
    const toAdd: Service[] = importProducts
      .filter(p => selectedIds.has(p.id) && !existing.has(p.name.toLowerCase()))
      .map(p => ({
        id: createServiceId(p.name), title: p.name,
        description: p.description || 'Servicio de reparación profesional.',
        icon: 'wrench', color: 'blue',
        benefits: ['Diagnóstico incluido', 'Garantía por el servicio'],
        active: true, price: p.sale_price ? formatPrice(p.sale_price) : undefined, category: 'Reparaciones'
      }))
    if (toAdd.length === 0) { toast.error('Ya existen todos los seleccionados en el catálogo'); return }
    setServicesDraft([...services, ...toAdd])
    setImportOpen(false)
    scrollToEnd()
    toast.success(`${toAdd.length} servicio${toAdd.length > 1 ? 's' : ''} importado${toAdd.length > 1 ? 's' : ''}`, { description: 'Editá los detalles y guardá para publicar.' })
  }

  const filteredImport = importSearch
    ? importProducts.filter(p => p.name.toLowerCase().includes(importSearch.toLowerCase()) || (p.brand || '').toLowerCase().includes(importSearch.toLowerCase()))
    : importProducts

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading && !servicesDraft && !settings) return <div className="p-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (error && !servicesDraft && !settings) return <div className="p-12 text-center text-destructive text-sm">{error}</div>

  // ── Pasos de progreso ──
  const step1Done = services.length > 0
  const step2Done = activeCount > 0
  const step3Done = pagePublished

  return (
    <div className="space-y-8">

      {/* ══════════════════════════════════════════════════════
          GUÍA DESPLEGABLE DE SERVICIOS
      ══════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
        <button
          type="button"
          onClick={() => setShowServicesGuide((prev) => !prev)}
          className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          <span>{showServicesGuide ? 'Ocultar guía de servicios' : '¿Cómo organizar tu catálogo de servicios para atraer más clientes?'}</span>
          {showServicesGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showServicesGuide && (
          <div className="mt-3 text-xs space-y-2 text-muted-foreground border-t border-border/50 pt-3 animate-in fade-in-50 duration-200">
            <p className="font-bold text-foreground">💡 Recomendaciones para tu catálogo de servicios:</p>
            <ul className="space-y-1.5 list-disc list-inside leading-relaxed">
              <li><strong className="text-foreground">Claridad en el título:</strong> Describí exactamente lo que el cliente busca (ej. <em>&quot;Cambio de batería&quot;</em>, <em>&quot;Ajustes de prendas&quot;</em>, <em>&quot;Limpieza facial&quot;</em>).</li>
              <li><strong className="text-foreground">Beneficios destacados:</strong> Indicá tiempo de entrega, repuestos o garantía (ej. <em>&quot;Garantía escrita de 30 días&quot;</em>, <em>&quot;Presupuesto sin cargo&quot;</em>).</li>
              <li><strong className="text-foreground">Botón directo a WhatsApp:</strong> Los clientes pueden consultar en 1 toque directo con el nombre del servicio pre-cargado.</li>
              <li><strong className="text-foreground">Sincronización automática:</strong> Al activar la visualización pública, los servicios aparecen tanto en <code>/servicios</code> como en la sección de inicio.</li>
            </ul>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          BANNER DE ESTADO + PASOS
      ══════════════════════════════════════════════════════ */}
      <div className={cn(
        'rounded-2xl border p-5 transition-colors',
        !pageEnabled
          ? 'border-border bg-muted/30'
          : pagePublished
          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/20'
          : 'border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20'
      )}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Status */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              !pageEnabled
                ? 'bg-muted text-muted-foreground'
                : pagePublished
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
            )}>
              {!pageEnabled ? <Globe2 className="h-5 w-5" /> : pagePublished ? <Rocket className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">
                  {!pageEnabled
                    ? 'Página de servicios desactivada (Oculta)'
                    : pagePublished
                    ? 'Página de servicios publicada y online'
                    : hasUnsavedPublish
                    ? 'Cambios listos para publicar (Guardá para aplicar)'
                    : 'Página activa pero sin servicios visibles'
                  }
                </p>
                {pagePublished && (
                  <span className="flex items-center gap-1 text-[10px] font-bold rounded-full bg-emerald-500 text-white px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    En vivo
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {!pageEnabled
                  ? 'Activa el switch a la derecha para mostrar la página de servicios en tu tienda.'
                  : pagePublished
                  ? `${savedActive} servicio${savedActive > 1 ? 's' : ''} disponible${savedActive > 1 ? 's' : ''} en /servicios e inicio.`
                  : hasUnsavedPublish
                  ? `Tenés ${activeCount} servicio${activeCount > 1 ? 's' : ''} configurado${activeCount > 1 ? 's' : ''}. Presioná "Guardar catálogo" abajo para publicar.`
                  : 'Agregá o activá al menos 1 servicio para que sea visible.'}
              </p>
            </div>
          </div>

          {/* Toggle publicar */}
          <div className="flex items-center gap-3">
            {pagePublished && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 rounded-xl gap-1.5 text-xs font-semibold"
              >
                <a href="/servicios" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver página
                </a>
              </Button>
            )}

            <div className={cn(
              'flex items-center gap-3 rounded-2xl border-2 px-4 py-2 shadow-sm transition-all',
              pageEnabled
                ? 'border-emerald-400 bg-emerald-500/10 dark:border-emerald-700 dark:bg-emerald-950/40'
                : 'border-border bg-background'
            )}>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-extrabold text-foreground">Visualización Pública</p>
                  <span className={cn(
                    'text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full',
                    pageEnabled ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                  )}>
                    {pageEnabled ? 'Online' : 'Oculto'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">En menú, /servicios e inicio</p>
              </div>
              <Switch
                checked={pageEnabled}
                onCheckedChange={handlePageVisibilityToggle}
                disabled={isSaving}
                className="data-[state=checked]:bg-emerald-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Pasos de progreso */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { done: step1Done, num: 1, label: '1. Agrega servicios', sub: `${services.length} cargado${services.length !== 1 ? 's' : ''}`, icon: ListTodo },
            { done: step2Done, num: 2, label: '2. Actívalos',         sub: `${activeCount} activo${activeCount !== 1 ? 's' : ''}`,       icon: Eye },
            { done: step3Done, num: 3, label: '3. Publicación',       sub: step3Done ? 'Publicado ✓' : pageEnabled ? 'Guardá cambios' : 'Activá switch', icon: Globe },
          ].map(({ done, num, label, sub }) => (
            <div key={label} className={cn(
              'flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors',
              done ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-border bg-background'
            )}>
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                done ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : num}
              </div>
              <div className="min-w-0">
                <p className={cn('text-xs font-semibold truncate', done ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>{label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          TARJETAS DE RESUMEN Y SERVICIOS HABILITADOS
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Catálogo</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListTodo className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{services.length}<span className="text-xs text-muted-foreground font-normal"> / 10</span></p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Capacidad del catálogo</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Habilitados Online</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Eye className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{pageEnabled ? 'Visibles en tu web pública' : 'Ocultos por switch general'}</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Destacados</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">{services.filter(s => s.featured).length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Con insignia especial</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Categorías</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutGrid className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{new Set(services.map(s => s.category || 'General')).size}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Grupos organizados</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          TEXTOS Y ENCABEZADO DE LA SECCIÓN PÚBLICA
      ══════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">Encabezado y textos de la sección</h3>
              <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">
                Personalizable
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Personalizá los títulos, etiquetas y llamados a la acción visibles en <code>/servicios</code> y en el inicio.
            </p>
          </div>

          {/* Plantillas Rápidas de Encabezado */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground mr-1">Plantillas rápidas:</span>
            {[
              {
                label: '🛠️ Taller & Reparaciones',
                badge: '🛠️ Soporte & Reparaciones Especializadas',
                title: 'Soluciones y reparaciones especializadas para tus equipos',
                subtitle: 'Diagnóstico profesional, repuestos de calidad y atención rápida con presupuesto directo por WhatsApp.',
              },
              {
                label: '⚡ Servicio Express',
                badge: '⚡ Servicio Express & Garantía',
                title: 'Mantenimiento express y puesta a punto garantizada',
                subtitle: 'Cuidamos tus dispositivos con técnicos certificados y entregas en el menor tiempo posible.',
              },
              {
                label: '⭐ Soluciones Pro',
                badge: '⭐ Servicios Profesionales',
                title: 'Soluciones y servicios profesionales a tu medida',
                subtitle: 'Conocé nuestro catálogo de servicios, compará opciones y pedí presupuesto directo por WhatsApp.',
              },
            ].map((tmpl) => (
              <button
                key={tmpl.label}
                type="button"
                onClick={() => {
                  setSectionDraft({
                    badge: tmpl.badge,
                    title: tmpl.title,
                    subtitle: tmpl.subtitle,
                  })
                  toast.success(`Plantilla "${tmpl.label}" aplicada`, {
                    description: 'Podés ajustar los textos y guardar abajo.',
                  })
                }}
                className="rounded-full border border-primary/25 bg-primary/[0.06] hover:bg-primary/15 text-primary px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Formulario con Sugerencias */}
          <div className="space-y-4">
            {/* 1. Insignia / Etiqueta */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Insignia / Etiqueta superior (Opcional)</Label>
                <span className="text-[10px] text-muted-foreground">Aparece sobre el título</span>
              </div>
              <Input
                value={sectionText.badge || ''}
                onChange={(e) => setSectionDraft({ ...sectionText, badge: e.target.value })}
                placeholder="Ej: 🛠️ Servicios Profesionales"
                className="h-9 text-xs sm:text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10.5px] font-medium text-violet-700 dark:text-violet-300">✨ Sugerencias de etiqueta:</span>
                {[
                  '🛠️ Soporte Técnico Especializado',
                  '⭐ Servicios Profesionales',
                  '⚡ Reparaciones Express',
                  '🛡️ Garantía Escrita',
                  '✨ Calidad & Confianza',
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setSectionDraft({ ...sectionText, badge: sug })}
                    className="inline-flex items-center gap-1 rounded-full border border-violet-200/80 bg-violet-50/70 dark:border-violet-800/40 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 hover:border-violet-300 dark:hover:bg-violet-900/40 text-[10.5px] font-medium px-2.5 py-0.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <span>+</span>
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Título Principal */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Título principal</Label>
                <span className="text-[10px] text-muted-foreground">Encabezado principal</span>
              </div>
              <Input
                value={sectionText.title || ''}
                onChange={(e) => setSectionDraft({ ...sectionText, title: e.target.value })}
                placeholder="Ej: Soluciones y servicios para tu día a día"
                className="h-9 text-xs sm:text-sm font-semibold"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10.5px] font-medium text-sky-700 dark:text-sky-300">💬 Sugerencias de título:</span>
                {[
                  'Soluciones y servicios para tu día a día',
                  'Reparaciones y soporte técnico garantizado',
                  'Servicios especializados para tus dispositivos',
                  'Mantenimiento express y puesta a punto',
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setSectionDraft({ ...sectionText, title: sug })}
                    className="inline-flex items-center gap-1 rounded-full border border-sky-200/80 bg-sky-50/70 dark:border-sky-800/40 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 hover:border-sky-300 dark:hover:bg-sky-900/40 text-[10.5px] font-medium px-2.5 py-0.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <span>+</span>
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Subtítulo Descriptivo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">Subtítulo descriptivo</Label>
                <span className="text-[10px] text-muted-foreground">Llamado a la acción</span>
              </div>
              <Textarea
                value={sectionText.subtitle || ''}
                onChange={(e) => setSectionDraft({ ...sectionText, subtitle: e.target.value })}
                placeholder="Ej: Conocé nuestros servicios, compará opciones y coordiná directamente por WhatsApp."
                className="min-h-[75px] resize-none text-xs sm:text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10.5px] font-medium text-emerald-700 dark:text-emerald-300">📝 Sugerencias de subtítulo:</span>
                {[
                  'Conocé nuestros servicios, compará opciones y coordiná directamente por WhatsApp.',
                  'Diagnóstico profesional, repuestos de calidad y atención rápida por especialistas.',
                  'Consultá precios estimados y solicitá tu presupuesto directo con nuestros técnicos.',
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setSectionDraft({ ...sectionText, subtitle: sug })}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-800/40 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 hover:border-emerald-300 dark:hover:bg-emerald-900/40 text-[10.5px] font-medium px-2.5 py-0.5 transition-all cursor-pointer shadow-2xs text-left truncate max-w-[280px]"
                    title={sug}
                  >
                    <span>+</span>
                    <span className="truncate">{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Vista Previa en Vivo + Tips */}
          <div className="space-y-4">
            {/* Vista Previa en Vivo */}
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase tracking-wider">
                  <Eye className="h-3.5 w-3.5" /> Vista Previa en tu Web
                </span>
                <span className="rounded bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.2">
                  En vivo
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/80 p-4 space-y-2 backdrop-blur-xs">
                {sectionText.badge && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 text-[10px] font-bold">
                    <Sparkles className="h-2.5 w-2.5" />
                    {sectionText.badge}
                  </span>
                )}
                <h4 className="text-sm sm:text-base font-extrabold text-foreground leading-snug">
                  {sectionText.title || 'Título de tus Servicios'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {sectionText.subtitle || 'Subtítulo explicativo y llamado a la acción para contactar por WhatsApp.'}
                </p>

                <div className="pt-2 flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 shadow-2xs flex items-center gap-1">
                    <span>💬 Consultar por WhatsApp</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Botón de contacto</span>
                </div>
              </div>
            </div>

            {/* Caja de Tips & Recomendaciones */}
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <h5 className="text-xs font-bold">Consejos para mayor conversión de clientes:</h5>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1.5 pl-5 list-disc leading-relaxed">
                <li><strong className="text-foreground">Claridad en el título:</strong> Destacá tu propuesta de valor principal (*ej. Reparaciones garantizadas, rapidez, repuestos originales*).</li>
                <li><strong className="text-foreground">Llamado directo a WhatsApp:</strong> Recordarles a los clientes que pueden cotizar en 1 toque directo aumenta un 35% las consultas.</li>
                <li><strong className="text-foreground">Insignias con Emojis:</strong> Usar etiquetas como <code>🛠️</code>, <code>⚡</code> o <code>⭐</code> genera mayor impacto visual.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SERVICIOS E INVENTARIO DE REPARACIONES
      ══════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wrench className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Servicios de tu Inventario de Reparaciones</h3>
                <span className="rounded-full bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5">
                  {loadingInventory ? 'Cargando…' : `${inventoryServices.length} servicios de taller`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sincronizado con <code>/dashboard/repairs/inventory</code> — Visualizá cuáles son públicos y añadilos al catálogo web en 1 clic.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <a href="/dashboard/repairs/inventory" target="_blank" rel="noreferrer">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                <span>Inventario de Reparaciones</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
            <button
              type="button"
              onClick={() => setShowInventorySection(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground p-1 cursor-pointer"
            >
              {showInventorySection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {showInventorySection && (
          <div className="space-y-3 pt-1 animate-in fade-in-50 duration-200">
            {/* Barra de Filtros y Buscador del Inventario */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border/50 pt-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setInvFilter('all')}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                    invFilter === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  Todos los servicios ({inventoryServices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInvFilter('public')}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                    invFilter === 'public'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  🌐 Públicos en Tienda ({inventoryServices.filter(p => p.visibility === 'public').length})
                </button>
                <button
                  type="button"
                  onClick={() => setInvFilter('hidden')}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                    invFilter === 'hidden'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  🔒 Internos / Taller ({inventoryServices.filter(p => p.visibility === 'hidden').length})
                </button>
                <button
                  type="button"
                  onClick={() => setInvFilter('available')}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                    invFilter === 'available'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  ➕ No agregados ({inventoryServices.filter(p => !services.some(s => s.title.toLowerCase() === p.name.toLowerCase())).length})
                </button>
              </div>

              {inventoryServices.length > 4 && (
                <div className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar servicio de taller…"
                    value={invSearch}
                    onChange={e => setInvSearch(e.target.value)}
                    className="h-8 rounded-lg pl-8 text-xs"
                  />
                </div>
              )}
            </div>

            {loadingInventory ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Cargando servicios de reparaciones del taller...</span>
              </div>
            ) : inventoryServices.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center space-y-1.5 bg-muted/20">
                <p className="text-xs font-semibold text-foreground">No tenés servicios registrados en tu inventario de reparaciones</p>
                <p className="text-[11px] text-muted-foreground">
                  Podés crear servicios técnicos o mano de obra desde <a href="/dashboard/repairs/inventory" target="_blank" className="font-bold underline text-primary">Inventario de Reparaciones</a> y aparecerán aquí automáticamente.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 max-h-[360px] overflow-y-auto pr-1">
                {inventoryServices
                  .filter(item => {
                    const matchSearch = !invSearch || item.name.toLowerCase().includes(invSearch.toLowerCase()) || (item.category || '').toLowerCase().includes(invSearch.toLowerCase())
                    const already = services.some(s => s.title.toLowerCase() === item.name.toLowerCase())
                    if (!matchSearch) return false
                    if (invFilter === 'public') return item.visibility === 'public'
                    if (invFilter === 'hidden') return item.visibility === 'hidden'
                    if (invFilter === 'available') return !already
                    return true
                  })
                  .map(item => {
                    const alreadyInCatalog = services.some(s => s.title.toLowerCase() === item.name.toLowerCase())
                    const isPublicVisibility = item.visibility === 'public'

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex flex-col justify-between gap-2.5 rounded-xl border p-3.5 transition-colors',
                          alreadyInCatalog
                            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                            : 'border-border/70 bg-background hover:border-primary/40'
                        )}
                      >
                        <div className="min-w-0">
                          {/* Badges de Categoría y Visibilidad */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-bold text-muted-foreground truncate max-w-[110px]">
                              {item.category || 'Servicio Técnico'}
                            </span>
                            {isPublicVisibility ? (
                              <span className="flex items-center gap-0.5 rounded-full border border-emerald-300/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.2 text-[9px] font-bold">
                                <Globe className="h-2.5 w-2.5" /> Público
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 rounded-full border border-amber-300/50 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.2 text-[9px] font-bold">
                                <EyeOff className="h-2.5 w-2.5" /> Interno / Oculto
                              </span>
                            )}
                            {alreadyInCatalog && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 ml-auto">
                                <Check className="h-3 w-3" /> En catálogo
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-bold text-foreground truncate mt-2">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                            {item.sale_price ? formatPrice(item.sale_price) : 'Precio a convenir'}
                          </p>
                        </div>

                        {/* Botones de acción: Ocultar / Publicar en Web y Cambiar Visibilidad en Tienda */}
                        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleProductVisibility(item.id, item.visibility)}
                            disabled={togglingVisibilityId === item.id}
                            title={isPublicVisibility ? 'Ocultar servicio en tienda/inventario' : 'Hacer público en tienda/inventario'}
                            className={cn(
                              'flex items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer px-2 py-1 rounded-md border',
                              isPublicVisibility
                                ? 'border-border/60 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                : 'border-emerald-300/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100'
                            )}
                          >
                            {togglingVisibilityId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isPublicVisibility ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Globe className="h-3 w-3" />
                            )}
                            <span>{isPublicVisibility ? 'Ocultar en tienda' : 'Hacer público'}</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {alreadyInCatalog ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveFromCatalogByTitle(item.name)}
                                className="h-7 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 border-rose-200 dark:border-rose-900/40 cursor-pointer"
                                title="Ocultar/Quitar este servicio del catálogo web"
                              >
                                <EyeOff className="h-3 w-3" />
                                <span>Ocultar de web</span>
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleQuickAddFromInventory(item)}
                                disabled={services.length >= 10}
                                className="h-7 rounded-lg text-xs font-semibold shrink-0 gap-1 border-primary/40 hover:bg-primary hover:text-primary-foreground cursor-pointer shadow-2xs"
                              >
                                <Globe className="h-3 w-3 text-primary group-hover:text-primary-foreground" />
                                <span>Publicar en Web</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          BARRA DE ACCIONES
      ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Búsqueda */}
        {services.length >= 3 && (
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar servicio por nombre o categoría…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 rounded-xl pl-9"
            />
          </div>
        )}
        <div className="flex gap-2 sm:ml-auto flex-wrap">
          {services.length > 0 && (
            <Button variant="outline" onClick={handleDeleteAll} className="h-9 rounded-xl gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/30">
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Vaciar</span>
            </Button>
          )}
          <Button variant="outline" onClick={handleOpenImport} className="h-9 rounded-xl gap-2 text-sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setPresetsOpen(v => !v)}
            className="h-9 rounded-xl gap-2 text-sm"
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Plantillas</span>
            {presetsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button onClick={handleOpenAdd} disabled={services.length >= 10} className="h-9 rounded-xl gap-2 text-sm">
            <Plus className="h-4 w-4" />
            Nuevo servicio
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          PLANTILLAS MULTIRUBRO (colapsables con filtros)
      ══════════════════════════════════════════════════════ */}
      {presetsOpen && (
        <div className="rounded-2xl border bg-muted/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-foreground">Plantillas de servicios por rubro</p>
              <p className="text-xs text-muted-foreground">
                Hacé 1 clic para agregar un servicio editable a tu catálogo.
              </p>
            </div>

            {/* Filtros de Categoría de Plantillas */}
            <div className="flex flex-wrap gap-1">
              {['all', 'Tecnología', 'Moda', 'Belleza', 'Ferretería', 'Financiero'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPresetCategoryFilter(cat)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                    presetCategoryFilter === cat
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60'
                  )}
                >
                  {cat === 'all' ? 'Todas' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {PRESET_SERVICES
              .filter(p => presetCategoryFilter === 'all' || p.verticalCategory === presetCategoryFilter)
              .map(preset => {
              const IconComp = getIconComp(preset.icon)
              const already = services.some(s => s.title.toLowerCase() === preset.title.toLowerCase())
              return (
                <div
                  key={preset.title}
                  className={cn(
                    'flex flex-col justify-between rounded-xl border p-3 transition-all',
                    already
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                      : 'border-border bg-background hover:border-primary/40 shadow-2xs'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border mt-0.5', getColorLight(preset.color))}>
                      <IconComp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-bold text-muted-foreground">{preset.verticalBadge}</span>
                        {preset.featured && <span className="text-[9px] font-bold text-amber-600">★ Popular</span>}
                        {already && <span className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><Check className="h-3 w-3" /> En catálogo</span>}
                      </div>
                      <p className="text-xs font-bold text-foreground truncate mt-1">{preset.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{preset.description}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{preset.price}</span>
                        <span>·</span>
                        <span>{preset.duration}</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de la plantilla */}
                  {!already && (
                    <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/50">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => handleOpenPresetForEdit(preset)}
                        disabled={services.length >= 10}
                        className="h-7 flex-1 rounded-lg text-xs font-semibold gap-1 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Editar antes de guardar</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddPreset(preset)}
                        disabled={services.length >= 10}
                        className="h-7 rounded-lg text-xs font-semibold px-2 cursor-pointer hover:bg-primary/10"
                        title="Añadir directo sin editar"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          LISTA DE SERVICIOS
      ══════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        {/* Empty state */}
        {services.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Briefcase className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Sin servicios en el catálogo</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                Crea tu primer servicio, importá desde el inventario de reparaciones, o usá una plantilla.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button onClick={handleOpenAdd} className="h-9 rounded-xl gap-2">
                <Plus className="h-4 w-4" />Nuevo servicio
              </Button>
              <Button variant="outline" onClick={handleOpenImport} className="h-9 rounded-xl gap-2">
                <Download className="h-4 w-4" />Importar del inventario
              </Button>
              <Button variant="outline" onClick={() => setPresetsOpen(true)} className="h-9 rounded-xl gap-2">
                <LayoutGrid className="h-4 w-4" />Usar plantilla
              </Button>
            </div>
          </div>
        ) : filteredServices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin resultados para &quot;<span className="font-medium">{searchQuery}</span>&quot;
          </p>
        ) : (
          filteredServices.map(service => {
            const index       = services.indexOf(service)
            const IconComp    = getIconComp(service.icon)
            const colorLight  = getColorLight(service.color)
            const colorBg     = getColorBg(service.color)
            const isActive    = service.active !== false
            const isReady     = isServiceReady(service)
            const benefits    = (service.benefits || []).filter(Boolean)

            return (
              <div
                key={service.id}
                className={cn(
                  'group relative rounded-2xl border bg-background shadow-sm transition-all duration-200',
                  !isActive && 'opacity-60',
                  'hover:shadow-md hover:border-primary/20'
                )}
              >
                {/* Franja de color superior */}
                <div className={cn('h-1 w-full rounded-t-2xl', colorBg)} />

                <div className="p-4">
                  {/* Fila superior: icono + info + acciones */}
                  <div className="flex items-start gap-3">
                    {/* Icono */}
                    <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border', colorLight)}>
                      <IconComp className="h-6 w-6" />
                    </div>

                    {/* Título y descripción */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-bold text-foreground leading-tight break-words">
                          {service.title || <span className="italic text-muted-foreground">Sin título</span>}
                        </h3>
                        {/* Badges con íconos (R8) */}
                        <span className={cn(
                          'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                          isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                            : 'border-border bg-muted text-muted-foreground'
                        )}>
                          {isActive ? <><CheckCircle2 className="h-2.5 w-2.5" />Activo</> : <><EyeOff className="h-2.5 w-2.5" />Oculto</>}
                        </span>
                        {!isReady && (
                          <span className="flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <AlertTriangle className="h-2.5 w-2.5" />Incompleto
                          </span>
                        )}
                        {service.featured && (
                          <span className="flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <Star className="h-2.5 w-2.5" />Destacado
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {service.description || 'Sin descripción'}
                      </p>
                    </div>

                    {/* Controles de posición (R6: alineados) */}
                    <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        title="Subir"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === services.length - 1}
                        title="Bajar"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Meta: categoría, precio, duración */}
                  {(service.category || service.price || service.duration) && (
                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground pl-15">
                      {service.category && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{service.category}</span>}
                      {service.price && <span className="font-medium text-foreground">{service.price}</span>}
                      {service.duration && <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{service.duration}</span>}
                    </div>
                  )}

                  {/* Beneficios como chips */}
                  {benefits.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {benefits.slice(0, 4).map((b, i) => (
                        <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                          <Check className="h-2.5 w-2.5 text-emerald-500" />{b}
                        </span>
                      ))}
                      {benefits.length > 4 && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                          +{benefits.length - 4} más
                        </span>
                      )}
                    </div>
                  )}

                  {/* Barra inferior de acciones */}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                    {/* Visible al público */}
                    <label className="flex cursor-pointer items-center gap-2 select-none">
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleToggleActive(index)}
                        className="scale-90"
                      />
                      <span className="text-xs text-muted-foreground">
                        {isActive ? 'Visible al público' : 'Oculto al público'}
                      </span>
                    </label>

                    {/* Acciones */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground mr-1">#{index + 1}</span>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(index)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="h-8 rounded-xl gap-1.5 text-xs"
                        onClick={() => handleOpenEdit(index)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* Anchor scroll (R4) */}
        <div ref={listEndRef} aria-hidden="true" />
      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL EDICIÓN (R5: con preview inline)
      ══════════════════════════════════════════════════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl p-0 shadow-2xl sm:w-[95vw] md:max-w-5xl">
          {/* Header modal */}
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-14">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {editingIndex !== null ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {editingIndex !== null ? 'Editar servicio' : 'Nuevo servicio'}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Los campos con * son obligatorios para poder guardar.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editingService && (
            <>
              <div className="min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-[1fr_290px]">

                {/* Formulario */}
                <div className="min-h-0 overflow-y-auto px-6 py-5 space-y-6">

                  {/* Publicación */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={cn(
                      'flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors',
                      editingService.active !== false ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-border'
                    )}>
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {editingService.active !== false ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                          Visible al público
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">Se muestra al guardar el catálogo</span>
                      </span>
                      <Switch
                        checked={editingService.active !== false}
                        onCheckedChange={v => setEditingService({ ...editingService, active: v })}
                      />
                    </label>
                    <label className={cn(
                      'flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors',
                      editingService.featured ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20' : 'border-border'
                    )}>
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className={cn('h-4 w-4', editingService.featured ? 'text-amber-500' : 'text-muted-foreground')} />
                          Destacado
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">Se resalta sobre los demás</span>
                      </span>
                      <Switch
                        checked={!!editingService.featured}
                        onCheckedChange={v => setEditingService({ ...editingService, featured: v })}
                      />
                    </label>
                  </div>

                  {/* Selector de Plantilla Rápida para rellenar en 1 toque */}
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Autocompletar con plantilla sugerida:</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">1 toque rellena todo</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {PRESET_SERVICES.map(p => (
                        <button
                          key={p.title}
                          type="button"
                          onClick={() => {
                            setEditingService({
                              ...editingService,
                              title: p.title,
                              description: p.description,
                              category: p.category,
                              price: p.price,
                              priceNote: p.priceNote,
                              duration: p.duration,
                              icon: p.icon,
                              color: p.color,
                              benefits: [...p.benefits],
                              featured: p.featured,
                            })
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:border-primary hover:bg-primary/10 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span className="text-[9px] rounded bg-muted px-1 py-0.2">{p.verticalBadge}</span>
                          <span className="truncate max-w-[160px]">{p.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Información principal */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="svc-title" className="text-sm font-semibold">Título *</Label>
                        <span className="text-[11px] text-muted-foreground">{editingService.title.length}/100</span>
                      </div>
                      <Input
                        id="svc-title"
                        value={editingService.title}
                        onChange={e => setEditingService({ ...editingService, title: e.target.value })}
                        placeholder="Ej: Cambio de pantalla"
                        maxLength={100}
                        className="rounded-xl"
                        autoFocus
                      />
                      {/* Chips sugerencias de Título */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {['Cambio de Pantalla', 'Cambio de Batería', 'Mantenimiento & Limpieza', 'Ajuste de Prenda', 'Tratamiento Facial', 'Instalación Técnica'].map(sug => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setEditingService({ ...editingService, title: sug })}
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer',
                              editingService.title === sug ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border/60 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="svc-desc" className="text-sm font-semibold">Descripción para el cliente *</Label>
                        <span className="text-[11px] text-muted-foreground">{editingService.description.length}/500</span>
                      </div>
                      <Textarea
                        id="svc-desc"
                        value={editingService.description}
                        onChange={e => setEditingService({ ...editingService, description: e.target.value })}
                        placeholder="Explica qué incluye el servicio, quién puede pedirlo y qué esperar."
                        maxLength={500}
                        className="min-h-[88px] resize-y rounded-xl text-sm"
                      />
                      {/* Chips sugerencias de Descripción */}
                      <div className="flex flex-col gap-1 pt-1">
                        {[
                          'Diagnóstico exhaustivo, reemplazo con repuestos de calidad y prueba de funcionamiento.',
                          'Atención rápida y profesional con garantía escrita de satisfacción.',
                          'Ajustes precisos y personalizados según la necesidad del cliente.',
                        ].map((descSug, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setEditingService({ ...editingService, description: descSug })}
                            className="text-[10px] px-2 py-1 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 text-left truncate cursor-pointer"
                          >
                            💡 {descSug}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Categoría</Label>
                        <Input
                          value={editingService.category || ''}
                          onChange={e => setEditingService({ ...editingService, category: e.target.value })}
                          placeholder="Ej: Reparaciones"
                          maxLength={80}
                          className="rounded-xl"
                        />
                        {/* Chips Categoría */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {CATEGORY_SUGGESTIONS.slice(0, 4).map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setEditingService({ ...editingService, category: cat })}
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer',
                                editingService.category === cat ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border/60 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Precio (texto)</Label>
                        <Input
                          value={editingService.price?.toString() || ''}
                          onChange={e => setEditingService({ ...editingService, price: e.target.value })}
                          placeholder="Desde Gs. 150.000"
                          maxLength={60}
                          className="rounded-xl"
                        />
                        <div className="flex flex-wrap gap-1 pt-1">
                          {['A convenir', 'Desde Gs. 50.000', 'Sin costo adicional'].map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setEditingService({ ...editingService, price: p })}
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer',
                                editingService.price === p ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border/60 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Duración estimada</Label>
                        <Input
                          value={editingService.duration || ''}
                          onChange={e => setEditingService({ ...editingService, duration: e.target.value })}
                          placeholder="30 a 60 min"
                          maxLength={60}
                          className="rounded-xl"
                        />
                        {/* Chips Duración */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {DURATION_SUGGESTIONS.slice(0, 3).map(dur => (
                            <button
                              key={dur}
                              type="button"
                              onClick={() => setEditingService({ ...editingService, duration: dur })}
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer',
                                editingService.duration === dur ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border/60 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {dur}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Nota del precio</Label>
                        <Input
                          value={editingService.priceNote || ''}
                          onChange={e => setEditingService({ ...editingService, priceNote: e.target.value })}
                          placeholder="Según modelo"
                          maxLength={60}
                          className="rounded-xl"
                        />
                        {/* Chips Nota Precio */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {PRICE_NOTE_SUGGESTIONS.slice(0, 3).map(note => (
                            <button
                              key={note}
                              type="button"
                              onClick={() => setEditingService({ ...editingService, priceNote: note })}
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer',
                                editingService.priceNote === note ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border/60 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {note}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Enlace de consulta (Opcional)</Label>
                        <Input
                          value={editingService.ctaUrl || ''}
                          onChange={e => setEditingService({ ...editingService, ctaUrl: e.target.value })}
                          placeholder="/inicio#contacto"
                          maxLength={200}
                          className="rounded-xl"
                        />
                        <p className="text-[10px] text-muted-foreground pt-1">Si lo dejás vacío, abre WhatsApp directo con el mensaje del servicio.</p>
                      </div>
                    </div>
                  </div>

                  {/* Beneficios */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Beneficios y Garantías *</p>
                        <p className="text-[11px] text-muted-foreground">Entre 1 y 10 razones que transmiten confianza al cliente</p>
                      </div>
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => setEditingService({ ...editingService, benefits: [...editingService.benefits, ''] })}
                        disabled={editingService.benefits.length >= 10}
                        className="h-8 rounded-xl gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />Agregar
                      </Button>
                    </div>

                    {/* Chips rápidos para insertar beneficios */}
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sugerencias con 1 toque:</p>
                      <div className="flex flex-wrap gap-1">
                        {BENEFIT_SUGGESTIONS.map(sug => {
                          const hasIt = editingService.benefits.includes(sug)
                          return (
                            <button
                              key={sug}
                              type="button"
                              disabled={hasIt || editingService.benefits.length >= 10}
                              onClick={() => {
                                const emptyIdx = editingService.benefits.findIndex(b => !b.trim())
                                if (emptyIdx !== -1) {
                                  const nb = [...editingService.benefits]
                                  nb[emptyIdx] = sug
                                  setEditingService({ ...editingService, benefits: nb })
                                } else {
                                  setEditingService({ ...editingService, benefits: [...editingService.benefits, sug] })
                                }
                              }}
                              className={cn(
                                'text-[11px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer',
                                hasIt
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 opacity-60 cursor-not-allowed'
                                  : 'bg-background text-foreground border-border/70 hover:border-primary/40 hover:bg-primary/5'
                              )}
                            >
                              + {sug}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {editingService.benefits.map((b, bi) => (
                        <div key={bi} className="flex gap-2">
                          <div className="relative flex-1">
                            <Check className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-emerald-500" />
                            <Input
                              value={b}
                              onChange={e => {
                                const nb = [...editingService.benefits]
                                nb[bi] = e.target.value
                                setEditingService({ ...editingService, benefits: nb })
                              }}
                              maxLength={200}
                              className="rounded-xl pl-9"
                              placeholder={`Beneficio ${bi + 1}`}
                              aria-label={`Beneficio ${bi + 1}`}
                            />
                          </div>
                          <Button
                            type="button" variant="ghost" size="icon"
                            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive"
                            disabled={editingService.benefits.length <= 1}
                            onClick={() => setEditingService({ ...editingService, benefits: editingService.benefits.filter((_, i) => i !== bi) })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Apariencia */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Apariencia</p>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Icono</Label>
                        <div className="grid grid-cols-10 gap-1.5">
                          {ICON_OPTIONS.map(opt => {
                            const Icon = opt.icon
                            const sel = editingService.icon === opt.value
                            return (
                              <button
                                key={opt.value} type="button"
                                onClick={() => setEditingService({ ...editingService, icon: opt.value })}
                                className={cn(
                                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-all',
                                  sel ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                                )}
                                title={opt.label} aria-pressed={sel}
                              >
                                <Icon className="h-4 w-4" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Color</Label>
                        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-2">
                          {COLOR_OPTIONS.map(opt => {
                            const sel = editingService.color === opt.value
                            return (
                              <button
                                key={opt.value} type="button"
                                onClick={() => setEditingService({ ...editingService, color: opt.value })}
                                className={cn(
                                  'flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
                                  opt.light,
                                  sel ? 'ring-2 ring-primary ring-offset-2 opacity-100' : 'opacity-50 hover:opacity-100'
                                )}
                                title={opt.label} aria-pressed={sel}
                              >
                                {sel && <Check className="h-3 w-3" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vista previa (R5) */}
                <div className="hidden md:flex flex-col border-l bg-muted/20">
                  <div className="shrink-0 border-b bg-background/60 px-4 py-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Vista previa pública</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <ServiceCardPreview service={editingService} />
                  </div>
                </div>
              </div>

              <DialogFooter className="shrink-0 border-t bg-background/80 px-6 py-3 gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button
                  onClick={handleApplyChanges}
                  disabled={isApplying}
                  className="rounded-xl min-w-[140px] gap-2"
                >
                  {isApplying
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Aplicando…</>
                    : <><Check className="h-4 w-4" />{editingIndex !== null ? 'Guardar cambios' : 'Agregar servicio'}</>
                  }
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════
          MODAL IMPORTAR (R1)
      ══════════════════════════════════════════════════════ */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="flex max-h-[80vh] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl p-0 shadow-2xl sm:w-[95vw] md:max-w-xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-14">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Importar desde Inventario</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Servicios del inventario de reparaciones con <code className="rounded bg-muted px-1 text-[10px]">unidad=servicio</code>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {importLoading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : importProducts.length === 0 ? (
              <div className="py-14 text-center space-y-3">
                <Wrench className="mx-auto h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">Sin servicios para importar</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Crea servicios en <strong>/dashboard/repairs/inventory</strong> con unidad &quot;servicio&quot;.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar…"
                    value={importSearch}
                    onChange={e => setImportSearch(e.target.value)}
                    className="rounded-xl pl-9"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
                  <button
                    type="button"
                    className="text-primary hover:underline font-medium"
                    onClick={() => {
                      if (selectedIds.size === filteredImport.length) setSelectedIds(new Set())
                      else setSelectedIds(new Set(filteredImport.map(p => p.id)))
                    }}
                  >
                    {selectedIds.size === filteredImport.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                </div>

                <div className="space-y-2">
                  {filteredImport.map(p => {
                    const checked = selectedIds.has(p.id)
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all select-none',
                          checked ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-muted/40'
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={v => {
                            const n = new Set(selectedIds)
                            if (v) n.add(p.id)
                            else n.delete(p.id)
                            setSelectedIds(n)
                          }}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{p.name}</p>
                          {p.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>}
                          <div className="flex gap-2 mt-1 text-[11px] text-muted-foreground">
                            {p.brand && <span>{p.brand}</span>}
                            {p.sale_price && <span className="font-medium text-foreground">{formatPrice(p.sale_price)}</span>}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t bg-background/80 px-6 py-3 gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importLoading || selectedIds.size === 0}
              className="rounded-xl gap-2 min-w-[140px]"
            >
              <Download className="h-4 w-4" />
              Importar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════
          FOOTER STICKY: GUARDAR / DESCARTAR
      ══════════════════════════════════════════════════════ */}
      <div className="sticky bottom-0 z-30 -mx-2 border-t bg-background/95 px-2 py-3 backdrop-blur sm:-mx-4 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full transition-colors', hasChanges ? 'bg-amber-400' : 'bg-emerald-500')} />
            {hasChanges
              ? <span>Tienes <strong>{services.length - (savedServices.length)}</strong> cambio{Math.abs(services.length - savedServices.length) !== 1 ? 's' : ''} sin guardar</span>
              : <span>El catálogo está guardado y actualizado</span>
            }
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDiscard} disabled={!hasChanges || isSaving} className="rounded-xl gap-2 cursor-pointer">
              <RotateCcw className="h-4 w-4" />Descartar
            </Button>
            <Button onClick={handleSaveAll} disabled={!hasChanges || isSaving} className="rounded-xl gap-2 min-w-[140px] cursor-pointer">
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</>
                : <><Save className="h-4 w-4" />Guardar catálogo</>
              }
            </Button>
          </div>
        </div>
      </div>

    </div>
  )
}
