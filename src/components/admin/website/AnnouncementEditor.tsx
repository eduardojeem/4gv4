'use client'

import { useState } from 'react'
import { Loader2, Megaphone, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { isAnnouncementLive, normalizeAnnouncement, type Announcement } from '@/lib/announcements/announcement'

/**
 * El cartel que ve el cliente al entrar a la tienda. Mismo comportamiento que
 * el del marketplace: una vez por dia por visitante, y si lo editas vuelve a
 * aparecer.
 */
export function AnnouncementEditor() {
  const { settings, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [draft, setDraft] = useState<Announcement | null>(null)
  const [previewKey, setPreviewKey] = useState(0)

  const form = draft ?? normalizeAnnouncement(settings?.announcement)
  const set = <K extends keyof Announcement>(field: K, value: Announcement[K]) =>
    setDraft({ ...form, [field]: value })

  const live = isAnnouncementLive(form, new Date())

  const save = async () => {
    if (form.enabled && (!form.title.trim() || !form.message.trim())) {
      toast.error('Falta contenido', { description: 'Un aviso activo necesita título y mensaje.' })
      return
    }
    // `updatedAt` cambia con cada guardado: quien ya lo habia cerrado vuelve a verlo.
    const value = { ...form, updatedAt: new Date().toISOString() }
    const res = await updateSetting('announcement', value)
    if (res?.success === false) {
      toast.error('No se pudo guardar', { description: res.error || 'Intentá nuevamente.' })
      return
    }
    setDraft(value)
    toast.success('Aviso guardado', {
      description: value.enabled ? 'Ya se muestra al entrar a tu tienda.' : 'Queda guardado, pero apagado.',
    })
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone aria-hidden="true" className="h-4 w-4 text-primary" />
              Mostrar el aviso
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {live
                ? 'Está activo: tus clientes lo ven al entrar.'
                : form.enabled
                  ? 'Está activado, pero no se muestra: falta texto o está fuera de las fechas.'
                  : 'Apagado: nadie lo ve.'}
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(checked) => set('enabled', checked)}
            aria-label="Mostrar el aviso en la tienda"
          />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contenido</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="store-announcement-title">Título</Label>
            <Input
              id="store-announcement-title"
              value={form.title}
              maxLength={120}
              onChange={(event) => set('title', event.target.value)}
              placeholder="Cerramos por inventario"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-announcement-message">Mensaje</Label>
            <Textarea
              id="store-announcement-message"
              value={form.message}
              maxLength={600}
              rows={4}
              onChange={(event) => set('message', event.target.value)}
              placeholder="El sábado atendemos de 8 a 12. Los pedidos online se entregan el lunes."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-announcement-image">Imagen (opcional)</Label>
            <Input
              id="store-announcement-image"
              value={form.imageUrl}
              maxLength={500}
              onChange={(event) => set('imageUrl', event.target.value)}
              placeholder="https://…/banner.jpg"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="store-announcement-cta-label">Texto del botón (opcional)</Label>
              <Input
                id="store-announcement-cta-label"
                value={form.ctaLabel}
                maxLength={60}
                onChange={(event) => set('ctaLabel', event.target.value)}
                placeholder="Ver ofertas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-announcement-cta-href">Enlace del botón</Label>
              <Input
                id="store-announcement-cta-href"
                value={form.ctaHref}
                maxLength={500}
                onChange={(event) => set('ctaHref', event.target.value)}
                placeholder="/ofertas"
              />
              <p className="text-xs text-muted-foreground">Una ruta de tu tienda (/ofertas) o una URL completa.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="store-announcement-starts">Desde (opcional)</Label>
              <Input
                id="store-announcement-starts"
                type="date"
                value={form.startsAt}
                onChange={(event) => set('startsAt', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-announcement-ends">Hasta (opcional)</Label>
              <Input
                id="store-announcement-ends"
                type="date"
                value={form.endsAt}
                onChange={(event) => set('endsAt', event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Sin fechas, se muestra mientras esté activado.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreviewKey((key) => key + 1)}
          disabled={!form.title.trim()}
        >
          Ver el cartel
        </Button>
        <Button type="button" onClick={save} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
          Guardar
        </Button>
      </div>

      {previewKey > 0 && (
        <AnnouncementModal
          key={previewKey}
          scope={`preview-${previewKey}`}
          announcement={{ ...form, enabled: true, startsAt: '', endsAt: '', updatedAt: `preview-${previewKey}` }}
        />
      )}
    </div>
  )
}
