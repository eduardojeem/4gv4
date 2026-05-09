'use client'

import { useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Save, Sparkles, TrendingUp, Check } from 'lucide-react'
import { HeroContent, HeroStats } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

export function HeroEditor() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const defaults = getWebsiteSettingsDefaults()
  const [heroContentDraft, setHeroContentDraft] = useState<HeroContent | null>(null)
  const [heroStatsDraft, setHeroStatsDraft] = useState<HeroStats | null>(null)
  const heroContent = heroContentDraft ?? settings?.hero_content ?? defaults.hero_content
  const heroStats = heroStatsDraft ?? settings?.hero_stats ?? defaults.hero_stats
  const hasContentChanges = heroContentDraft !== null
  const hasStatsChanges = heroStatsDraft !== null

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault()

    const result = await updateSetting('hero_content', heroContent)
    if (result.success) {
      toast.success('Contenido del Hero actualizado', {
        icon: <Check className="h-4 w-4" />
      })
      setHeroContentDraft(null)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleSaveStats = async (e: React.FormEvent) => {
    e.preventDefault()

    const result = await updateSetting('hero_stats', heroStats)
    if (result.success) {
      toast.success('Estadísticas actualizadas', {
        icon: <Check className="h-4 w-4" />
      })
      setHeroStatsDraft(null)
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

  return (
    <div className="space-y-6">
      {/* Hero Content */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Contenido del Hero</CardTitle>
              <CardDescription className="text-xs md:text-sm">Textos principales de la sección hero</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveContent} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="badge" className="text-sm font-medium">Badge Superior</Label>
                <Input
                  id="badge"
                  value={heroContent.badge}
                  onChange={(e) => {
                    setHeroContentDraft((current) => ({
                      ...(current ?? heroContent),
                      badge: e.target.value
                    }))
                  }}
                  placeholder="✨ Más de 10 años de experiencia"
                maxLength={100}
                className="border-gray-200 focus:border-purple-500 focus:ring-purple-500 h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">Título Principal</Label>
                <Input
                  id="title"
                  value={heroContent.title}
                  onChange={(e) => {
                    setHeroContentDraft((current) => ({
                      ...(current ?? heroContent),
                      title: e.target.value
                    }))
                  }}
                  placeholder="Reparación de celulares rápida y confiable"
                maxLength={150}
                className="border-gray-200 focus:border-purple-500 focus:ring-purple-500 h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle" className="text-sm font-medium">Subtítulo</Label>
                <Textarea
                  id="subtitle"
                  value={heroContent.subtitle}
                  onChange={(e) => {
                    setHeroContentDraft((current) => ({
                      ...(current ?? heroContent),
                      subtitle: e.target.value
                    }))
                  }}
                  placeholder="Diagnóstico gratuito • Garantía de 6 meses • Técnicos certificados"
                rows={2}
                maxLength={300}
                className="border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-sm"
              />
            </div>

            <Button 
              type="submit" 
              disabled={isSaving || !hasContentChanges}
              className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-11 px-8"
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
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Estadísticas</CardTitle>
              <CardDescription className="text-xs md:text-sm">Números mostrados en la sección hero</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveStats} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="repairs" className="text-sm font-medium">Reparaciones</Label>
                <Input
                  id="repairs"
                  value={heroStats.repairs}
                  onChange={(e) => {
                    setHeroStatsDraft((current) => ({
                      ...(current ?? heroStats),
                      repairs: e.target.value
                    }))
                  }}
                  placeholder="10K+"
                  maxLength={20}
                  className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="satisfaction" className="text-sm font-medium">Satisfacción</Label>
                <Input
                  id="satisfaction"
                  value={heroStats.satisfaction}
                  onChange={(e) => {
                    setHeroStatsDraft((current) => ({
                      ...(current ?? heroStats),
                      satisfaction: e.target.value
                    }))
                  }}
                  placeholder="98%"
                  maxLength={20}
                  className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avgTime" className="text-sm font-medium">Tiempo Promedio</Label>
                <Input
                  id="avgTime"
                  value={heroStats.avgTime}
                  onChange={(e) => {
                    setHeroStatsDraft((current) => ({
                      ...(current ?? heroStats),
                      avgTime: e.target.value
                    }))
                  }}
                  placeholder="24-48h"
                  maxLength={20}
                  className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 h-11"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSaving || !hasStatsChanges}
              className="w-full md:w-auto bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 h-11 px-8"
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
