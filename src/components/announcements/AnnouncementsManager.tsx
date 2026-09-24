import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Eye, Loader2, Megaphone, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import { AnnouncementImagesField } from '@/components/announcements/AnnouncementImagesField'
import { cn } from '@/lib/utils'
import {
  EMPTY_ANNOUNCEMENT,
  announcementStatus,
  isAnnouncementLive,
  type Announcement,
  type AnnouncementBadgeVariant,
  type AnnouncementCarouselAnimation,
  type AnnouncementFrequency,
  type AnnouncementImageBackdrop,
  type AnnouncementImageEffect,
  type AnnouncementImageFit,
  type AnnouncementStatus,
} from '@/lib/announcements/announcement'

const IMAGE_BACKDROP_OPTIONS: Array<{
  value: AnnouncementImageBackdrop
  label: string
  description: string
}> = [
  { value: 'ambient', label: 'Ambiental suave', description: 'Difumina los colores de la foto con estilo cinemático' },
  { value: 'dark', label: 'Fondo oscuro', description: 'Contraste limpio y moderno con fondo negro' },
  { value: 'tinted', label: 'Tinte temático', description: 'Armonizado con el color seleccionado de la tarjeta' },
  { value: 'light', label: 'Fondo claro', description: 'Ideal para imágenes con fondo blanco o PNG transparente' },
]

const IMAGE_FIT_OPTIONS: Array<{
  value: AnnouncementImageFit
  label: string
  description: string
}> = [
  { value: 'contain', label: 'Completa sin cortes', description: 'Conserva la imagen entera sin recortar textos ni detalles' },
  { value: 'cover', label: 'Relleno panorámico', description: 'Cubre todo el marco de borde a borde' },
]

const IMAGE_EFFECT_OPTIONS: Array<{
  value: AnnouncementImageEffect
  label: string
  description: string
}> = [
  { value: 'zoom', label: 'Zoom suave', description: 'Micro-acercamiento dinámico al interactuar' },
  { value: 'glow', label: 'Resplandor', description: 'Realce de brillo y aura luminosa' },
  { value: 'none', label: 'Estático', description: 'Imagen fija sin efectos en hover' },
]

const CAROUSEL_ANIMATION_OPTIONS: Array<{
  value: AnnouncementCarouselAnimation
  label: string
  description: string
}> = [
  { value: 'slide', label: 'Deslizar', description: 'Transición horizontal fluida' },
  { value: 'fade', label: 'Desvanecer', description: 'Cross-fade suave entre fotos' },
  { value: 'zoom', label: 'Zoom suave', description: 'Enfoque cinemático moderno' },
]

const CAROUSEL_SPEED_OPTIONS = [
  { value: 3, label: '3 segundos', description: 'Dinámico y ágil (recomendado)' },
  { value: 5, label: '5 segundos', description: 'Lectura pausada' },
  { value: 0, label: 'Solo manual', description: 'Sin rotación automática' },
]

const BADGE_PRESETS = [
  '✨ Novedad destacada',
  '🔥 Oferta especial',
  '🚀 Nuevo lanzamiento',
  '📢 Aviso importante',
  '🎉 Promoción',
  '⚡ Solo por hoy',
]

const BADGE_COLOR_OPTIONS: Array<{
  value: AnnouncementBadgeVariant
  label: string
  dotClass: string
  badgeClass: string
}> = [
  { value: 'primary', label: 'Azul / Marca', dotClass: 'bg-primary', badgeClass: 'border-primary/30 bg-primary/10 text-primary' },
  { value: 'amber', label: 'Ámbar / Alerta', dotClass: 'bg-amber-500', badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { value: 'emerald', label: 'Verde / Éxito', dotClass: 'bg-emerald-500', badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { value: 'purple', label: 'Púrpura / Novedad', dotClass: 'bg-purple-500', badgeClass: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { value: 'rose', label: 'Rosa / Exclusivo', dotClass: 'bg-rose-500', badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  { value: 'cyan', label: 'Cian / Celeste', dotClass: 'bg-cyan-500', badgeClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  { value: 'indigo', label: 'Índigo / Noche', dotClass: 'bg-indigo-500', badgeClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  { value: 'orange', label: 'Naranja / Flash', dotClass: 'bg-orange-500', badgeClass: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { value: 'teal', label: 'Turquesa / Aqua', dotClass: 'bg-teal-500', badgeClass: 'border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  { value: 'slate', label: 'Grafito / Minimal', dotClass: 'bg-slate-500', badgeClass: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400' },
]

const FREQUENCY_OPTIONS: Array<{
  value: AnnouncementFrequency
  label: string
  badge: string
  description: string
}> = [
  {
    value: 'once_per_day',
    label: 'Una vez al día',
    badge: 'Recomendado',
    description: 'Si el visitante cierra el cartel hoy, no le vuelve a aparecer hasta mañana.',
  },
  {
    value: 'always',
    label: 'Cada vez que actualiza o entra',
    badge: 'Siempre visible',
    description: 'Aparece en cada recarga de página o nueva visita, ideal para alertas o promos flash.',
  },
  {
    value: 'once_per_session',
    label: 'Una vez por sesión',
    badge: 'Por pestaña',
    description: 'Aparece una sola vez mientras el visitante mantenga la pestaña o sesión abierta.',
  },
]

const DURATION_OPTIONS = [
  { value: 5, label: '5 segundos', description: 'Recomendado (cierre dinámico)' },
  { value: 10, label: '10 segundos', description: 'Mayor tiempo de lectura' },
  { value: 15, label: '15 segundos', description: 'Para mensajes extensos' },
  { value: 0, label: 'Sin límite', description: 'Solo si el usuario lo cierra' },
]

function describeFrequency(frequency?: AnnouncementFrequency) {
  if (frequency === 'always') return 'Cada recarga'
  if (frequency === 'once_per_session') return 'Por sesión'
  return 'Una vez al día'
}

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
  const [deletingItem, setDeletingItem] = useState<Announcement | null>(null)
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
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{describeDates(item)}</span>
                      <span>·</span>
                      <span className="font-medium text-foreground/80">{describeFrequency(item.frequency)}</span>
                      <span>·</span>
                      <span>{(item.autoCloseSeconds ?? 5) === 0 ? 'Sin auto-cierre' : `${item.autoCloseSeconds ?? 5}s en pantalla`}</span>
                      {item.images.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{item.images.length} imagen{item.images.length > 1 ? 'es' : ''}</span>
                        </>
                      )}
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
                      title="Previsualizar aviso"
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
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      aria-label={`Eliminar el aviso ${item.title.trim() || index + 1}`}
                      onClick={() => setDeletingItem(item)}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={isEditing ? 'secondary' : 'outline'}
                      size="sm"
                      className="gap-1.5 font-medium"
                      aria-label={`${isEditing ? 'Cerrar edición de' : 'Editar'} aviso ${item.title.trim() || index + 1}`}
                      onClick={() => setEditingId(isEditing ? null : item.id)}
                    >
                      {isEditing ? (
                        <>
                          <Check aria-hidden="true" className="h-3.5 w-3.5" />
                          Listo
                        </>
                      ) : (
                        <>
                          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                          Editar aviso
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>

                {isEditing && (
                  <CardContent className="grid gap-5 border-t border-border/60 pt-4">
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

                    {/* Personalización visual y etiqueta destacada */}
                    <div className="space-y-3.5 rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4">
                      <div className="flex flex-col gap-1">
                        <Label className="text-sm font-semibold text-foreground">Etiqueta destacada y estilo visual</Label>
                        <p className="text-xs text-muted-foreground">
                          Personalizá la insignia superior y el color temático del cartel.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`announcement-badge-label-${item.id}`} className="text-xs font-medium text-foreground/80">
                            Texto de la etiqueta
                          </Label>
                          <span className="text-[11px] text-muted-foreground">Máx. 40 car.</span>
                        </div>
                        <Input
                          id={`announcement-badge-label-${item.id}`}
                          value={item.badgeLabel ?? 'Novedad destacada'}
                          maxLength={40}
                          onChange={(event) => update(item.id, { badgeLabel: event.target.value })}
                          placeholder="Novedad destacada"
                        />
                        {/* Chips con sugerencias rápidas */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] font-medium text-muted-foreground">Sugerencias:</span>
                          {BADGE_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => update(item.id, { badgeLabel: preset })}
                              className="rounded-md border border-border/60 bg-card px-2 py-0.5 text-[11px] text-foreground/80 transition-colors hover:border-primary/50 hover:bg-muted"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        <Label className="text-xs font-medium text-foreground/80">Color temático de la etiqueta</Label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          {BADGE_COLOR_OPTIONS.map((color) => {
                            const currentVariant = item.badgeVariant ?? 'primary'
                            const isSelected = currentVariant === color.value
                            return (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => update(item.id, { badgeVariant: color.value })}
                                className={cn(
                                  'flex items-center gap-2 rounded-lg border p-2 text-left transition-all',
                                  isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                    : 'border-border/70 bg-card hover:bg-muted/40',
                                )}
                              >
                                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', color.dotClass)} />
                                <span className="text-xs font-medium text-foreground truncate">{color.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <Label htmlFor={`announcement-note-${item.id}`} className="text-xs font-medium text-foreground/80">
                          Aclaración o texto al pie (opcional)
                        </Label>
                        <Input
                          id={`announcement-note-${item.id}`}
                          value={item.highlightNote ?? ''}
                          maxLength={120}
                          onChange={(event) => update(item.id, { highlightNote: event.target.value })}
                          placeholder="Ej: * Válido hasta agotar stock o por tiempo limitado"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Aparece como texto sutil al pie del cartel.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Frecuencia de aparición</Label>
                        <span className="text-xs text-muted-foreground">¿Cuándo se muestra el cartel?</span>
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {FREQUENCY_OPTIONS.map((option) => {
                          const isSelected = (item.frequency ?? 'once_per_day') === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => update(item.id, { frequency: option.value })}
                              className={cn(
                                'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all',
                                isSelected
                                  ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary'
                                  : 'border-border/70 bg-card hover:border-border hover:bg-muted/40',
                              )}
                            >
                              <div className="flex w-full items-center justify-between gap-1.5">
                                <span className="text-xs font-semibold text-foreground">{option.label}</span>
                                {isSelected && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" />}
                              </div>
                              {option.badge && (
                                <span
                                  className={cn(
                                    'mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                                    isSelected
                                      ? 'bg-primary/15 text-primary'
                                      : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {option.badge}
                                </span>
                              )}
                              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                                {option.description}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Tiempo en pantalla (auto-cierre)</Label>
                        <span className="text-xs text-muted-foreground">¿Cuánto tiempo dura antes de cerrarse solo?</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        {DURATION_OPTIONS.map((dur) => {
                          const currentVal = item.autoCloseSeconds ?? 5
                          const isSelected = currentVal === dur.value
                          return (
                            <button
                              key={dur.value}
                              type="button"
                              onClick={() => update(item.id, { autoCloseSeconds: dur.value })}
                              className={cn(
                                'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                                isSelected
                                  ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary'
                                  : 'border-border/70 bg-card hover:border-border hover:bg-muted/40',
                              )}
                            >
                              <div className="flex w-full items-center justify-between">
                                <span className="text-xs font-semibold text-foreground">{dur.label}</span>
                                {isSelected && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                              </div>
                              <span className="mt-1 text-[11px] text-muted-foreground">{dur.description}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <AnnouncementImagesField
                      value={item.images}
                      onChange={(images) => update(item.id, { images })}
                      upload={upload}
                    />

                    {item.images.length > 0 && (
                      <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4">
                        <div className="flex flex-col gap-1">
                          <Label className="text-sm font-semibold text-foreground">
                            Personalización visual y efectos de imagen
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Ajustá el ambiente de fondo, la proporción del encuadre y los efectos interactivos.
                          </p>
                        </div>

                        {/* Tono / Fondo del marco */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-foreground/80">
                            Fondo y ambiente del marco
                          </Label>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {IMAGE_BACKDROP_OPTIONS.map((opt) => {
                              const isSelected = (item.imageBackdrop ?? 'ambient') === opt.value
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => update(item.id, { imageBackdrop: opt.value })}
                                  className={cn(
                                    'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                                    isSelected
                                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                      : 'border-border/70 bg-card hover:bg-muted/40',
                                  )}
                                >
                                  <div className="flex w-full items-center justify-between">
                                    <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                                    {isSelected && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                                  </div>
                                  <span className="mt-1 text-[11px] text-muted-foreground">{opt.description}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Modo de encuadre */}
                        <div className="space-y-2 pt-1">
                          <Label className="text-xs font-medium text-foreground/80">
                            Modo de encuadre
                          </Label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {IMAGE_FIT_OPTIONS.map((opt) => {
                              const isSelected = (item.imageFit ?? 'contain') === opt.value
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => update(item.id, { imageFit: opt.value })}
                                  className={cn(
                                    'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                                    isSelected
                                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                      : 'border-border/70 bg-card hover:bg-muted/40',
                                  )}
                                >
                                  <div className="flex w-full items-center justify-between">
                                    <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                                    {isSelected && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                                  </div>
                                  <span className="mt-1 text-[11px] text-muted-foreground">{opt.description}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Efecto hover interactivo */}
                        <div className="space-y-2 pt-1">
                          <Label className="text-xs font-medium text-foreground/80">
                            Efecto al pasar el cursor o interactuar
                          </Label>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {IMAGE_EFFECT_OPTIONS.map((opt) => {
                              const isSelected = (item.imageEffect ?? 'zoom') === opt.value
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => update(item.id, { imageEffect: opt.value })}
                                  className={cn(
                                    'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                                    isSelected
                                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                      : 'border-border/70 bg-card hover:bg-muted/40',
                                  )}
                                >
                                  <div className="flex w-full items-center justify-between">
                                    <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                                    {isSelected && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                                  </div>
                                  <span className="mt-1 text-[11px] text-muted-foreground">{opt.description}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {item.images.length > 1 && (
                      <div className="space-y-3.5 rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4">
                        <div className="flex flex-col gap-1">
                          <Label className="text-sm font-semibold text-foreground">
                            Animación y rotación del carrusel ({item.images.length} imágenes)
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Personalizá cómo transicionan las imágenes y la velocidad de cambio automático.
                          </p>
                        </div>

                        {/* Selector de efecto de animación */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-foreground/80">Efecto de transición visual</Label>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {CAROUSEL_ANIMATION_OPTIONS.map((anim) => {
                              const isSelected = (item.carouselAnimation ?? 'slide') === anim.value
                              return (
                                <button
                                  key={anim.value}
                                  type="button"
                                  onClick={() => update(item.id, { carouselAnimation: anim.value })}
                                  className={cn(
                                    'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                                    isSelected
                                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                      : 'border-border/70 bg-card hover:bg-muted/40',
                                  )}
                                >
                                  <div className="flex w-full items-center justify-between">
                                    <span className="text-xs font-semibold text-foreground">{anim.label}</span>
                                    {isSelected && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                                  </div>
                                  <span className="mt-1 text-[11px] text-muted-foreground">{anim.description}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Selector de velocidad de rotación */}
                        <div className="space-y-2 pt-1">
                          <Label className="text-xs font-medium text-foreground/80">Velocidad de rotación automática</Label>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {CAROUSEL_SPEED_OPTIONS.map((speed) => {
                              const isSelected = (item.carouselIntervalSeconds ?? 3) === speed.value
                              return (
                                <button
                                  key={speed.value}
                                  type="button"
                                  onClick={() => update(item.id, { carouselIntervalSeconds: speed.value })}
                                  className={cn(
                                    'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                                    isSelected
                                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                      : 'border-border/70 bg-card hover:bg-muted/40',
                                  )}
                                >
                                  <div className="flex w-full items-center justify-between">
                                    <span className="text-xs font-semibold text-foreground">{speed.label}</span>
                                    {isSelected && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}
                                  </div>
                                  <span className="mt-1 text-[11px] text-muted-foreground">{speed.description}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

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

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            setPreviewId(item.id)
                            setPreviewKey((key) => key + 1)
                          }}
                        >
                          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                          Previsualizar
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground"
                          onClick={() => setEditingId(null)}
                        >
                          <Check aria-hidden="true" className="h-3.5 w-3.5" />
                          Cerrar editor
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5 font-medium shadow-sm"
                          disabled={saving || !dirty}
                          onClick={save}
                        >
                          {saving ? (
                            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save aria-hidden="true" className="h-3.5 w-3.5" />
                          )}
                          Guardar cambios
                        </Button>
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

      {previewId && (
        <AnnouncementModal
          key={`preview-${previewId}-${previewKey}`}
          scope={`${previewScope}-preview`}
          isPreview
          isOpen={true}
          onClose={() => {
            setPreviewId(null)
            setPreviewKey(0)
          }}
          announcement={(() => {
            const item = items.find((entry) => entry.id === previewId)
            if (!item) return null
            return {
              ...item,
              enabled: true,
              title: item.title.trim() || 'Aviso de prueba',
              message: item.message.trim() || 'Esta es una vista previa del aviso. Podés revisar el diseño, las imágenes y los botones.',
              startsAt: '',
              endsAt: '',
              updatedAt: `preview-${previewKey}`,
            }
          })()}
        />
      )}

      <AlertDialog open={Boolean(deletingItem)} onOpenChange={(isOpen) => { if (!isOpen) setDeletingItem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              ¿Eliminar aviso?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground">
              <span>
                ¿Estás seguro de que querés eliminar el aviso{' '}
                <strong className="text-foreground">«{deletingItem?.title.trim() || 'Aviso sin título'}»</strong>?
              </span>
              <span className="block rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive dark:bg-destructive/20">
                ⚠️ Esta acción quitará el aviso de la lista. Para confirmar la eliminación definitiva en el sitio, deberás hacer clic en <strong>Guardar</strong>.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingItem) {
                  remove(deletingItem.id)
                  toast.info(`Aviso «${deletingItem.title.trim() || 'sin título'}» quitado de la lista`, {
                    description: 'Hacé clic en Guardar para confirmar.',
                  })
                  setDeletingItem(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar aviso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
