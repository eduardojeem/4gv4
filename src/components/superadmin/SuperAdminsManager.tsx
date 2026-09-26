'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crown,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserX,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { normalizeText } from '@/lib/text/normalize'

export type SuperAdminRow = {
  userId: string
  email: string | null
  name: string | null
  profileStatus: string | null
  roleActive: boolean
  roleSince: string | null
  lastSignIn: string | null
  missingProfile?: boolean
}

/** Con menos filas que esto, buscar es mas trabajo que mirar. */
const SEARCH_THRESHOLD = 8

function formatDate(value: string | null) {
  if (!value) return 'sin fecha'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function relativeTime(value: string | null) {
  if (!value) return 'nunca entró'
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} días`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  const years = Math.floor(months / 12)
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

/** Sin entrar hace mas de noventa dias, el acceso global sobra. */
function isStale(value: string | null) {
  if (!value) return true
  return (Date.now() - new Date(value).getTime()) / 86400000 > 90
}

export function SuperAdminsManager({ rows, currentUserId }: { rows: SuperAdminRow[]; currentUserId: string }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<SuperAdminRow | null>(null)

  const active = useMemo(() => rows.filter((r) => r.roleActive), [rows])
  const revoked = useMemo(() => rows.filter((r) => !r.roleActive), [rows])
  const stale = useMemo(() => active.filter((r) => isStale(r.lastSignIn)), [active])

  const filtrar = (lista: SuperAdminRow[]) => {
    const q = normalizeText(search)
    if (!q) return lista
    return lista.filter((r) => normalizeText(`${r.name ?? ''} ${r.email ?? ''}`).includes(q))
  }

  const activosVisibles = filtrar(active)
  const revocadosVisibles = filtrar(revoked)
  const mostrarBuscador = rows.length >= SEARCH_THRESHOLD

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-muted-foreground">
          <Link href="/superadmin/users">
            <ArrowLeft className="h-3.5 w-3.5" />
            Usuarios
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <Crown className="h-6 w-6 shrink-0 text-amber-500" />
              Super administradores
            </h1>
            {/* La cifra estaba repartida en tres tarjetas de 120px de alto para
                contar, tipicamente, cuatro filas que se ven abajo. */}
            <p className="mt-1 text-sm text-muted-foreground">
              {active.length === 1 ? 'Una persona tiene' : `${active.length} personas tienen`} acceso a
              todas las organizaciones.
              {revoked.length > 0 && ` ${revoked.length} ${revoked.length === 1 ? 'rol revocado' : 'roles revocados'}.`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => router.refresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Actualizar
            </Button>
            {/* Era una tarjeta en la columna derecha, debajo de tres bloques de
                estadistica. Es lo que uno viene a hacer. */}
            <Button size="sm" className="h-9 gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Dar acceso
            </Button>
          </div>
        </div>
      </header>

      {/* Solo cuando hay algo que revisar, en vez de un cartel permanente. */}
      {stale.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <strong>
              {stale.length === 1 ? 'Una cuenta lleva' : `${stale.length} cuentas llevan`} más de 90 días
              sin entrar
            </strong>{' '}
            y conserva acceso a toda la plataforma. Conviene revisar si todavía hace falta.
          </p>
        </div>
      )}

      {mostrarBuscador && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9 text-sm"
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        {activosVisibles.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Crown className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-foreground">
              {rows.length === 0 ? 'No hay super administradores' : 'Nadie coincide con esa búsqueda'}
            </p>
            {rows.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Tiene que haber al menos uno para administrar la plataforma.
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {activosVisibles.map((row) => (
              <PersonRow
                key={row.userId}
                row={row}
                isMe={row.userId === currentUserId}
                onRevoke={() => setConfirmRevoke(row)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Los revocados seguian mezclados en la misma lista y sumando al total,
          con un boton «Revocar» que devolvia «ya no tiene el rol activo». */}
      {revocadosVisibles.length > 0 && (
        <details className="group overflow-hidden rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <UserX className="h-4 w-4" />
              {revocadosVisibles.length} {revocadosVisibles.length === 1 ? 'acceso revocado' : 'accesos revocados'}
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {revocadosVisibles.map((row) => (
              <PersonRow key={row.userId} row={row} isMe={row.userId === currentUserId} onRevoke={() => {}} />
            ))}
          </ul>
        </details>
      )}

      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Qué significa este rol
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2.5 border-t border-border px-5 py-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            Un super administrador <strong className="text-foreground">ve y modifica los datos de todas
            las organizaciones</strong>, sin importar de cuál sea miembro: ventas, clientes, precios y
            configuración de cada negocio de la plataforma.
          </p>
          <p>
            No se puede quitar el último: siempre tiene que quedar uno activo, o nadie podría
            administrar el sistema.
          </p>
          <p>
            Cada vez que alguien da o quita este rol queda registrado en{' '}
            <Link href="/superadmin/audit-logs" className="font-medium text-primary underline-offset-2 hover:underline">
              Registros de auditoría
            </Link>
            , con quién lo hizo y cuándo.
          </p>
        </div>
      </details>

      <GrantAccessDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => router.refresh()}
      />

      <RevokeDialog
        row={confirmRevoke}
        onClose={() => setConfirmRevoke(null)}
        onDone={() => {
          setConfirmRevoke(null)
          router.refresh()
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ fila */

function PersonRow({
  row,
  isMe,
  onRevoke,
}: {
  row: SuperAdminRow
  isMe: boolean
  onRevoke: () => void
}) {
  const displayName = row.name || row.email?.split('@')[0] || 'Cuenta sin perfil'
  const stale = row.roleActive && isStale(row.lastSignIn)

  return (
    <li className={cn('flex items-center gap-3 px-5 py-3.5', !row.roleActive && 'opacity-60')}>
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          row.roleActive
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {getInitials(row.name, row.email)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          {isMe && (
            <Badge variant="outline" className="rounded-full border-indigo-200 bg-indigo-50 px-1.5 text-[10px] text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
              Vos
            </Badge>
          )}
          {row.profileStatus === 'suspended' && (
            <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 px-1.5 text-[10px] text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300">
              Cuenta suspendida
            </Badge>
          )}
          {row.missingProfile && (
            <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-1.5 text-[10px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300">
              Sin perfil
            </Badge>
          )}
        </div>

        <p className="truncate text-xs text-muted-foreground">{row.email || 'Sin correo registrado'}</p>

        <p className="mt-0.5 text-[11px] text-muted-foreground">
          <span className={cn(stale && 'font-semibold text-amber-600 dark:text-amber-400')}>
            Entró {relativeTime(row.lastSignIn)}
          </span>
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          Tiene el rol desde {formatDate(row.roleSince)}
        </p>
      </div>

      {row.roleActive && (
        <div className="shrink-0">
          {isMe ? (
            // El boton deshabilitado decia «Sos vos», que no explica nada.
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Nadie puede quitarse el rol a sí mismo">
              <Lock className="h-3 w-3" />
              No podés quitarte el rol
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/20"
              onClick={onRevoke}
            >
              <ShieldOff className="h-3 w-3" />
              Quitar acceso
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

/* --------------------------------------------------------------- dar rol */

function GrantAccessDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!emailValido || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/super-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json() as { success?: boolean; error?: string; email?: string; outcome?: string }
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo dar el acceso.')
        return
      }
      // El mensaje decia siempre «ahora es super_admin», incluso cuando ya lo era.
      setDone(
        data.outcome === 'already_active'
          ? `${data.email ?? email} ya tenía este acceso.`
          : data.outcome === 'reactivated'
            ? `Se reactivó el acceso de ${data.email ?? email}.`
            : `${data.email ?? email} ya puede administrar toda la plataforma.`
      )
      setEmail('')
      onDone()
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setBusy(false)
    }
  }

  function cerrar(next: boolean) {
    if (busy) return
    onOpenChange(next)
    if (!next) {
      setEmail('')
      setError(null)
      setDone(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dar acceso de super administrador</DialogTitle>
          <DialogDescription>
            La persona va a ver y poder modificar los datos de todas las organizaciones.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="space-y-3 px-6 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="grant-email" className="text-xs font-medium">
              Correo de la cuenta
            </Label>
            <Input
              id="grant-email"
              type="email"
              autoFocus
              placeholder="persona@empresa.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                // El aviso anterior se quedaba fijo mientras escribias otro correo.
                setError(null)
                setDone(null)
              }}
              disabled={busy}
            />
            <p className="text-[11px] text-muted-foreground">
              Tiene que ser una cuenta que ya exista. Si todavía no entró nunca, pedile que inicie
              sesión una vez.
            </p>
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
          {done && (
            <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {done}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => cerrar(false)} disabled={busy}>
              Cerrar
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={!emailValido || busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {busy ? 'Dando acceso...' : 'Dar acceso'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------- quitar rol */

function RevokeDialog({
  row,
  onClose,
  onDone,
}: {
  row: SuperAdminRow | null
  onClose: () => void
  onDone: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quitar acceso global se confirmaba con un solo clic. Escribir el correo
  // obliga a mirar a quien se le esta quitando: es el mismo criterio que el
  // resto del sistema usa para lo que no se puede deshacer solo.
  const objetivo = row?.email ?? ''
  const puedeConfirmar = objetivo
    ? confirmText.trim().toLowerCase() === objetivo.toLowerCase()
    : confirmText.trim().length > 0

  async function quitar() {
    if (!row || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/super-admins?userId=${row.userId}`, { method: 'DELETE' })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo quitar el acceso.')
        return
      }
      setConfirmText('')
      onDone()
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={Boolean(row)}
      onOpenChange={(next) => {
        if (busy || next) return
        setConfirmText('')
        setError(null)
        onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/40">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Quitar el acceso global</DialogTitle>
              <DialogDescription className="mt-1">
                {row?.name || row?.email} deja de ver las demás organizaciones. Conserva su acceso
                normal como administrador de las suyas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="revoke-confirm" className="text-xs font-medium">
              Escribí <span className="font-mono text-foreground">{objetivo || 'el correo'}</span> para confirmar
            </Label>
            <Input
              id="revoke-confirm"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value)
                setError(null)
              }}
              disabled={busy}
            />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirmText('')
                setError(null)
                onClose()
              }}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={quitar}
              disabled={!puedeConfirmar || busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
              {busy ? 'Quitando...' : 'Quitar acceso'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
