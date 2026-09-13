'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, Loader2, Megaphone, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import { AnnouncementImagesField } from '@/components/announcements/AnnouncementImagesField'
import { cn } from '@/lib/utils'
import {
  EMPTY_ANNOUNCEMENT,
  announcementStatus,
  isAnnouncementLive,
  type Announcement,
  type AnnouncementStatus,
} from '@/lib/announcements/announcement'

const STATUS_STYLE: Record<AnnouncementStatus, { label: string; className: string }> = {
  activo: { label: 'Se está mostrando', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  programado: { label: 'Programado', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  vencido: { label: 'Vencido', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  incompleto: { label: 'Falta texto', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  apagado: { label: 'Apagado', className: 'bg-muted text-muted-foreground' },
}

function describeDates(announcement: Announcement) {
  if (announcement.startsAt && announcement.endsAt) return `Del ${announcement.startsAt} al ${announcement.endsAt}`
  if (announcement.startsAt) return `Desde el ${announcement.startsAt}`
  if (announcement.endsAt) return `Hasta el ${announcement.endsAt}`
  return 'Sin fechas'
}

function newAnnouncement(): Announcement {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `aviso-${Date.now()}`
  return { ...EMPTY_ANNOUNCEMENT, id, images: [] }
}

/** Lo que se compara para saber si un aviso cambió: todo menos su version. */
function contentOf(announcement: Announcement) {
  const { updatedAt: _updatedAt, ...content } = announcement
  return JSON.stringify(content)
}

/**
 * La lista de avisos cargados, con su estado, y el formulario para editar el
 * que se elija. La usan el superadmin (marketplace) y cada tienda; cambian el
 * tope, a donde se suben las imagenes y como se guarda.
 */
export function AnnouncementsManager({
  initial,
  max,
  audience,
  previewScope,
  upload,
  onSave,
}: {
  initial: Announcement[]
  max: number
  /** Donde se ve el aviso, para los textos: «el marketplace», «tu tienda». */
  audience: string
  previewScope: string
  upload: (file: File) => Promise<string>
  onSave: (announcements: Announcement[]) => Promise<Announcement[] | void>
}) {
  const [items, setItems] = useState<Announcement[]>(initial)
  const [saved, setSaved] = useState<Announcement[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [saving, setSaving] = useState(false)

  const now = useMemo(() => new Date(), [])
  const liveCount = items.filter((item) => isAnnouncementLive(item, now)).length
  const dirty = JSON.stringify(items.map(contentOf)) !== JSON.stringify(saved.map(contentOf))
  const editing = items.find((item) => item.id === editingId) ?? null

  const update = (id: string, patch: Partial<Announcement>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setItems(next)
  }

  const add = () => {
    if (items.length >= max) {
      toast.error(`Se pueden cargar hasta ${max} avisos`)
      return
    }
    const created = newAnnouncement()
    setItems((current) => [...current, created])
    setEditingId(created.id)
  }

  const remove = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const save = async () => {
    const incomplete = items.find((item) => item.enabled && (!item.title.trim() || !item.message.trim()))
    if (incomplete) {
      toast.error('Falta contenido', { description: 'Un aviso activado necesita título y mensaje.' })
      setEditingId(incomplete.id)
      return
    }

    // Se sella la version solo de los que cambiaron: los demas no vuelven a
    // aparecerle a quien ya los habia cerrado.
    const stamp = new Date().toISOString()
    const previous = new Map(saved.map((item) => [item.id, contentOf(item)]))
    const payload = items.map((item) =>
      previous.get(item.id) === contentOf(item) ? item : { ...item, updatedAt: stamp },
    )

    setSaving(true)
    try {
      const result = await onSave(payload)
      const next = Array.isArray(result) ? result : payload
      setItems(next)
      setSaved(next)
      toast.success('Avisos guardados', {
        description: next.some((item) => isAnnouncementLive(item, new Date()))
          ? `Ya se muestra al entrar a ${audience}.`
          : 'Ninguno está activo por ahora.',
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? 'No hay avisos cargados.'
              : `${items.length} de ${max} avisos cargados${liveCount > 0 ? `, ${liveCount} vigente${liveCount > 1 ? 's' : ''}` : ''}.`}
          </p>
          {liveCount > 1 && (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              Hay {liveCount} avisos vigentes a la vez: se muestra el primero de la lista. Movelo con las flechas
              para elegir cuál.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={add} disabled={items.length >= max} className="gap-2">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Nuevo aviso
          </Button>
          <Button type="button" onClick={save} disabled={saving || !dirty} className="gap-2">
            {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>

      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Cargá un aviso para anunciar una campaña, un horario especial o una novedad en {audience}.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item, index) => {
          const status = announcementStatus(item, now)
          const style = STATUS_STYLE[status]
          const isEditing = editingId === item.id

          return (
            <li key={item.id}>
              <Card className={cn(isEditing && 'border-primary/50')}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <Megaphone aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.title.trim() || 'Aviso sin título'}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', style.className)}>
                        {style.label}
                      </span>
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {describeDates(item)}
                      {item.images.length > 0 && ` · ${item.images.length} imagen${item.images.length > 1 ? 'es' : ''}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={(checked) => update(item.id, { enabled: checked })}
                      aria-label={`Mostrar el aviso ${item.title.trim() || index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === 0}
                      aria-label={`Subir el aviso ${index + 1} de posición`}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === items.length - 1}
                      aria-label={`Bajar el aviso ${index + 1} de posición`}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Ver el aviso ${item.title.trim() || index + 1}`}
                      disabled={!item.title.trim()}
                      onClick={() => {
                        setPreviewId(item.id)
                        setPreviewKey((key) => key + 1)
                      }}
                    >
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      aria-label={`Eliminar el aviso ${item.title.trim() || index + 1}`}
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={isEditing ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setEditingId(isEditing ? null : item.id)}
                    >
                      {isEditing ? 'Listo' : 'Editar'}
                    </Button>
                  </div>
                </CardHeader>

                {isEditing && (
                  <CardContent className="grid gap-4 border-t border-border/60 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor={`announcement-title-${item.id}`}>Título</Label>
                      <Input
                        id={`announcement-title-${item.id}`}
                        value={item.title}
                        maxLength={120}
                        onChange={(event) => update(item.id, { title: event.target.value })}
                        placeholder="Semana de descuentos"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`announcement-message-${item.id}`}>Mensaje</Label>
                      <Textarea
                        id={`announcement-message-${item.id}`}
                        value={item.message}
                        maxLength={600}
                        rows={4}
                        onChange={(event) => update(item.id, { message: event.target.value })}
                        placeholder="Del 15 al 20 hay precios especiales."
                      />
                    </div>

                    <AnnouncementImagesField
                      value={item.images}
                      onChange={(images) => update(item.id, { images })}
                      upload={upload}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`announcement-cta-label-${item.id}`}>Texto del botón (opcional)</Label>
                        <Input
                          id={`announcement-cta-label-${item.id}`}
                          value={item.ctaLabel}
                          maxLength={60}
                          onChange={(event) => update(item.id, { ctaLabel: event.target.value })}
                          placeholder="Ver ofertas"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`announcement-cta-href-${item.id}`}>Enlace del botón</Label>
                        <Input
                          id={`announcement-cta-href-${item.id}`}
                          value={item.ctaHref}
                          maxLength={500}
                          onChange={(event) => update(item.id, { ctaHref: event.target.value })}
                          placeholder="/ofertas"
                        />
                        <p className="text-xs text-muted-foreground">Una ruta del sitio o una URL completa.</p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`announcement-starts-${item.id}`}>Desde (opcional)</Label>
                        <Input
                          id={`announcement-starts-${item.id}`}
                          type="date"
                          value={item.startsAt}
                          onChange={(event) => update(item.id, { startsAt: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`announcement-ends-${item.id}`}>Hasta (opcional)</Label>
                        <Input
                          id={`announcement-ends-${item.id}`}
                          type="date"
                          value={item.endsAt}
                          onChange={(event) => update(item.id, { endsAt: event.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">Sin fechas, se muestra mientras esté activado.</p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      {items.length >= max && (
        <p className="text-xs text-muted-foreground">
          Llegaste al máximo de {max} avisos. Eliminá uno para cargar otro.
        </p>
      )}

      {previewKey > 0 && previewId && (
        <AnnouncementModal
          key={previewKey}
          scope={`${previewScope}-preview-${previewKey}`}
          announcement={(() => {
            const item = items.find((entry) => entry.id === previewId)
            if (!item) return null
            return { ...item, enabled: true, startsAt: '', endsAt: '', updatedAt: `preview-${previewKey}` }
          })()}
        />
      )}
    </div>
  )
}
