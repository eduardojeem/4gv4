'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Save, Sparkles, TrendingUp, Check } from 'lucide-react'
import { HeroContent, HeroStats } from '@/types/website-settings'

export function HeroEditor() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null)
  const [heroStats, setHeroStats] = useState<HeroStats | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings?.hero_content) {
      setHeroContent(settings.hero_content)
    }
  }, [settings?.hero_content])

  useEffect(() => {
    if (settings?.hero_stats) {
      setHeroStats(settings.hero_stats)
    }
  }, [settings?.hero_stats])

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!heroContent) return

    const result = await updateSetting('hero_content', heroContent)
    if (result.success) {
      toast.success('Contenido del Hero actualizado', {
        icon: <Check className="h-4 w-4" />
      })
      setHasChanges(false)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleSaveStats = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!heroStats) return

    const result = await updateSetting('hero_stats', heroStats)
    if (result.success) {
      toast.success('Estadísticas actualizadas', {
        icon: <Check className="h-4 w-4" />
      })
      setHasChanges(false)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Cargando contenido...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-red-600">
        Error al cargar contenido: {error}
      </div>
    )
  }

  if (!heroContent || !heroStats) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No se encontró contenido configurado.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero Content */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Contenido del Hero</CardTitle>
              <CardDescription>Textos principales de la sección hero</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveContent} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="badge">Badge Superior</Label>
              <Input
                id="badge"
                value={heroContent.badge}
                onChange={(e) => {
                  setHeroContent({ ...heroContent, badge: e.target.value })
                  setHasChanges(true)
                }}
                placeholder="✨ Más de 10 años de experiencia"
                maxLength={100}
                className="border-gray-200 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título Principal</Label>
              <Input
                id="title"
                value={heroContent.title}
                onChange={(e) => {
                  setHeroContent({ ...heroContent, title: e.target.value })
                  setHasChanges(true)
                }}
                placeholder="Reparación de celulares rápida y confiable"
                maxLength={150}
                className="border-gray-200 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtítulo</Label>
              <Textarea
                id="subtitle"
                value={heroContent.subtitle}
                onChange={(e) => {
                  setHeroContent({ ...heroContent, subtitle: e.target.value })
                  setHasChanges(true)
                }}
                placeholder="Diagnóstico gratuito • Garantía de 6 meses • Técnicos certificados"
                rows={2}
                maxLength={300}
                className="border-gray-200 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <Button 
              type="submit" 
              disabled={isSaving || !hasChanges}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Contenido
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Estadísticas</CardTitle>
              <CardDescription>Números mostrados en la sección hero</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveStats} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="repairs">Reparaciones</Label>
                <Input
                  id="repairs"
                  value={heroStats.repairs}
                  onChange={(e) => {
                    setHeroStats({ ...heroStats, repairs: e.target.value })
                    setHasChanges(true)
                  }}
                  placeholder="10K+"
                  maxLength={20}
                  className="border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="satisfaction">Satisfacción</Label>
                <Input
                  id="satisfaction"
                  value={heroStats.satisfaction}
                  onChange={(e) => {
                    setHeroStats({ ...heroStats, satisfaction: e.target.value })
                    setHasChanges(true)
                  }}
                  placeholder="98%"
                  maxLength={20}
                  className="border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avgTime">Tiempo Promedio</Label>
                <Input
                  id="avgTime"
                  value={heroStats.avgTime}
                  onChange={(e) => {
                    setHeroStats({ ...heroStats, avgTime: e.target.value })
                    setHasChanges(true)
                  }}
                  placeholder="24-48h"
                  maxLength={20}
                  className="border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSaving || !hasChanges}
              className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Estadísticas
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
