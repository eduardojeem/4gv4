'use client'

import { useEffect, useRef, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Save, Briefcase, Wrench, Shield, Package, Check, Plus, Trash2,
  Smartphone, Monitor, Battery, Cpu, Zap, Headset, ArrowUp, ArrowDown,
  Clock, Sparkles, Laptop, Edit3, Droplet, Camera,
  Eye, EyeOff, Receipt, Wallet, Landmark, Banknote, CreditCard,
  AlertTriangle, CheckCircle2, Globe, RotateCcw, Search, Download,
  Tag, Timer, ExternalLink, Star, ChevronDown, ChevronUp, Globe2,
  ListTodo, LayoutGrid, Rocket
} from 'lucide-react'
import { Service } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { getActivePublicServices } from '@/lib/website/services'
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

const FINANCIAL_PRESETS: Array<Omit<Service, 'id'>> = [
  { title:'Pago de facturas', description:'Cobro de facturas con comprobante para tus clientes.', icon:'receipt', color:'emerald', benefits:['Tigo','Personal','ANDE','ESSAP'], active:true, price:'Consultar comision', priceNote:'segun operacion', duration:'En el momento', category:'Pagos y servicios', featured:true, ctaUrl:'/inicio#contacto' },
  { title:'Tigo Money y billeteras', description:'Operaciones de billetera digital segun disponibilidad.', icon:'wallet', color:'sky', benefits:['Envios','Retiros','Cargas','Pagos'], active:true, price:'Segun operacion', priceNote:'consultar condiciones', duration:'En el momento', category:'Billeteras digitales', ctaUrl:'/inicio#contacto' },
  { title:'Depositos bancarios', description:'Recepcion de depositos con confirmacion por comprobante.', icon:'landmark', color:'blue', benefits:['Depositos a cuentas','Comprobante','Atencion en local'], active:true, price:'Consultar comision', priceNote:'segun banco', duration:'En el momento', category:'Operaciones bancarias', ctaUrl:'/inicio#contacto' },
  { title:'Western Union', description:'Envio y retiro de dinero por Western Union.', icon:'banknote', color:'yellow', benefits:['Envios internacionales','Retiros de dinero','Atencion en local'], active:true, price:'Consultar comision', priceNote:'segun operacion', duration:'En el momento', category:'Giros internacionales', featured:true, ctaUrl:'/inicio#contacto' },
  { title:'Giros nacionales', description:'Envio y retiro de dinero dentro del pais.', icon:'banknote', color:'green', benefits:['Envios nacionales','Retiros','Comprobante de operacion'], active:true, price:'Consultar comision', priceNote:'segun operador', duration:'En el momento', category:'Giros y transferencias', ctaUrl:'/inicio#contacto' },
  { title:'Recargas y paquetes', description:'Carga de saldo y activacion de paquetes.', icon:'zap', color:'cyan', benefits:['Recarga de saldo','Paquetes de internet','Confirmacion inmediata'], active:true, price:'Segun recarga', priceNote:'consultar operadoras', duration:'En el momento', category:'Telefonia', ctaUrl:'/inicio#contacto' },
  { title:'Cobro de cuotas', description:'Recepcion de pagos de cuotas para entidades habilitadas.', icon:'credit-card', color:'purple', benefits:['Pago de cuotas','Comprobante','Consulta de disponibilidad'], active:true, price:'Consultar comision', priceNote:'segun entidad', duration:'En el momento', category:'Cobranzas', ctaUrl:'/inicio#contacto' },
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
            <IconComp className="h-5 w-5" />
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
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [servicesDraft, setServicesDraft] = useState<Service[] | null>(null)

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

  // Plantillas expandibles
  const [presetsOpen, setPresetsOpen]     = useState(false)

  // Filtro lista
  const [searchQuery, setSearchQuery]     = useState('')

  // Visibilidad página
  const [updatingVis, setUpdatingVis]     = useState(false)

  // Scroll al final
  const listEndRef = useRef<HTMLDivElement>(null)

  const defaults = getWebsiteSettingsDefaults()
  const services      = servicesDraft ?? settings?.services ?? defaults.services
  const savedServices = settings?.services ?? defaults.services
  const hasChanges    = servicesDraft !== null

  const activeCount    = getActivePublicServices(services).length
  const savedActive    = getActivePublicServices(savedServices).length
  const hiddenCount    = services.length - activeCount
  const readyCount     = services.filter(isServiceReady).length
  const pageEnabled    = settings?.company_info?.servicesPageEnabled !== false
  const pagePublished  = pageEnabled && savedActive > 0

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
    const r = await updateSetting('services', services)
    if (r.success) { toast.success('Catálogo guardado'); setServicesDraft(null) }
    else toast.error(r.error || 'Error al guardar')
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

  const handlePageVisibility = async (enabled: boolean) => {
    setUpdatingVis(true)
    const r = await updateSetting('company_info', { ...(settings?.company_info ?? defaults.company_info), servicesPageEnabled: enabled })
    setUpdatingVis(false)
    if (r.success) toast.success(enabled ? '¡Página de servicios publicada!' : 'Página ocultada')
    else toast.error('No se pudo actualizar', { description: r.error })
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
      const all: any[] = body.data?.products ?? body.products ?? []
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
          BANNER DE ESTADO + PASOS
      ══════════════════════════════════════════════════════ */}
      <div className={cn(
        'rounded-2xl border p-5 transition-colors',
        pagePublished
          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/20'
          : 'border-border bg-muted/30'
      )}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Status */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              pagePublished ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
            )}>
              {pagePublished ? <Rocket className="h-5 w-5" /> : <Globe2 className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-bold">
                {pagePublished ? 'Página de servicios publicada' : 'Página de servicios no publicada'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pagePublished
                  ? `${savedActive} servicio${savedActive > 1 ? 's' : ''} visible${savedActive > 1 ? 's' : ''} en tu sitio web público`
                  : 'Completa los pasos a continuación para publicar'}
              </p>
            </div>
          </div>

          {/* Toggle publicar */}
          <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-2.5 shadow-sm">
            <div>
              <p className="text-xs font-semibold">Mostrar en la web</p>
              <p className="text-[11px] text-muted-foreground">Se guarda al instante</p>
            </div>
            {updatingVis
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Switch checked={pageEnabled} onCheckedChange={handlePageVisibility} disabled={isSaving} />
            }
          </div>
        </div>

        {/* Pasos de progreso */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { done: step1Done, num: 1, label: 'Agrega servicios', sub: `${services.length} cargado${services.length !== 1 ? 's' : ''}`, icon: ListTodo },
            { done: step2Done, num: 2, label: 'Actívalos',         sub: `${activeCount} activo${activeCount !== 1 ? 's' : ''}`,       icon: Eye },
            { done: step3Done, num: 3, label: 'Publica la página', sub: step3Done ? 'Online ✓' : 'Activa el switch →',                  icon: Globe },
          ].map(({ done, num, label, sub, icon: Icon }) => (
            <div key={num} className={cn(
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

        {/* Alertas contextuales */}
        {pageEnabled && activeCount === 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            La página está activa pero sin servicios visibles. Activa al menos uno.
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
              placeholder="Buscar servicio…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 rounded-xl pl-9"
            />
          </div>
        )}
        <div className="flex gap-2 sm:ml-auto">
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
            <span className="hidden sm:inline">Plantillas</span>
            {presetsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button onClick={handleOpenAdd} disabled={services.length >= 10} className="h-9 rounded-xl gap-2 text-sm">
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          PLANTILLAS FINANCIERAS (colapsables)
      ══════════════════════════════════════════════════════ */}
      {presetsOpen && (
        <div className="rounded-2xl border bg-muted/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <p className="text-sm font-semibold">Plantillas de pagos y operaciones</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Un clic para agregar una base editable. Confirmá datos antes de publicar.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {FINANCIAL_PRESETS.map(preset => {
              const IconComp = getIconComp(preset.icon)
              const already = services.some(s => s.title.toLowerCase() === preset.title.toLowerCase())
              return (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => handleAddPreset(preset)}
                  disabled={services.length >= 10 || already}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all',
                    already
                      ? 'border-emerald-200 bg-emerald-50/50 opacity-60 cursor-not-allowed dark:border-emerald-800 dark:bg-emerald-950/20'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]'
                  )}
                >
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', getColorLight(preset.color))}>
                    <IconComp className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{preset.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{preset.category}</p>
                  </div>
                  {already && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                </button>
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
            Sin resultados para "<span className="font-medium">{searchQuery}</span>"
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
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Enlace de consulta</Label>
                        <Input
                          value={editingService.ctaUrl || ''}
                          onChange={e => setEditingService({ ...editingService, ctaUrl: e.target.value })}
                          placeholder="/inicio#contacto"
                          maxLength={200}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Beneficios */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Beneficios *</p>
                        <p className="text-[11px] text-muted-foreground">Entre 1 y 10 razones para elegir este servicio</p>
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
                    Crea servicios en <strong>/dashboard/repairs/inventory</strong> con unidad "servicio".
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
                            v ? n.add(p.id) : n.delete(p.id)
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
            <Button variant="outline" onClick={() => setServicesDraft(null)} disabled={!hasChanges || isSaving} className="rounded-xl gap-2">
              <RotateCcw className="h-4 w-4" />Descartar
            </Button>
            <Button onClick={handleSaveAll} disabled={!hasChanges || isSaving} className="rounded-xl gap-2 min-w-[140px]">
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
