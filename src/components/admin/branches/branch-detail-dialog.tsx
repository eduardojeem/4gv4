'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleDollarSign,
  Contact,
  ExternalLink,
  Gauge,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Power,
  Star,
  Store,
  Settings2,
  Search,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { BranchAssignedUser, BranchSummary } from '@/lib/branches/types'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Superadministrador',
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Encargado',
  seller: 'Vendedor',
  vendedor: 'Vendedor',
  cashier: 'Cajero',
  technician: 'Técnico',
  tecnico: 'Técnico',
  customer: 'Cliente',
  cliente: 'Cliente',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
  invited: 'Invitado',
  pending: 'Pendiente',
}

function toCurrency(value: number | undefined) {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin datos'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Sin datos'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function getInitials(user: BranchAssignedUser) {
  const source = user.full_name || user.email || 'U'
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function MetricTile({
  icon: Icon,
  label,
  value,
  helper,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  helper?: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', accent)} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className={cn('break-words text-sm sm:max-w-[65%] sm:text-right', value ? 'font-medium' : 'text-muted-foreground')}>
        {value || 'Sin configurar'}
      </span>
    </div>
  )
}

function DetailBar({
  label,
  value,
  total,
  helper,
}: {
  label: string
  value: number
  total: number
  helper: string
}) {
  const percentage = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{helper}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

export function BranchDetailDialog({
  branch,
  open,
  onOpenChange,
  isSuperAdmin,
  isPending,
  onEdit,
  onSetDefault,
  onToggleActive,
}: {
  branch: BranchSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isSuperAdmin?: boolean
  isPending?: boolean
  onEdit: (branch: BranchSummary) => void
  onSetDefault: (branch: BranchSummary) => void
  onToggleActive: (branch: BranchSummary) => void
}) {
  const [assignedUsers, setAssignedUsers] = useState<BranchAssignedUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [usersReloadKey, setUsersReloadKey] = useState(0)

  useEffect(() => {
    if (!open || !branch?.id) return

    let ignore = false
    void Promise.resolve()
      .then(async () => {
        if (ignore) return
        setUsersLoading(true)
        setUsersError(null)
        const response = await fetch(`/api/admin/branches/${branch.id}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => null) as { users?: BranchAssignedUser[]; error?: string } | null
        if (!response.ok) throw new Error(payload?.error || 'No se pudieron cargar los usuarios de la sucursal.')
        if (!ignore) setAssignedUsers(Array.isArray(payload?.users) ? payload.users : [])
      })
      .catch((error) => {
        if (!ignore) {
          setAssignedUsers([])
          setUsersError(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.')
        }
      })
      .finally(() => {
        if (!ignore) setUsersLoading(false)
      })

    return () => { ignore = true }
  }, [branch?.id, open, usersReloadKey])

  const visibleUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase()
    if (!term) return assignedUsers
    return assignedUsers.filter((user) => [user.full_name, user.email, user.phone, user.role, user.department]
      .some((value) => value?.toLowerCase().includes(term)))
  }, [assignedUsers, userSearch])

  if (!branch) return null

  const isInactive = branch.is_active === false
  const isDefault = branch.is_default === true
  const usersCount = branch.users_count || 0
  const primaryUsersCount = Math.min(usersCount, branch.primary_users_count || 0)
  const secondaryUsersCount = Math.max(0, usersCount - primaryUsersCount)
  const registersCount = branch.registers_count || 0
  const openRegistersCount = Math.min(registersCount, branch.open_registers_count || 0)
  const closedRegistersCount = Math.max(0, registersCount - openRegistersCount)
  const salesCount = branch.sales_count || 0
  const averageTicket = salesCount > 0 ? (branch.revenue_total || 0) / salesCount : 0
  const configuredFields = [branch.manager_name, branch.phone, branch.email, branch.address, branch.city]
    .filter((value) => Boolean(value?.trim())).length
  const configurationPercentage = Math.round((configuredFields / 5) * 100)
  const locationQuery = [branch.address, branch.city].filter(Boolean).join(', ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none">
        <DialogHeader
          className={cn(
            'shrink-0 space-y-2 border-b px-5 py-4 pr-12 text-left sm:px-6',
            isDefault ? 'bg-primary/5' : 'bg-muted/20'
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                isDefault ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              <Store className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="break-words text-lg">{branch.name}</DialogTitle>
              <DialogDescription className="break-words">
                Código {branch.code}
                {branch.city ? ` · ${branch.city}` : ''}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isDefault ? (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3" />
                  Predeterminada
                </Badge>
              ) : null}
              <Badge variant={isInactive ? 'destructive' : 'default'}>
                {isInactive ? 'Inactiva' : 'Activa'}
              </Badge>
            </div>
          </div>

          {isSuperAdmin && branch.organization ? (
            <Badge variant="outline" className="w-fit gap-1">
              <Building2 className="h-3 w-3" />
              {branch.organization.name}
            </Badge>
          ) : null}
        </DialogHeader>

        <Tabs defaultValue="summary" className="min-h-0 flex-1 gap-0 overflow-hidden">
          <div className="shrink-0 border-b px-5 py-3 sm:px-6">
            <TabsList className="grid h-10 w-full grid-cols-4 sm:w-[560px]">
              <TabsTrigger value="summary" className="px-1 text-xs sm:px-2 sm:text-sm"><ChartNoAxesCombined />Resumen</TabsTrigger>
              <TabsTrigger value="users" className="px-1 text-xs sm:px-2 sm:text-sm"><Users />Usuarios</TabsTrigger>
              <TabsTrigger value="contact" className="px-1 text-xs sm:px-2 sm:text-sm"><Contact />Contacto</TabsTrigger>
              <TabsTrigger value="settings" className="px-1 text-xs sm:px-2 sm:text-sm">
                <Settings2 /><span className="sm:hidden">Config.</span><span className="hidden sm:inline">Configuración</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <TabsContent value="summary" className="m-0 space-y-5">
              <div className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
                isInactive ? 'border-destructive/30 bg-destructive/5' : 'border-emerald-500/30 bg-emerald-500/5'
              )}>
                {isInactive
                  ? <Power className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
                <div>
                  <p className="font-medium">
                    {isInactive ? 'Sucursal fuera de operación' : 'Sucursal disponible para operar'}
                  </p>
                  <p className="text-muted-foreground">
                    {isInactive
                      ? 'No puede seleccionarse en nuevos flujos hasta que vuelva a activarse.'
                      : `${openRegistersCount} caja${openRegistersCount === 1 ? '' : 's'} abierta${openRegistersCount === 1 ? '' : 's'} en este momento.`}
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Actividad</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricTile icon={Users} label="Usuarios" value={usersCount} helper={`${primaryUsersCount} principales`} />
                  <MetricTile
                    icon={Store}
                    label="Cajas"
                    value={registersCount}
                    helper={`${openRegistersCount} abiertas`}
                    accent={openRegistersCount > 0 ? 'text-emerald-500' : undefined}
                  />
                  <MetricTile icon={Wallet} label="Ventas del mes" value={salesCount} helper={toCurrency(branch.revenue_total)} />
                  <MetricTile icon={Wrench} label="Reparaciones" value={branch.repairs_count || 0} helper="Historial acumulado" />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Lectura operativa</p>
                  <Badge variant="outline" className="gap-1 font-normal">
                    <CircleDollarSign className="h-3 w-3" /> Ticket promedio {toCurrency(averageTicket)}
                  </Badge>
                </div>
                <div className="space-y-4 rounded-lg border p-4">
                  <DetailBar
                    label="Usuarios principales"
                    value={primaryUsersCount}
                    total={Math.max(usersCount, 1)}
                    helper={`${primaryUsersCount} principales · ${secondaryUsersCount} adicionales`}
                  />
                  <DetailBar
                    label="Cajas abiertas"
                    value={openRegistersCount}
                    total={Math.max(registersCount, 1)}
                    helper={`${openRegistersCount} abiertas · ${closedRegistersCount} cerradas`}
                  />
                  <DetailBar
                    label="Datos configurados"
                    value={configuredFields}
                    total={5}
                    helper={`${configurationPercentage}% completo`}
                  />
                </div>
              </section>
            </TabsContent>

            <TabsContent value="users" className="m-0 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Usuarios asignados</p>
                  <p className="text-sm text-muted-foreground">
                    {assignedUsers.length} usuario{assignedUsers.length === 1 ? '' : 's'} con acceso a esta sucursal.
                  </p>
                </div>
                {assignedUsers.length > 4 ? (
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Buscar usuario"
                      className="h-9 pl-9"
                    />
                  </div>
                ) : null}
              </div>

              {usersLoading ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios…
                </div>
              ) : usersError ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-5 text-center">
                  <Users className="h-7 w-7 text-muted-foreground" />
                  <div>
                    <p className="font-medium">No se pudo cargar el equipo</p>
                    <p className="text-sm text-muted-foreground">{usersError}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setUsersReloadKey((value) => value + 1)}>
                    Volver a intentar
                  </Button>
                </div>
              ) : assignedUsers.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-5 text-center">
                  <Users className="h-7 w-7 text-muted-foreground" />
                  <p className="font-medium">Sin usuarios asignados</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Asigná usuarios desde Administración de usuarios para que puedan operar en esta sede.
                  </p>
                </div>
              ) : visibleUsers.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Ningún usuario coincide con la búsqueda.
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {visibleUsers.map((user) => {
                    const isUserActive = user.status === 'active'
                    return (
                      <div key={user.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                        <Avatar className="h-10 w-10 border">
                          {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
                          <AvatarFallback className="text-xs font-semibold">{getInitials(user)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">{user.full_name || user.email || 'Usuario sin nombre'}</p>
                            {user.is_primary ? <Badge variant="secondary">Principal</Badge> : null}
                            <Badge variant={isUserActive ? 'outline' : 'destructive'}>
                              {STATUS_LABELS[user.status || ''] || user.status || 'Sin estado'}
                            </Badge>
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{user.email || 'Email no configurado'}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{ROLE_LABELS[user.role || ''] || user.role || 'Rol no definido'}</span>
                            {user.department ? <span>{user.department}</span> : null}
                            {user.phone ? <span>{user.phone}</span> : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                          <p>{user.is_primary ? 'Sede principal' : 'Acceso adicional'}</p>
                          <p>Asignado {formatDate(user.assigned_at)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="contact" className="m-0 space-y-5">
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Responsable y contacto</p>
                <div className="divide-y rounded-lg border">
                  <InfoRow icon={UserCog} label="Responsable" value={branch.manager_name} />
                  <InfoRow icon={Phone} label="Teléfono" value={branch.phone} />
                  <InfoRow icon={Mail} label="Email" value={branch.email} />
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Ubicación</p>
                <div className="divide-y rounded-lg border">
                  <InfoRow icon={MapPin} label="Dirección" value={branch.address} />
                  <InfoRow icon={Building2} label="Ciudad" value={branch.city} />
                </div>
              </section>

              {(branch.phone || branch.email || locationQuery) ? (
                <div className="flex flex-wrap gap-2">
                  {branch.phone ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${branch.phone}`}><Phone className="mr-2 h-4 w-4" />Llamar</a>
                    </Button>
                  ) : null}
                  {branch.email ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`mailto:${branch.email}`}><Mail className="mr-2 h-4 w-4" />Enviar email</a>
                    </Button>
                  ) : null}
                  {locationQuery ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />Ver en mapa
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                  Agregá teléfono, email o dirección desde Editar sucursal para habilitar acciones rápidas.
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="m-0 space-y-5">
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Estado y preferencia</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Power className={cn('h-4 w-4', isInactive ? 'text-destructive' : 'text-emerald-600')} />
                      <p className="font-medium">{isInactive ? 'Sucursal inactiva' : 'Sucursal activa'}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isInactive ? 'No está disponible para nuevas operaciones.' : 'Disponible para ventas, cajas y reparaciones.'}
                    </p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      size="sm"
                      disabled={isPending || (isDefault && !isInactive)}
                      onClick={() => onToggleActive(branch)}
                    >
                      <Power className="mr-2 h-4 w-4" />{isInactive ? 'Activar sucursal' : 'Desactivar sucursal'}
                    </Button>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Star className={cn('h-4 w-4', isDefault ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                      <p className="font-medium">{isDefault ? 'Sucursal predeterminada' : 'Sucursal secundaria'}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isDefault ? 'Se utiliza cuando una operación no especifica sede.' : 'Puede convertirse en la sede principal de la empresa.'}
                    </p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      size="sm"
                      disabled={isPending || isDefault || isInactive}
                      onClick={() => onSetDefault(branch)}
                    >
                      <Star className="mr-2 h-4 w-4" />{isDefault ? 'Ya es predeterminada' : 'Marcar predeterminada'}
                    </Button>
                  </div>
                </div>
                {isDefault ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Gauge className="h-3.5 w-3.5" /> Para desactivarla, primero marcá otra sucursal como predeterminada.
                  </p>
                ) : null}
              </section>

              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Identificadores y auditoría</p>
                <div className="divide-y rounded-lg border">
                  <InfoRow icon={Hash} label="Código" value={branch.code} />
                  <InfoRow icon={Hash} label="Slug" value={branch.slug} />
                  <InfoRow icon={Hash} label="ID interno" value={branch.id} />
                  {isSuperAdmin ? <InfoRow icon={Building2} label="Organización" value={branch.organization?.name} /> : null}
                  <InfoRow icon={CalendarDays} label="Creada" value={formatDate(branch.created_at)} />
                  <InfoRow icon={CalendarDays} label="Última modificación" value={formatDate(branch.updated_at)} />
                </div>
              </section>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
          <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Cerrar
          </Button>

          <Button className="w-full sm:w-auto" size="sm" disabled={isPending} onClick={() => onEdit(branch)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar sucursal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
