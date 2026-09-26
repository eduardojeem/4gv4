'use client'

import React, { useState, useEffect } from 'react'
import { Building2, Globe, Save, X, AlertCircle, BadgeCheck, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Brand } from '@/hooks/useBrands'
import type { Database } from '@/lib/supabase/types'

type BrandInsert = Database['public']['Tables']['brands']['Insert'] & { global_brand_id?: string | null }

/** Marca oficial del catálogo de la plataforma. */
type CatalogBrand = {
  id: string
  name: string
  logo_url?: string | null
  website?: string | null
}

export type BrandModalBrand = Brand | (Partial<Brand> & { isActive?: boolean })

interface BrandModalProps {
  isOpen: boolean
  onClose: () => void
  brand?: BrandModalBrand
  /**
   * El nombre que el usuario ya escribió antes de abrir el alta. Llega desde
   * el buscador de marcas del formulario de producto: escribirlo de nuevo acá
   * era el paso que sobraba.
   */
  initialName?: string
  onSave: (brandData: BrandInsert) => Promise<{ success: boolean; error?: string }>
}

const COUNTRIES = [
  'Estados Unidos', 'China', 'Corea del Sur', 'Japón', 'Alemania', 
  'Reino Unido', 'Francia', 'Italia', 'España', 'Canadá', 'Australia',
  'Brasil', 'México', 'Argentina', 'Chile', 'Colombia', 'Perú', 'Paraguay', 'Uruguay'
]

const CURRENT_YEAR = new Date().getFullYear()

function normalizeWebsite(website?: string | null): string | null {
  const raw = (website || '').trim()
  if (!raw) return null
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function BrandModal({
  isOpen,
  onClose,
  brand,
  initialName,
  onSave
}: BrandModalProps) {
  const [formData, setFormData] = useState<BrandInsert>({
    name: '',
    description: '',
    website: '',
    country: '',
    founded_year: undefined,
    is_active: true
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Catálogo global: el logo de una marca lo define la plataforma, no cada
  // empresa. Antes el marketplace mostraba la primera imagen cargada por
  // cualquiera como logo de esa marca.
  const [official, setOfficial] = useState<CatalogBrand | null>(null)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogResults, setCatalogResults] = useState<CatalogBrand[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [ownBrand, setOwnBrand] = useState(false)

  useEffect(() => {
    if (!isOpen || ownBrand || official) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoadingCatalog(true)
      try {
        const response = await fetch(`/api/brands/catalog?search=${encodeURIComponent(catalogQuery)}`)
        const payload = await response.json().catch(() => null)
        if (!cancelled) setCatalogResults(payload?.success ? payload.data ?? [] : [])
      } catch {
        if (!cancelled) setCatalogResults([])
      } finally {
        if (!cancelled) setLoadingCatalog(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [isOpen, catalogQuery, ownBrand, official])

  // Initialize form when brand changes
  useEffect(() => {
    const linked = brand?.global_brand_id
      ? { id: brand.global_brand_id, name: brand.name, logo_url: brand.logo_url }
      : null
    setOfficial(linked)
    setOwnBrand(Boolean(brand) && !linked)
    // Con un nombre ya escrito, la búsqueda del catálogo arranca hecha: si esa
    // marca es oficial, aparece sola; si no, el nombre ya está cargado para
    // crearla como propia.
    setCatalogQuery(brand ? '' : (initialName ?? '').trim())
    setCatalogResults([])

    if (brand) {
      setFormData({
        name: brand.name ?? '',
        description: brand.description || '',
        website: brand.website || '',
        country: brand.country || '',
        founded_year: brand.founded_year,
        is_active: ('is_active' in brand ? brand.is_active : undefined) ?? ('isActive' in brand ? brand.isActive : undefined) ?? true
      })
    } else {
      setFormData({
        name: (initialName ?? '').trim(),
        description: '',
        website: '',
        country: '',
        founded_year: undefined,
        is_active: true
      })
    }
    setErrors({})
  }, [brand, isOpen, initialName])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (official) return true

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    } else if (formData.name.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres'
    }

    if (formData.website && !normalizeWebsite(formData.website)) {
      newErrors.website = 'El sitio web no tiene un formato válido'
    }

    if (formData.founded_year && (formData.founded_year < 1800 || formData.founded_year > CURRENT_YEAR)) {
      newErrors.founded_year = `El año debe estar entre 1800 y ${CURRENT_YEAR}`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = <K extends keyof BrandInsert>(field: K, value: BrandInsert[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Por favor corrige los errores en el formulario')
      return
    }

    setIsSubmitting(true)

    try {
      // Clean up data before sending - ensure proper null values
      const dataToSend: BrandInsert = {
        // Con marca oficial, el servidor reemplaza nombre y logo por los del
        // catálogo: acá se manda el vínculo, no una copia.
        global_brand_id: official?.id ?? null,
        name: (official?.name ?? formData.name).trim(),
        description: formData.description?.trim() || null,
        website: normalizeWebsite(formData.website),
        country: formData.country || null,
        founded_year: formData.founded_year || null,
        is_active: formData.is_active ?? true
      }

      const result = await onSave(dataToSend)
      
      if (result.success) {
        toast.success(
          brand 
            ? 'Marca actualizada exitosamente' 
            : 'Marca creada exitosamente'
        )
        onClose()
      } else {
        toast.error(result.error || 'Error al guardar la marca')
        console.error('Error saving brand:', result)
      }
    } catch (error) {
      toast.error('Error al guardar la marca')
      console.error('Exception saving brand:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="w-5 h-5 text-blue-600" />
            {brand ? 'Editar Marca' : 'Agregar Nueva Marca'}
          </DialogTitle>
          <DialogDescription>
            {brand 
              ? 'Modifica la información de la marca'
              : 'Registra una nueva marca para tus productos'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Básico
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Detalles
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Información Básica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Marca oficial: el nombre y el logo salen del catálogo de la plataforma. */}
                  {official ? (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
                      {official.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={official.logo_url} alt="" className="h-10 w-10 rounded-md bg-white object-contain p-1" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-bold">
                          {official.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <BadgeCheck className="h-4 w-4 text-emerald-600" />
                          {official.name}
                        </p>
                        <p className="text-xs text-muted-foreground">Marca oficial: el nombre y el logo los define la plataforma.</p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setOfficial(null); setOwnBrand(false) }}>
                        Cambiar
                      </Button>
                    </div>
                  ) : ownBrand ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="name" className="text-sm font-medium">Nombre de la marca propia *</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setOwnBrand(false)}>
                          Buscar en el catálogo
                        </Button>
                      </div>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Ej: Panadería del barrio"
                        className={cn(errors.name && 'border-red-500')}
                      />
                      <p className="text-xs text-muted-foreground">
                        Se muestra con su inicial. Los logos los carga la plataforma para las marcas del catálogo.
                      </p>
                      {errors.name && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="catalog" className="text-sm font-medium">Marca oficial *</Label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="catalog"
                          value={catalogQuery}
                          onChange={(e) => setCatalogQuery(e.target.value)}
                          placeholder="Buscá la marca: Samsung, Apple, Xiaomi…"
                          className="pl-9"
                          autoComplete="off"
                        />
                      </div>
                      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
                        {loadingCatalog ? (
                          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                          </p>
                        ) : catalogResults.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">
                            No encontramos esa marca en el catálogo.
                          </p>
                        ) : (
                          catalogResults.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { setOfficial(item); handleInputChange('name', item.name) }}
                              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted"
                            >
                              {item.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.logo_url} alt="" className="h-8 w-8 rounded bg-white object-contain p-0.5" />
                              ) : (
                                <span className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-bold">
                                  {item.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                              <span className="text-sm font-medium text-foreground">{item.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                      {/* Crear es a lo que se vino: el botón lo dice con el
                          nombre escrito y no se pierde entre los resultados. */}
                      <Button
                        type="button"
                        className="w-full gap-2"
                        onClick={() => {
                          // Lo que quedó escrito en el buscador es el nombre.
                          const escrito = catalogQuery.trim()
                          if (escrito) handleInputChange('name', escrito)
                          setOwnBrand(true)
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        {(catalogQuery.trim() || formData.name?.trim())
                          ? `Crear «${catalogQuery.trim() || formData.name?.trim()}» como marca propia`
                          : 'No está en el catálogo: crearla como marca propia'}
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      Descripción
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe la marca..."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Información Adicional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-sm font-medium">
                      Sitio Web
                    </Label>
                    <Input
                      id="website"
                      value={formData.website || ''}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder="https://www.ejemplo.com"
                      className={cn(errors.website && 'border-red-500')}
                    />
                    {errors.website && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.website}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        País de Origen
                      </Label>
                      <Select 
                        value={formData.country || ''} 
                        onValueChange={(value) => handleInputChange('country', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar país" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="founded_year" className="text-sm font-medium">
                        Año de Fundación
                      </Label>
                      <Input
                        id="founded_year"
                        type="number"
                        min="1800"
                        max={CURRENT_YEAR}
                        value={formData.founded_year || ''}
                        onChange={(e) => handleInputChange('founded_year', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Ej: 1976"
                        className={cn(errors.founded_year && 'border-red-500')}
                      />
                      {errors.founded_year && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.founded_year}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {brand ? 'Actualizar Marca' : 'Crear Marca'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


