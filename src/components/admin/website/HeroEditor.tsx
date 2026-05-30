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
  const hasChanges = heroContentDraft !== null || heroStatsDraft !== null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasChanges) return

    const tasks: Promise<{ success: boolean; error?: string }>[] = []
    if (heroContentDraft !== null) tasks.push(updateSetting('hero_content', heroContent))
    if (heroStatsDraft !== null) tasks.push(updateSetting('hero_stats', heroStats))

    const results = await Promise.all(tasks)
    const failed = results.find(r => !r.success)

    if (failed) {
      toast.error(failed.error || 'Error al guardar')
      return
    }

    toast.success('Hero actualizado', { icon: <Check className="h-4 w-4" /> })
    setHeroContentDraft(null)
    setHeroStatsDraft(null)
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
    <form onSubmit={handleSave} className="space-y-6 pb-20 md:pb-0">
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
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="badge" className="text-sm font-medium">Badge Superior</Label>
            <Input
              id="badge"
              value={heroContent.badge}
              onChange={(e) => setHeroContentDraft(c => ({ ...(c ?? heroContent), badge: e.target.value }))}
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
              onChange={(e) => setHeroContentDraft(c => ({ ...(c ?? heroContent), title: e.target.value }))}
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
              onChange={(e) => setHeroContentDraft(c => ({ ...(c ?? heroContent), subtitle: e.target.value }))}
              placeholder="Diagnóstico gratuito • Garantía de 6 meses • Técnicos certificados"
              rows={2}
              maxLength={300}
              className="border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-sm"
            />
          </div>
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
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="repairs" className="text-sm font-medium">Reparaciones</Label>
              <Input
                id="repairs"
                value={heroStats.repairs}
                onChange={(e) => setHeroStatsDraft(s => ({ ...(s ?? heroStats), repairs: e.target.value }))}
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
                onChange={(e) => setHeroStatsDraft(s => ({ ...(s ?? heroStats), satisfaction: e.target.value }))}
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
                onChange={(e) => setHeroStatsDraft(s => ({ ...(s ?? heroStats), avgTime: e.target.value }))}
                placeholder="24-48h"
                maxLength={20}
                className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 h-11"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón único */}
      <div className="fixed bottom-6 right-6 md:sticky md:bottom-6 md:flex md:justify-end z-50">
        <Button
          type="submit"
          disabled={isSaving || !hasChanges}
          size="lg"
          className="shadow-2xl bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-700 hover:to-orange-600 transition-all duration-300 rounded-full md:rounded-xl px-8 md:px-6 h-14 md:h-12"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="hidden md:inline">Guardando...</span>
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              <span className="hidden md:inline">Guardar Hero</span>
              <span className="md:hidden">Guardar</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
