'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Database,
  History,
  Loader2,
  RefreshCw,
  ScrollText,
  Trash2,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Notice, PageHeader } from '@/components/superadmin/ui/page-header'
import { resetDatabaseStatsAction, rotateAuditLogAction } from '@/app/superadmin/maintenance/actions'
import { StorageCleanupPanel } from '@/components/superadmin/maintenance/StorageCleanupPanel'
import type { MaintenanceOverview } from '@/lib/superadmin/maintenance'
import type { StorageScanResult } from '@/lib/superadmin/storage-cleanup'

const RETENTION_OPTIONS = [90, 180, 365] as const
type Retention = (typeof RETENTION_OPTIONS)[number]
export type MaintenanceTab = 'storage' | 'audit' | 'database' | 'history'

const ACTION_LABELS: Record<string, string> = {
  'maintenance.rotate_audit_log': 'Rotación de auditoría',
  'maintenance.reset_db_stats': 'Reinicio de estadísticas de la base',
  'maintenance.delete_orphan_images': 'Borrado de imágenes huérfanas',
  'maintenance.trash_orphan_images': 'Imágenes sin uso movidas a la papelera',
  'maintenance.restore_images': 'Imágenes restauradas de la papelera',
  'maintenance.purge_image_trash': 'Papelera de imágenes vaciada',
  rotate_audit_logs: 'Rotación de auditoría (versión anterior)',
  reset_stats: 'Reinicio de estadísticas (versión anterior)',
  storage_cleanup: 'Limpieza de archivos (versión anterior)',
  maintenance_task: 'Tarea de mantenimiento (versión anterior)',
}

function formatNumber(value: number) {
  return value.toLocaleString('es-PY')
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'short', timeStyle: 'short' })
}

function describeHistory(details: Record<string, unknown> | null): string | null {
  if (!details) return null
  const parts: string[] = []
  if (typeof details.retention_days === 'number') parts.push(`conservando ${details.retention_days} días`)
  if (typeof details.deleted_count === 'number') parts.push(`${formatNumber(details.deleted_count)} eliminados`)
  if (typeof details.moved_count === 'number') parts.push(`${formatNumber(details.moved_count)} a la papelera`)
  if (typeof details.restored_count === 'number') parts.push(`${formatNumber(details.restored_count)} restauradas`)
  if (typeof details.skipped_count === 'number' && details.skipped_count > 0) parts.push(`${details.skipped_count} omitidos`)
  return parts.length ? parts.join(' · ') : null
}

// ---------------------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------------------

function AuditRotationPanel({ overview }: { overview: MaintenanceOverview }) {
  const router = useRouter()
  const [retention, setRetention] = useState<Retention>(365)
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [pending, startTransition] = useTransition()
  const toDelete = overview.audit.olderThan[retention]

  const rotate = () =>
    startTransition(async () => {
      const result = await rotateAuditLogAction(retention, confirmation)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Se eliminaron ${formatNumber(result.data.deletedCount)} registros`)
      setOpen(false)
      setConfirmation('')
      router.refresh()
    })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4" /> Rotación de la auditoría</CardTitle>
          <CardDescription>
            Borra los registros de auditoría más viejos para que la tabla no crezca sin límite. Es irreversible, por eso se conservan como mínimo 90 días y queda anotado quién lo hizo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Conservar los últimos</legend>
            <div className="grid grid-cols-3 gap-2">
              {RETENTION_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRetention(days)}
                  aria-pressed={retention === days}
                  className={`rounded-lg border p-3 text-left transition-colors ${retention === days ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                >
                  <span className="block text-sm font-semibold">{days} días</span>
                  <span className="block text-xs text-slate-500">{formatNumber(overview.audit.olderThan[days])} a borrar</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900">
            <span>
              {toDelete === 0
                ? `No hay registros con más de ${retention} días.`
                : <>Se van a borrar <b>{formatNumber(toDelete)}</b> de {formatNumber(overview.audit.total)} registros.</>}
            </span>
            <Button variant="destructive" size="sm" disabled={toDelete === 0 || pending} onClick={() => setOpen(true)}>
              <Trash2 className="h-4 w-4" /> Rotar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Estado de la auditoría</CardTitle></CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Registros totales</dt><dd className="font-semibold tabular-nums">{formatNumber(overview.audit.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Últimos 30 días</dt><dd className="font-semibold tabular-nums">{formatNumber(overview.audit.last30Days)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Registro más antiguo</dt><dd className="font-semibold">{formatDate(overview.audit.oldest)}</dd></div>
          </dl>
          <Button asChild variant="link" className="mt-2 h-auto px-0">
            <Link href="/superadmin/audit-logs">Ver la auditoría →</Link>
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setConfirmation('') }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar {formatNumber(toDelete)} registros de auditoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminan definitivamente los registros con más de {retention} días. No se pueden recuperar. Escribí <b>ROTAR</b> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rotate-confirm">Confirmación</Label>
            <Input id="rotate-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" placeholder="ROTAR" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); rotate() }}
              disabled={pending || confirmation.trim().toUpperCase() !== 'ROTAR'}
              className="bg-red-600 hover:bg-red-700"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Borrar registros
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------

function DatabasePanel() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const reset = () =>
    startTransition(async () => {
      const result = await resetDatabaseStatsAction()
      setOpen(false)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Estadísticas reiniciadas')
      router.refresh()
    })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><RefreshCw className="h-4 w-4" /> Reiniciar estadísticas de Postgres</CardTitle>
          <CardDescription>
            Pone en cero los contadores internos (uso de índices, consultas). Sirve para medir desde cero después de optimizar. No borra datos, pero hasta que se vuelvan a acumular, el monitoreo mostrará índices como «sin uso».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setOpen(true)} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Reiniciar estadísticas
          </Button>
        </CardContent>
      </Card>
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> Monitoreo de la base</CardTitle>
          <CardDescription>Tamaño, conexiones, índices y crecimiento de la base de datos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline"><Link href="/superadmin/database-monitoring">Abrir monitoreo</Link></Button>
        </CardContent>
      </Card>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reiniciar las estadísticas?</AlertDialogTitle>
            <AlertDialogDescription>Los contadores de uso vuelven a cero. Los datos no se tocan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); reset() }} disabled={pending}>Reiniciar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export function MaintenanceCenter({ overview, initialTab }: { overview: MaintenanceOverview; initialTab: MaintenanceTab }) {
  const router = useRouter()
  const [scan, setScan] = useState<StorageScanResult | null>(null)

  // La pestaña queda en la URL para volver o compartir el enlace, sin recargar.
  const rememberTab = (tab: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState(null, '', url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wrench}
        title="Mantenimiento"
        description="Liberar espacio de imágenes que ningún negocio usa, limpiar auditoría vieja y administrar la base de datos. Nada se borra sin confirmación y cada acción queda en el historial."
        actions={<Button variant="outline" size="sm" onClick={() => router.refresh()}><RefreshCw className="h-4 w-4" /> Actualizar</Button>}
      />

      {overview.loadErrors.length > 0 && <Notice tone="error">No se pudieron cargar algunos datos: {overview.loadErrors.join(' · ')}</Notice>}

      <Tabs defaultValue={initialTab} onValueChange={rememberTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="storage">Imágenes</TabsTrigger>
            <TabsTrigger value="audit">Auditoría</TabsTrigger>
            <TabsTrigger value="database">Base de datos</TabsTrigger>
            <TabsTrigger value="history">Historial ({overview.history.length})</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="storage"><StorageCleanupPanel scan={scan} onScan={setScan} /></TabsContent>
        <TabsContent value="audit"><AuditRotationPanel overview={overview} /></TabsContent>
        <TabsContent value="database"><DatabasePanel /></TabsContent>
        <TabsContent value="history">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Últimas tareas ejecutadas</CardTitle>
              <CardDescription>Sale de la auditoría: quién ejecutó cada tarea, cuándo y con qué resultado.</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.history.length === 0 ? (
                <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                  Todavía no hay tareas registradas. Las versiones anteriores de esta página no dejaban registro.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border dark:divide-slate-800 dark:border-slate-800">
                  {overview.history.map((entry) => (
                    <li key={entry.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                        <p className="text-xs text-slate-500">
                          {entry.actorEmail ?? 'Usuario desconocido'}
                          {describeHistory(entry.details) ? ` · ${describeHistory(entry.details)}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
