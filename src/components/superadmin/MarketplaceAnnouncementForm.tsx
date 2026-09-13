'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Megaphone, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import { AnnouncementImagesField } from '@/components/announcements/AnnouncementImagesField'
import { isAnnouncementLive, type Announcement } from '@/lib/announcements/announcement'

export function MarketplaceAnnouncementForm({ initial }: { initial: Announcement }) {
  const [form, setForm] = useState<Announcement>(initial)
  const [saving, setSaving] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  const set = <K extends keyof Announcement>(field: K, value: Announcement[K]) =>
    setForm((current) => ({ ...current, [field]: value }))

  // Las imagenes se suben al mismo bucket que los assets de marca, que ya tiene
  // su listado y su borrado en el panel.
  const uploadAnnouncementImage = async (file: File) => {
    const body = new FormData()
    body.append('file', file)
    body.append('assetType', 'announcement')
    const res = await fetch('/api/superadmin/platform-branding/logo', { method: 'POST', body })
    const payload = await res.json().catch(() => null)
    if (!res.ok || !payload?.success || !payload.url) {
      throw new Error(payload?.error || 'No se pudo subir la imagen.')
    }
    return String(payload.url)
  }

  const live = isAnnouncementLive(form, new Date())

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/superadmin/marketplace-announcement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: form }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo guardar el aviso.')
      }
      setForm(payload.announcement as Announcement)
      toast.success('Aviso guardado', {
        description: form.enabled
          ? 'Ya se muestra al entrar al marketplace.'
          : 'Queda guardado, pero apagado: nadie lo ve.',
      })
    } catch (error) {
      toast.error('No se pudo guardar', {
        description: error instanceof Error ? error.message : 'Intentá nuevamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
            <Link href="/superadmin/web-content">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Contenido web
            </Link>
          </Button>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Megaphone aria-hidden="true" className="h-5 w-5 text-primary" />
            Aviso del marketplace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Un cartel que aparece al entrar a <span className="font-medium text-foreground">/marketplace</span>.
            Cada visitante lo ve una vez por día; si lo editás, vuelve a aparecer.
          </p>
        </div>
        <Button type="button" onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
          Guardar
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Mostrar el aviso</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {live
                ? 'Está activo: los visitantes lo ven.'
                : form.enabled
                  ? 'Está activado, pero no se muestra: falta texto o está fuera de las fechas.'
                  : 'Apagado: nadie lo ve.'}
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(checked) => set('enabled', checked)}
            aria-label="Mostrar el aviso en el marketplace"
          />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contenido</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="announcement-title">Título</Label>
            <Input
              id="announcement-title"
              value={form.title}
              maxLength={120}
              onChange={(event) => set('title', event.target.value)}
              placeholder="Semana de descuentos"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement-message">Mensaje</Label>
            <Textarea
              id="announcement-message"
              value={form.message}
              maxLength={600}
              rows={4}
              onChange={(event) => set('message', event.target.value)}
              placeholder="Del 15 al 20 encontrás descuentos en todas las tiendas."
            />
          </div>

          <AnnouncementImagesField
            value={form.images}
            onChange={(images) => set('images', images)}
            upload={uploadAnnouncementImage}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="announcement-cta-label">Texto del botón (opcional)</Label>
              <Input
                id="announcement-cta-label"
                value={form.ctaLabel}
                maxLength={60}
                onChange={(event) => set('ctaLabel', event.target.value)}
                placeholder="Ver ofertas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-cta-href">Enlace del botón</Label>
              <Input
                id="announcement-cta-href"
                value={form.ctaHref}
                maxLength={500}
                onChange={(event) => set('ctaHref', event.target.value)}
                placeholder="/marketplace/productos"
              />
              <p className="text-xs text-muted-foreground">Una ruta del sitio (/marketplace/productos) o una URL completa.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="announcement-starts">Desde (opcional)</Label>
              <Input
                id="announcement-starts"
                type="date"
                value={form.startsAt}
                onChange={(event) => set('startsAt', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-ends">Hasta (opcional)</Label>
              <Input
                id="announcement-ends"
                type="date"
                value={form.endsAt}
                onChange={(event) => set('endsAt', event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Sin fechas, se muestra mientras esté activado.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Vista previa</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Así lo ve un visitante, sin guardar.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setPreviewKey((key) => key + 1)} disabled={!form.title.trim()}>
            Ver el cartel
          </Button>
        </CardHeader>
      </Card>

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
