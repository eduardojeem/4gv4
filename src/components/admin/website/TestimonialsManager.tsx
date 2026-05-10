'use client'

import { useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Save, Plus, Trash2, Star, Check, GripVertical, Eye, EyeOff } from 'lucide-react'
import { Testimonial } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

export function TestimonialsManager() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [testimonialsDraft, setTestimonialsDraft] = useState<Testimonial[] | null>(null)
  const testimonials = testimonialsDraft ?? settings?.testimonials ?? getWebsiteSettingsDefaults().testimonials
  const hasChanges = testimonialsDraft !== null

  const handleSave = async () => {
    // Validar que todos los testimonios tengan datos completos
    const invalidTestimonial = testimonials.find(
      t => !t.name.trim() || !t.comment.trim() || t.rating < 1 || t.rating > 5
    )
    
    if (invalidTestimonial) {
      toast.error('Testimonios incompletos', {
        description: 'Todos los testimonios deben tener nombre, comentario y rating válido'
      })
      return
    }

    // Validar longitud mínima de comentarios
    const shortComment = testimonials.find(t => t.comment.trim().length < 10)
    if (shortComment) {
      toast.error('Comentario muy corto', {
        description: 'Los comentarios deben tener al menos 10 caracteres'
      })
      return
    }

    const result = await updateSetting('testimonials', testimonials)
    if (result.success) {
      toast.success('Testimonios actualizados', {
        icon: <Check className="h-4 w-4" />
      })
      setTestimonialsDraft(null)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleAdd = () => {
    const MAX_TESTIMONIALS = 20
    
    if (testimonials.length >= MAX_TESTIMONIALS) {
      toast.error(`Máximo ${MAX_TESTIMONIALS} testimonios`, {
        description: 'Has alcanzado el límite de testimonios permitidos'
      })
      return
    }
    
    const newTestimonial: Testimonial = {
      id: Date.now().toString(),
      name: '',
      rating: 5,
      comment: '',
      active: true
    }
    setTestimonialsDraft([...(testimonialsDraft ?? testimonials), newTestimonial])
  }

  const handleDelete = (id: string) => {
    // Confirmación antes de eliminar
    if (!confirm('¿Estás seguro de eliminar este testimonio?')) {
      return
    }
    
    setTestimonialsDraft(testimonials.filter((t) => t.id !== id))
  }

  const handleUpdate = (id: string, field: keyof Testimonial, value: string | number | boolean) => {
    // Validar rating
    if (field === 'rating') {
      const rating = typeof value === 'number' ? value : parseInt(value as string)
      if (rating < 1 || rating > 5) {
        toast.error('Rating debe estar entre 1 y 5')
        return
      }
      value = rating
    }
    
    setTestimonialsDraft(
      testimonials.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )
  }

  if (isLoading && testimonialsDraft === null && !settings) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Cargando testimonios...</p>
      </div>
    )
  }

  if (error && testimonialsDraft === null && !settings) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-red-600">
        Error al cargar testimonios: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 p-6">
        <div>
          <h3 className="text-lg font-semibold">Testimonios de Clientes</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona las reseñas mostradas en el portal público ({testimonials.length} testimonios)
          </p>
        </div>
        <Button onClick={handleAdd} size="sm" className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700">
          <Plus className="mr-2 h-4 w-4" />
          Agregar Testimonio
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {testimonials.map((testimonial, index) => {
          const isActive = testimonial.active !== false
          return (
            <Card key={testimonial.id} className={`border-none shadow-lg hover:shadow-xl transition-all duration-300 group ${!isActive ? 'opacity-60 grayscale' : ''}`}>
              <CardHeader className="bg-gradient-to-r from-orange-50/50 to-red-50/50 dark:from-orange-950/10 dark:to-red-950/10 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-500">Testimonio #{index + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdate(testimonial.id, 'active', !isActive)}
                      className={`h-8 w-8 p-0 md:h-9 md:w-auto md:px-3 ${isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
                      title={isActive ? "Desactivar testimonio" : "Activar testimonio"}
                    >
                      {isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      <span className="hidden md:inline ml-2">{isActive ? 'Visible' : 'Oculto'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(testimonial.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 h-8 w-8 p-0 md:h-9 md:w-auto md:px-3"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden md:inline ml-2">Eliminar</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                  <Label htmlFor={`name-${testimonial.id}`} className="text-sm font-medium">Nombre del Cliente</Label>
                  <Input
                    id={`name-${testimonial.id}`}
                    value={testimonial.name}
                    onChange={(e) => handleUpdate(testimonial.id, 'name', e.target.value)}
                    placeholder="Nombre Apellido"
                    maxLength={100}
                    className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`rating-${testimonial.id}`} className="text-sm font-medium">Calificación</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id={`rating-${testimonial.id}`}
                      type="number"
                      min="1"
                      max="5"
                      value={testimonial.rating}
                      onChange={(e) => handleUpdate(testimonial.id, 'rating', parseInt(e.target.value))}
                      className="w-16 border-gray-200 focus:border-orange-500 focus:ring-orange-500 h-10"
                    />
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 transition-colors ${
                            i < testimonial.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`comment-${testimonial.id}`} className="text-sm font-medium">Comentario</Label>
                <Textarea
                  id={`comment-${testimonial.id}`}
                  value={testimonial.comment}
                  onChange={(e) => handleUpdate(testimonial.id, 'comment', e.target.value)}
                  placeholder="Escribe el testimonio del cliente..."
                  rows={3}
                  maxLength={500}
                  className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 resize-none text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`role-${testimonial.id}`} className="text-sm font-medium">Cargo / Rol (opcional)</Label>
                  <Input
                    id={`role-${testimonial.id}`}
                    value={testimonial.role || ''}
                    onChange={(e) => handleUpdate(testimonial.id, 'role', e.target.value)}
                    placeholder="Cliente desde 2022"
                    maxLength={80}
                    className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`avatar-${testimonial.id}`} className="text-sm font-medium">URL de Foto (opcional)</Label>
                  <Input
                    id={`avatar-${testimonial.id}`}
                    value={testimonial.avatarUrl || ''}
                    onChange={(e) => handleUpdate(testimonial.id, 'avatarUrl', e.target.value)}
                    placeholder="https://cdn.ejemplo.com/foto.jpg"
                    maxLength={300}
                    className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )})}
      </div>

      {testimonials.length === 0 && (
        <div className="text-center py-12 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center">
            <Star className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">No hay testimonios todavía</p>
            <Button onClick={handleAdd} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Primer Testimonio
            </Button>
          </div>
        </div>
      )}

      {/* Botón de guardar flotante */}
      <div className="fixed bottom-6 right-6 md:sticky md:bottom-6 md:flex md:justify-end z-50">
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !hasChanges}
          size="lg"
          className="shadow-2xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 transition-all duration-300 rounded-full md:rounded-xl px-8 md:px-6 h-14 md:h-12"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="hidden md:inline">Guardando...</span>
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              <span className="hidden md:inline">Guardar Cambios</span>
              <span className="md:hidden">Guardar</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
