'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { 
  Loader2, Save, Briefcase, Wrench, Shield, Package, Check, Plus, Trash2, 
  Smartphone, Monitor, Battery, Cpu, Zap, Headset, ArrowUp, ArrowDown, 
  Clock, Sparkles, Laptop, Edit3, Droplet, Camera,
  Eye, EyeOff, Receipt, Wallet, Landmark, Banknote, CreditCard,
  AlertTriangle, CheckCircle2, Globe2, RotateCcw
} from 'lucide-react'
import { Service } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { getActivePublicServices } from '@/lib/website/services'
import { SectionHowItWorks } from '@/components/admin/website/SectionHowItWorks'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const ICON_OPTIONS = [
  { value: 'smartphone', label: 'Celular', icon: Smartphone },
  { value: 'monitor', label: 'Pantalla', icon: Monitor },
  { value: 'battery', label: 'Batería', icon: Battery },
  { value: 'cpu', label: 'Procesador', icon: Cpu },
  { value: 'zap', label: 'Carga', icon: Zap },
  { value: 'wrench', label: 'Reparación', icon: Wrench },
  { value: 'shield', label: 'Garantía', icon: Shield },
  { value: 'package', label: 'Insumos', icon: Package },
  { value: 'headset', label: 'Soporte', icon: Headset },
  { value: 'laptop', label: 'Laptop', icon: Laptop },
  { value: 'clock', label: 'Tiempo', icon: Clock },
  { value: 'sparkles', label: 'Especial', icon: Sparkles },
  { value: 'droplet', label: 'Agua', icon: Droplet },
  { value: 'camera', label: 'Cámara', icon: Camera },
  { value: 'microchip', label: 'Chip', icon: Cpu },
  { value: 'receipt', label: 'Facturas', icon: Receipt },
  { value: 'wallet', label: 'Billetera', icon: Wallet },
  { value: 'landmark', label: 'Banco', icon: Landmark },
  { value: 'banknote', label: 'Efectivo', icon: Banknote },
  { value: 'credit-card', label: 'Tarjeta', icon: CreditCard },
]

const FINANCIAL_SERVICE_PRESETS: Array<Omit<Service, 'id'>> = [
  {
    title: 'Pago de facturas',
    description: 'Cobro de facturas y servicios con comprobante para tus clientes.',
    icon: 'receipt',
    color: 'emerald',
    benefits: ['Tigo', 'Personal', 'ANDE', 'ESSAP'],
    active: true,
    price: 'Consultar comision',
    priceNote: 'segun operacion',
    duration: 'En el momento',
    category: 'Pagos y servicios',
    featured: true,
    ctaUrl: '/inicio#contacto',
  },
  {
    title: 'Tigo Money y billeteras',
    description: 'Atencion para operaciones de billetera digital segun disponibilidad del local.',
    icon: 'wallet',
    color: 'sky',
    benefits: ['Envios', 'Retiros', 'Cargas', 'Pagos'],
    active: true,
    price: 'Segun operacion',
    priceNote: 'consultar condiciones',
    duration: 'En el momento',
    category: 'Billeteras digitales',
    ctaUrl: '/inicio#contacto',
  },
  {
    title: 'Depositos bancarios',
    description: 'Recepcion de depositos o pagos a cuentas bancarias con confirmacion por comprobante.',
    icon: 'landmark',
    color: 'blue',
    benefits: ['Depositos a cuentas', 'Comprobante', 'Atencion en local'],
    active: true,
    price: 'Consultar comision',
    priceNote: 'segun banco',
    duration: 'En el momento',
    category: 'Operaciones bancarias',
    ctaUrl: '/inicio#contacto',
  },
  {
    title: 'Western Union',
    description: 'Envio y retiro de dinero por Western Union, sujeto a disponibilidad y requisitos del operador.',
    icon: 'banknote',
    color: 'yellow',
    benefits: ['Envios internacionales', 'Retiros de dinero', 'Atencion en local'],
    active: true,
    price: 'Consultar comision',
    priceNote: 'segun operacion',
    duration: 'En el momento',
    category: 'Giros internacionales',
    featured: true,
    ctaUrl: '/inicio#contacto',
  },
  {
    title: 'Giros nacionales',
    description: 'Envio y retiro de dinero dentro del pais mediante los operadores disponibles en el local.',
    icon: 'banknote',
    color: 'green',
    benefits: ['Envios nacionales', 'Retiros', 'Comprobante de operacion'],
    active: true,
    price: 'Consultar comision',
    priceNote: 'segun operador',
    duration: 'En el momento',
    category: 'Giros y transferencias',
    ctaUrl: '/inicio#contacto',
  },
  {
    title: 'Recargas y paquetes',
    description: 'Carga de saldo y activacion de paquetes para lineas de las operadoras disponibles.',
    icon: 'zap',
    color: 'cyan',
    benefits: ['Recarga de saldo', 'Paquetes de internet', 'Confirmacion inmediata'],
    active: true,
    price: 'Segun recarga',
    priceNote: 'consultar operadoras',
    duration: 'En el momento',
    category: 'Telefonia',
    ctaUrl: '/inicio#contacto',
  },
  {
    title: 'Cobro de cuotas',
    description: 'Recepcion de pagos de cuotas para empresas y entidades habilitadas en el punto de cobro.',
    icon: 'credit-card',
    color: 'purple',
    benefits: ['Pago de cuotas', 'Comprobante', 'Consulta de disponibilidad'],
    active: true,
    price: 'Consultar comision',
    priceNote: 'segun entidad',
    duration: 'En el momento',
    category: 'Cobranzas',
    ctaUrl: '/inicio#contacto',
  },
]

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200' },
  { value: 'green', label: 'Verde', class: 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200' },
  { value: 'purple', label: 'Púrpura', class: 'bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-200' },
  { value: 'orange', label: 'Naranja', class: 'bg-orange-100 text-orange-600 border-orange-200 hover:bg-orange-200' },
  { value: 'red', label: 'Rojo', class: 'bg-red-100 text-red-600 border-red-200 hover:bg-red-200' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-100 text-indigo-600 border-indigo-200 hover:bg-indigo-200' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-100 text-teal-600 border-teal-200 hover:bg-teal-200' },
  { value: 'yellow', label: 'Amarillo', class: 'bg-yellow-100 text-yellow-600 border-yellow-200 hover:bg-yellow-200' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-100 text-cyan-600 border-cyan-200 hover:bg-cyan-200' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-100 text-pink-600 border-pink-200 hover:bg-pink-200' },
  { value: 'rose', label: 'Rose', class: 'bg-rose-100 text-rose-600 border-rose-200 hover:bg-rose-200' },
  { value: 'amber', label: 'Ambar', class: 'bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-200' },
  { value: 'emerald', label: 'Esmeralda', class: 'bg-emerald-100 text-emerald-600 border-emerald-200 hover:bg-emerald-200' },
  { value: 'sky', label: 'Cielo', class: 'bg-sky-100 text-sky-600 border-sky-200 hover:bg-sky-200' },
]

function isServiceReady(service: Service): boolean {
  const benefits = (service.benefits || [])
    .map((benefit) => benefit.trim())
    .filter(Boolean)

  return (
    service.title.trim().length >= 3 &&
    service.description.trim().length >= 10 &&
    benefits.length >= 1 &&
    benefits.length <= 10
  )
}

function createServiceId(label?: string): string {
  const suffix = label
    ? `-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    : ''

  return `service-${Date.now()}${suffix}`
}

export function ServicesManager() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [servicesDraft, setServicesDraft] = useState<Service[] | null>(null)
  
  // Estado para el modal de edición
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false)
  const defaults = getWebsiteSettingsDefaults()
  const services = servicesDraft ?? settings?.services ?? defaults.services
  const savedServices = settings?.services ?? defaults.services
  const hasChanges = servicesDraft !== null
  const activeServicesCount = getActivePublicServices(services).length
  const savedActiveServicesCount = getActivePublicServices(savedServices).length
  const hiddenServicesCount = services.length - activeServicesCount
  const readyServicesCount = services.filter(isServiceReady).length
  const pageEnabled = settings?.company_info?.servicesPageEnabled !== false
  const pagePublished = pageEnabled && savedActiveServicesCount > 0

  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  const handleSaveAll = async () => {
    const invalidService = services.find((service) => !isServiceReady(service))

    if (invalidService) {
      toast.error('Hay servicios inválidos', {
        description: 'Revisa título (mín. 3), descripción (mín. 10) y beneficios (1-10, sin vacíos).'
      })
      return
    }

    const result = await updateSetting('services', services)
    if (result.success) {
      toast.success('Cambios guardados en la base de datos')
      setServicesDraft(null)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleOpenEdit = (index: number) => {
    const service = services[index]
    if (!service) return

    setEditingService({
      ...service,
      benefits: [...service.benefits]
    })
    setEditingIndex(index)
    setIsDialogOpen(true)
  }

  const handleOpenAdd = () => {
    if (services.length >= 10) {
      toast.error('Límite de servicios alcanzado', {
        description: 'Puedes cargar hasta 10 servicios.',
      })
      return
    }

    const newService: Service = {
      id: createServiceId(),
      title: '',
      description: '',
      icon: 'smartphone',
      color: 'blue',
      benefits: [''],
      active: true
    }
    setEditingService(newService)
    setEditingIndex(null) // null indica que es uno nuevo
    setIsDialogOpen(true)
  }

  const handleAddPreset = (preset: Omit<Service, 'id'>) => {
    if (services.length >= 10) {
      toast.error('Limite de servicios alcanzado', {
        description: 'Puedes publicar hasta 10 servicios en la pagina.',
      })
      return
    }

    const newService: Service = {
      ...preset,
      id: createServiceId(preset.title),
      benefits: [...preset.benefits],
    }

    setServicesDraft([...services, newService])
    toast.success('Plantilla agregada', {
      description: 'Revisa el detalle y guarda los cambios para publicarla.',
    })
  }

  const handleApplyChanges = () => {
    if (!editingService) return
    
    // Validaciones alineadas con backend
    const title = editingService.title.trim()
    const description = editingService.description.trim()
    const benefits = editingService.benefits.map((b) => b.trim()).filter(Boolean)

    if (title.length < 3) {
      toast.error('Título inválido', {
        description: 'El título debe tener al menos 3 caracteres.'
      })
      return
    }

    if (description.length < 10) {
      toast.error('Descripción inválida', {
        description: 'La descripción debe tener al menos 10 caracteres.'
      })
      return
    }

    if (benefits.length < 1 || benefits.length > 10) {
      toast.error('Beneficios inválidos', {
        description: 'Debes cargar entre 1 y 10 beneficios válidos.'
      })
      return
    }

    const normalizedService: Service = {
      ...editingService,
      title,
      description,
      benefits
    }

    const updated = [...services]
    if (editingIndex !== null) {
      updated[editingIndex] = normalizedService
    } else {
      updated.push(normalizedService)
    }
    
    setServicesDraft(updated)
    setIsDialogOpen(false)
    setEditingService(null)
    setEditingIndex(null)
    
    toast.success(editingIndex !== null ? 'Servicio actualizado localmente' : 'Servicio añadido localmente', {
      description: 'No olvides guardar los cambios globales para persistirlos.'
    })
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= services.length) return

    const updated = [...services]
    const [moved] = updated.splice(index, 1)
    updated.splice(newIndex, 0, moved)
    setServicesDraft(updated)
  }

  const handleDeleteService = (index: number) => {
    if (services.length <= 1) {
      toast.error('Debe haber al menos un servicio')
      return
    }
    
    const serviceName = services[index].title || `Servicio ${index + 1}`
    if (confirm(`¿Estás seguro de que deseas eliminar "${serviceName}"?`)) {
      const updated = services.filter((_, i) => i !== index)
      setServicesDraft(updated)
      toast.success('Servicio eliminado de la lista')
    }
  }

  const handleToggleActive = (index: number) => {
    const updated = [...services]
    updated[index] = { ...updated[index], active: !updated[index].active }
    setServicesDraft(updated)
  }

  const handlePageVisibilityChange = async (enabled: boolean) => {
    if (enabled && savedActiveServicesCount === 0) {
      toast.error('Primero guarda un servicio activo', {
        description: 'La página pública necesita al menos un servicio activo guardado.',
      })
      return
    }

    setIsUpdatingVisibility(true)
    const currentInfo = settings?.company_info ?? defaults.company_info
    const result = await updateSetting('company_info', {
      ...currentInfo,
      servicesPageEnabled: enabled,
    })
    setIsUpdatingVisibility(false)

    if (result.success) {
      toast.success(enabled ? 'Página de servicios publicada' : 'Página de servicios ocultada')
    } else {
      toast.error('No se pudo actualizar la publicación', {
        description: result.error,
      })
    }
  }

  if (isLoading && servicesDraft === null && !settings) {
    return <div className="p-8 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>
  }

  if (error && servicesDraft === null && !settings) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Servicios públicos</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Define qué ofreces, en qué orden se muestra y cuándo estará disponible para tus clientes.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleOpenAdd}
          disabled={services.length >= 10}
          className="h-10 shrink-0 rounded-md"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Nuevo servicio
        </Button>
      </div>

      <Card className="rounded-lg shadow-none">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                pagePublished
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {pagePublished
                  ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  : <Globe2 className="h-5 w-5" aria-hidden="true" />}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {pagePublished ? 'Página publicada' : 'Página no disponible'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {pagePublished
                    ? `${savedActiveServicesCount} servicio${savedActiveServicesCount === 1 ? '' : 's'} activo${savedActiveServicesCount === 1 ? '' : 's'} visible${savedActiveServicesCount === 1 ? '' : 's'} en el menú público.`
                    : savedActiveServicesCount === 0
                      ? 'Guarda al menos un servicio activo para poder publicar esta página.'
                      : 'La página y el enlace “Servicios” están ocultos para los visitantes.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 px-3 py-2 lg:min-w-[230px]">
              <div>
                <Label htmlFor="services-page-enabled" className="text-sm font-medium">
                  Mostrar página
                </Label>
                <p className="text-[11px] text-muted-foreground">Este cambio se guarda al instante.</p>
              </div>
              {isUpdatingVisibility
                ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                : (
                  <Switch
                    id="services-page-enabled"
                    checked={pageEnabled}
                    onCheckedChange={handlePageVisibilityChange}
                    disabled={isSaving || (!pageEnabled && savedActiveServicesCount === 0)}
                  />
                )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x rounded-md border bg-background">
            <div className="px-3 py-2">
              <p className="text-lg font-semibold">{activeServicesCount}</p>
              <p className="text-[11px] text-muted-foreground">Activos</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-lg font-semibold">{hiddenServicesCount}</p>
              <p className="text-[11px] text-muted-foreground">Ocultos</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-lg font-semibold">{readyServicesCount}/{services.length}</p>
              <p className="text-[11px] text-muted-foreground">Completos</p>
            </div>
          </div>

          {pageEnabled && activeServicesCount === 0 && (
            <div className="mt-4 flex gap-2 border-l-2 border-amber-500 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Al guardar sin servicios activos, la página pública dejará de estar disponible.
            </div>
          )}

          <SectionHowItWorks
            sectionName="la página pública de servicios"
            steps={[
              {
                title: 'Crea y ordena tu catálogo',
                description: 'Carga hasta 10 servicios, completa sus beneficios y define cuáles estarán activos.',
              },
              {
                title: 'Guarda los cambios',
                description: 'Las ediciones, el orden y el estado de cada servicio se aplican con el botón inferior.',
              },
              {
                title: 'Publica la página',
                description: 'Activa “Mostrar página” para agregar Servicios al menú público. Este control se guarda al instante.',
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="rounded-lg shadow-none">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Plantillas para pagos y operaciones</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Agrega una base editable para facturas, billeteras, bancos, Western Union, giros, recargas o cobranzas.
                Confirma operadores, requisitos y comisiones antes de publicar.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {FINANCIAL_SERVICE_PRESETS.map((preset) => {
                const IconComp = ICON_OPTIONS.find((option) => option.value === preset.icon)?.icon || Receipt
                return (
                  <Button
                    key={preset.title}
                    type="button"
                    variant="outline"
                    className="h-auto justify-start gap-2 rounded-md px-3 py-2 text-left"
                    onClick={() => handleAddPreset(preset)}
                    disabled={services.length >= 10}
                  >
                    <IconComp className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{preset.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{preset.category}</span>
                    </span>
                  </Button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {services.map((service, index) => {
          const IconComp = ICON_OPTIONS.find(o => o.value === service.icon)?.icon || Smartphone
          const colorClass = COLOR_OPTIONS.find(o => o.value === service.color)?.class || COLOR_OPTIONS[0].class
          const isActive = service.active !== false
          const isReady = isServiceReady(service)

          return (
            <Card
              key={service.id}
              className={`overflow-hidden rounded-lg shadow-none ${!isActive ? 'bg-muted/20' : ''}`}
            >
              <div className="grid md:grid-cols-[minmax(0,1fr)_270px]">
                <CardHeader className="space-y-3 border-b p-4 md:border-b-0 md:border-r">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${colorClass}`}>
                      <IconComp className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-sm font-semibold">
                          {service.title || 'Servicio sin título'}
                        </h3>
                        <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${
                          isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                            : 'border-border bg-muted text-muted-foreground'
                        }`}>
                          {isActive ? 'Activo' : 'Oculto'}
                        </span>
                        {!isReady && (
                          <span className="rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                            Incompleto
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {service.description || 'Completa una descripción para explicar este servicio.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{service.category || 'Sin categoría'}</span>
                    {service.price && <span className="font-medium text-foreground">{service.price}</span>}
                    {service.duration && <span>{service.duration}</span>}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {service.benefits.slice(0, 3).map((benefit, benefitIndex) => (
                      <span
                        key={`${service.id}-benefit-${benefitIndex}`}
                        className="max-w-full truncate rounded-sm bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        {benefit || 'Beneficio pendiente'}
                      </span>
                    ))}
                    {service.benefits.length > 3 && (
                      <span className="rounded-sm bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                        +{service.benefits.length - 3} más
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col justify-between gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Posición {index + 1}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        aria-label={`Subir ${service.title || 'servicio'}`}
                        title="Subir"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                        className="h-8 w-8 rounded-md"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === services.length - 1}
                        aria-label={`Bajar ${service.title || 'servicio'}`}
                        title="Bajar"
                    >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                        className="h-8 w-8 rounded-md text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteService(index)}
                        aria-label={`Eliminar ${service.title || 'servicio'}`}
                        title="Eliminar"
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                  <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                    <Label htmlFor={`service-active-${service.id}`} className="text-xs font-medium">
                      Visible al público
                    </Label>
                    <Switch
                      id={`service-active-${service.id}`}
                      checked={isActive}
                      onCheckedChange={() => handleToggleActive(index)}
                    />
                  </div>

                  <Button
                    onClick={() => handleOpenEdit(index)}
                    variant="outline"
                    className="h-9 w-full rounded-md gap-2"
                  >
                    <Edit3 className="h-4 w-4" aria-hidden="true" />
                    Editar detalles
                  </Button>
                </CardContent>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Modal de Edición */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg p-0 shadow-xl sm:w-[95vw] md:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                {editingIndex !== null
                  ? <Edit3 className="h-4 w-4" aria-hidden="true" />
                  : <Plus className="h-4 w-4" aria-hidden="true" />}
              </div>
              <div>
                <DialogTitle className="text-base font-semibold sm:text-lg">
                  {editingIndex !== null ? 'Editar servicio' : 'Nuevo servicio'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-relaxed sm:text-sm">
                  Describe el servicio como lo verá el cliente. Los campos marcados con * son obligatorios.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editingService && (
            <>
              <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5 sm:px-6">
                <section aria-labelledby="service-publication-title">
                  <h3 id="service-publication-title" className="text-sm font-semibold">
                    Publicación
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Controla si aparecerá en la página y si tendrá mayor protagonismo.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
                      <Label className="cursor-pointer" htmlFor="active-switch">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {editingService.active !== false
                            ? <Eye className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                            : <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                          Visible al público
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          Se mostrará después de guardar el catálogo.
                        </span>
                      </Label>
                      <Switch
                        id="active-switch"
                        checked={editingService.active !== false}
                        onCheckedChange={(checked) => setEditingService({ ...editingService, active: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
                      <Label className="cursor-pointer" htmlFor="featured-switch">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Sparkles
                            className={`h-4 w-4 ${editingService.featured ? 'text-amber-500' : 'text-muted-foreground'}`}
                            aria-hidden="true"
                          />
                          Servicio destacado
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          Ayuda a resaltarlo frente a los demás.
                        </span>
                      </Label>
                      <Switch
                        id="featured-switch"
                        checked={editingService.featured || false}
                        onCheckedChange={(checked) => setEditingService({ ...editingService, featured: checked })}
                      />
                    </div>
                  </div>
                </section>

                <section aria-labelledby="service-details-title">
                  <h3 id="service-details-title" className="text-sm font-semibold">
                    Información principal
                  </h3>
                  <div className="mt-3 space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="service-title">Título del servicio *</Label>
                        <span className="text-[11px] text-muted-foreground">{editingService.title.length}/100</span>
                      </div>
                      <Input
                        id="service-title"
                        value={editingService.title}
                        onChange={(e) => setEditingService({ ...editingService, title: e.target.value })}
                        placeholder="Ej: Cambio de pantalla"
                        maxLength={100}
                        className="h-10 rounded-md"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="service-description">Descripción para el cliente *</Label>
                        <span className="text-[11px] text-muted-foreground">{editingService.description.length}/500</span>
                      </div>
                      <Textarea
                        id="service-description"
                        value={editingService.description}
                        onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                        placeholder="Explica qué incluye el servicio, para quién es y qué puede esperar el cliente."
                        maxLength={500}
                        className="min-h-[96px] resize-y rounded-md text-sm leading-relaxed"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="service-category">Categoría</Label>
                        <Input
                          id="service-category"
                          value={editingService.category || ''}
                          onChange={(e) => setEditingService({ ...editingService, category: e.target.value })}
                          placeholder="Reparaciones"
                          maxLength={80}
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="service-price">Precio</Label>
                        <Input
                          id="service-price"
                          value={editingService.price || ''}
                          onChange={(e) => setEditingService({ ...editingService, price: e.target.value })}
                          placeholder="Desde Gs. 150.000"
                          maxLength={60}
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="service-duration">Duración estimada</Label>
                        <Input
                          id="service-duration"
                          value={editingService.duration || ''}
                          onChange={(e) => setEditingService({ ...editingService, duration: e.target.value })}
                          placeholder="30 a 60 minutos"
                          maxLength={60}
                          className="h-10 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="service-price-note">Aclaración del precio</Label>
                        <Input
                          id="service-price-note"
                          value={editingService.priceNote || ''}
                          onChange={(e) => setEditingService({ ...editingService, priceNote: e.target.value })}
                          placeholder="Según diagnóstico o modelo"
                          maxLength={60}
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="service-cta">Enlace de consulta</Label>
                        <Input
                          id="service-cta"
                          value={editingService.ctaUrl || ''}
                          onChange={(e) => setEditingService({ ...editingService, ctaUrl: e.target.value })}
                          placeholder="/inicio#contacto"
                          maxLength={200}
                          className="h-10 rounded-md"
                        />
                        <p className="text-[11px] text-muted-foreground">Usa una ruta interna o una URL HTTPS.</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section aria-labelledby="service-benefits-title">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h3 id="service-benefits-title" className="text-sm font-semibold">
                        Beneficios para el cliente *
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Agrega entre 1 y 10 razones concretas para elegir este servicio.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingService({ ...editingService, benefits: [...editingService.benefits, ''] })}
                      disabled={editingService.benefits.length >= 10}
                      className="h-8 shrink-0 rounded-md"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Agregar
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {editingService.benefits.map((benefit, benefitIndex) => (
                      <div key={benefitIndex} className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                          <Check className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                          <Input
                            value={benefit}
                            onChange={(event) => {
                              const newBenefits = [...editingService.benefits]
                              newBenefits[benefitIndex] = event.target.value
                              setEditingService({ ...editingService, benefits: newBenefits })
                            }}
                            maxLength={200}
                            className="h-10 rounded-md pl-9"
                            placeholder="Ej: Diagnóstico incluido"
                            aria-label={`Beneficio ${benefitIndex + 1}`}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
                          disabled={editingService.benefits.length <= 1}
                          aria-label={`Eliminar beneficio ${benefitIndex + 1}`}
                          onClick={() => {
                            const newBenefits = editingService.benefits.filter((_, index) => index !== benefitIndex)
                            setEditingService({ ...editingService, benefits: newBenefits })
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>

                <section aria-labelledby="service-appearance-title">
                  <h3 id="service-appearance-title" className="text-sm font-semibold">
                    Apariencia
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    El icono y el color ayudan a reconocer el servicio rápidamente.
                  </p>
                  <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div>
                      <Label className="text-xs">Icono</Label>
                      <div className="mt-2 grid grid-cols-7 gap-2 sm:grid-cols-10">
                        {ICON_OPTIONS.map((option) => {
                          const OptionIcon = option.icon
                          const selected = editingService.icon === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setEditingService({ ...editingService, icon: option.value })}
                              className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                                selected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                              }`}
                              title={option.label}
                              aria-label={`Icono ${option.label}`}
                              aria-pressed={selected}
                            >
                              <OptionIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Color</Label>
                      <div className="mt-2 grid grid-cols-7 gap-2">
                        {COLOR_OPTIONS.map((option) => {
                          const selected = editingService.color === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setEditingService({ ...editingService, color: option.value })}
                              className={`flex h-7 w-7 items-center justify-center rounded-md border ${option.class} ${
                                selected ? 'ring-2 ring-primary ring-offset-2' : 'opacity-60 hover:opacity-100'
                              }`}
                              title={option.label}
                              aria-label={`Color ${option.label}`}
                              aria-pressed={selected}
                            >
                              {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <DialogFooter className="shrink-0 gap-2 border-t bg-background px-5 py-3 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="h-10 w-full rounded-md sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyChanges}
                  className="h-10 w-full rounded-md sm:min-w-[150px] sm:w-auto"
                >
                  {editingIndex !== null ? 'Guardar edición' : 'Crear servicio'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="sticky bottom-0 z-30 -mx-2 border-t bg-background/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-4 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`h-2 w-2 rounded-full ${hasChanges ? 'bg-amber-500' : 'bg-emerald-500'}`}
              aria-hidden="true"
            />
            <span>{hasChanges ? 'Hay cambios del catálogo sin guardar' : 'El catálogo está guardado'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              type="button"
              variant="outline"
              onClick={() => setServicesDraft(null)}
              disabled={isSaving || !hasChanges}
              className="h-10 rounded-md"
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Descartar
            </Button>
            <Button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || !hasChanges}
              className="h-10 rounded-md"
            >
              {isSaving
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
