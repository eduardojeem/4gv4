'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { 
  Loader2, Save, Briefcase, Wrench, Shield, Package, Check, Plus, Trash2, 
  Smartphone, Monitor, Battery, Cpu, Zap, Headset, ArrowUp, ArrowDown, 
  Settings, Clock, Sparkles, TrendingUp, Laptop, Edit3, X
} from 'lucide-react'
import { Service } from '@/types/website-settings'
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
]

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200' },
  { value: 'green', label: 'Verde', class: 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200' },
  { value: 'purple', label: 'Púrpura', class: 'bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-200' },
  { value: 'orange', label: 'Naranja', class: 'bg-orange-100 text-orange-600 border-orange-200 hover:bg-orange-200' },
  { value: 'red', label: 'Rojo', class: 'bg-red-100 text-red-600 border-red-200 hover:bg-red-200' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-100 text-indigo-600 border-indigo-200 hover:bg-indigo-200' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-100 text-teal-600 border-teal-200 hover:bg-teal-200' },
]

const COLOR_GRADIENTS: Record<string, string> = {
  blue: 'from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10',
  green: 'from-green-50 to-teal-50 dark:from-green-900/10 dark:to-teal-900/10',
  purple: 'from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10',
  orange: 'from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10',
  red: 'from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10',
  indigo: 'from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10',
  teal: 'from-teal-50 to-emerald-50 dark:from-teal-900/10 dark:to-emerald-900/10',
}

export function ServicesManager() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [services, setServices] = useState<Service[] | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Estado para el modal de edición
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  useEffect(() => {
    if (settings?.services) {
      setServices(settings.services)
    }
  }, [settings?.services])

  const handleSaveAll = async () => {
    if (!services) return
    const result = await updateSetting('services', services)
    if (result.success) {
      toast.success('Cambios guardados en la base de datos')
      setHasChanges(false)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleOpenEdit = (index: number) => {
    if (!services) return
    setEditingService({ ...services[index] })
    setEditingIndex(index)
    setIsDialogOpen(true)
  }

  const handleOpenAdd = () => {
    const newService: Service = {
      id: `service-${Date.now()}`,
      title: '',
      description: '',
      icon: 'smartphone',
      color: 'blue',
      benefits: ['']
    }
    setEditingService(newService)
    setEditingIndex(null) // null indica que es uno nuevo
    setIsDialogOpen(true)
  }

  const handleApplyChanges = () => {
    if (!editingService || !services) return
    
    // Validaciones básicas
    if (!editingService.title.trim()) {
      toast.error('El título es obligatorio')
      return
    }

    const updated = [...services]
    if (editingIndex !== null) {
      updated[editingIndex] = editingService
    } else {
      updated.push(editingService)
    }
    
    setServices(updated)
    setHasChanges(true)
    setIsDialogOpen(false)
    setEditingService(null)
    setEditingIndex(null)
    
    toast.success(editingIndex !== null ? 'Servicio actualizado localmente' : 'Servicio añadido localmente', {
      description: 'No olvides guardar los cambios globales para persistirlos.'
    })
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (!services) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= services.length) return

    const updated = [...services]
    const [moved] = updated.splice(index, 1)
    updated.splice(newIndex, 0, moved)
    setServices(updated)
    setHasChanges(true)
  }

  const handleDeleteService = (index: number) => {
    if (!services) return
    if (services.length <= 1) {
      toast.error('Debe haber al menos un servicio')
      return
    }
    
    const serviceName = services[index].title || `Servicio ${index + 1}`
    if (confirm(`¿Estás seguro de que deseas eliminar "${serviceName}"?`)) {
      const updated = services.filter((_, i) => i !== index)
      setServices(updated)
      setHasChanges(true)
      toast.success('Servicio eliminado de la lista')
    }
  }

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>
  if (!services) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Briefcase className="h-6 w-6" />
            </div>
            Gestión de Servicios
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Personaliza el catálogo de servicios que verán tus visitantes ({services.length} activos)</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-11 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95">
          <Plus className="mr-2 h-5 w-5" /> Nuevo Servicio
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => {
          const IconComp = ICON_OPTIONS.find(o => o.value === service.icon)?.icon || Smartphone
          const colorClass = COLOR_OPTIONS.find(o => o.value === service.color)?.class || COLOR_OPTIONS[0].class
          const gradient = COLOR_GRADIENTS[service.color] || COLOR_GRADIENTS.blue

          return (
            <Card key={service.id} className="group overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 bg-white dark:bg-gray-800 rounded-2xl">
              <CardHeader className={`bg-gradient-to-br ${gradient} p-5 relative overflow-hidden`}>
                {/* Fondo decorativo sutil */}
                <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                  <IconComp className="h-24 w-24" />
                </div>
                
                <div className="flex items-start justify-between relative z-10">
                  <div className={`p-3.5 rounded-2xl ${colorClass} shadow-md bg-white/90 dark:bg-black/20 backdrop-blur-md`}>
                    <IconComp className="h-7 w-7" />
                  </div>
                  <div className="flex gap-1.5 translate-x-1 group-hover:translate-x-0 transition-transform">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-white/50 hover:bg-white text-gray-500 hover:text-blue-600 backdrop-blur-sm"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-white/50 hover:bg-white text-gray-500 hover:text-blue-600 backdrop-blur-sm"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === services.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-white/50 hover:bg-red-50 text-gray-500 hover:text-red-500 backdrop-blur-sm"
                      onClick={() => handleDeleteService(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-5 relative z-10">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate">
                    {service.title || 'Sin Título'}
                  </h3>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-5">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 min-h-[4.5rem]">
                  {service.description || 'Sin descripción configurada para este servicio.'}
                </p>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-gray-400">
                    <span>Beneficios</span>
                    <span className="text-gray-300">{service.benefits.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {service.benefits.slice(0, 3).map((b, bi) => (
                      <div key={bi} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                        <span className="truncate">{b || 'Punto clave...'}</span>
                      </div>
                    ))}
                    {service.benefits.length > 3 && (
                      <p className="text-[10px] text-gray-400 italic mt-1">+ {service.benefits.length - 3} más...</p>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={() => handleOpenEdit(index)}
                  variant="outline" 
                  className="w-full h-11 border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50/50 hover:text-blue-600 dark:hover:bg-blue-900/10 transition-all rounded-xl gap-2 font-medium"
                >
                  <Edit3 className="h-4 w-4" />
                  Editar Servicio
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Modal de Edición */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl md:rounded-3xl p-0 border-none shadow-2xl">
          <DialogHeader className="p-6 md:p-8 pb-0">
            <DialogTitle className="text-xl md:text-2xl font-bold flex items-center gap-3">
              {editingIndex !== null ? (
                <>
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 shrink-0">
                    <Edit3 className="h-5 w-5" />
                  </div>
                  Editar Servicio
                </>
              ) : (
                <>
                  <div className="p-2 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 shrink-0">
                    <Plus className="h-5 w-5" />
                  </div>
                  Nuevo Servicio
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-gray-500 mt-1 text-sm md:text-base">
              Completa los detalles para que tus clientes sepan exactamente qué ofreces.
            </DialogDescription>
          </DialogHeader>

          {editingService && (
            <div className="p-6 md:p-8 space-y-6 md:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                {/* Columna Izquierda: Identidad */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Título del Servicio</Label>
                    <Input
                      value={editingService.title}
                      onChange={(e) => setEditingService({ ...editingService, title: e.target.value })}
                      placeholder="Ej: Cambio de Pantalla"
                      className="h-11 md:h-12 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white transition-all text-sm md:text-base"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Descripción</Label>
                    <Textarea
                      value={editingService.description}
                      onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                      placeholder="Escribe una breve descripción..."
                      className="min-h-[120px] md:min-h-[140px] rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white transition-all resize-none text-xs md:text-sm leading-relaxed"
                    />
                  </div>
                </div>

                {/* Columna Derecha: Estilo y Beneficios */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Personalización Visual</Label>
                    <div className="bg-gray-50/50 dark:bg-gray-900/20 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                      <div>
                        <span className="text-[10px] text-gray-400 mb-2 block">Icono Representativo</span>
                        <div className="grid grid-cols-6 gap-1.5 md:gap-2">
                          {ICON_OPTIONS.map(opt => {
                            const OIcon = opt.icon
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setEditingService({ ...editingService, icon: opt.value as any })}
                                className={`p-2 md:p-2.5 rounded-xl border transition-all ${editingService.icon === opt.value ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700 hover:border-blue-200 hover:text-blue-500'}`}
                                title={opt.label}
                              >
                                <OIcon className="h-4 w-4 mx-auto" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 mb-2 block">Color de Marca</span>
                        <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                          {COLOR_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setEditingService({ ...editingService, color: opt.value as any })}
                              className={`h-6 md:h-7 rounded-lg border-2 transition-all ${opt.class} ${editingService.color === opt.value ? 'ring-2 ring-blue-500 ring-offset-2' : 'opacity-40 hover:opacity-100'}`}
                              title={opt.label}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex justify-between items-center">
                      Puntos Clave / Beneficios
                      <button 
                        type="button"
                        onClick={() => setEditingService({ ...editingService, benefits: [...editingService.benefits, ''] })}
                        className="text-blue-600 hover:text-blue-700 text-[10px] font-bold flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Añadir
                      </button>
                    </Label>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                      {editingService.benefits.map((b, bi) => (
                        <div key={bi} className="flex gap-2 group">
                          <Input
                            value={b}
                            onChange={(e) => {
                              const newBenefits = [...editingService.benefits]
                              newBenefits[bi] = e.target.value
                              setEditingService({ ...editingService, benefits: newBenefits })
                            }}
                            className="h-9 md:h-10 rounded-xl bg-gray-50/50 border-gray-100 text-[11px] md:text-xs"
                            placeholder="Ej: Instalación en 1 hora"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 md:h-10 md:w-10 text-gray-300 hover:text-red-500 flex-shrink-0"
                            onClick={() => {
                              const newBenefits = editingService.benefits.filter((_, i) => i !== bi)
                              setEditingService({ ...editingService, benefits: newBenefits })
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-6 md:pt-8 border-t border-gray-50 dark:border-gray-800 gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsDialogOpen(false)} 
                  className="w-full md:w-auto rounded-xl h-11 md:h-12 px-8 text-gray-500 font-bold"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleApplyChanges} 
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 md:h-12 px-10 font-bold shadow-lg shadow-blue-100"
                >
                  {editingIndex !== null ? 'Actualizar' : 'Añadir'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-6 right-6 md:sticky md:bottom-6 md:flex md:justify-end z-50">
        <Button 
          onClick={handleSaveAll} 
          disabled={isSaving || !hasChanges}
          size="lg"
          className="shadow-2xl px-8 md:px-12 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 h-14 md:h-16 rounded-full md:rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 disabled:grayscale"
        >
          {isSaving ? (
            <><Loader2 className="mr-3 h-5 w-5 md:h-6 md:w-6 animate-spin" /> <span className="hidden md:inline">Guardando...</span></>
          ) : (
            <>
              <Save className="mr-3 h-5 w-5 md:h-6 md:w-6" /> 
              <span className="hidden md:inline">Guardar Todo ({hasChanges ? '¡Pendiente!' : 'Al día'})</span>
              <span className="md:hidden">Guardar</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
