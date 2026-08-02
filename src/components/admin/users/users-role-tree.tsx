'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Eye, Pencil, Shield, ShieldCheck, User, UserCog, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { SupabaseUser } from '@/hooks/use-users-supabase'

type RoleKey = 'super_admin' | 'admin' | 'tecnico' | 'vendedor' | 'cliente'

type RoleNode = {
  key: RoleKey
  label: string
  description: string
  icon: React.ElementType
  /** Clases del chip del icono (acento del rol). */
  accent: string
  /** Clases del badge de conteo. */
  badge: string
}

// Orden jerarquico: de mayor a menor alcance de permisos.
const ROLE_NODES: RoleNode[] = [
  {
    key: 'super_admin',
    label: 'Super administrador',
    description: 'Acceso global a toda la plataforma',
    icon: ShieldCheck,
    accent: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    badge: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  },
  {
    key: 'admin',
    label: 'Administrador',
    description: 'Gestiona la organización completa',
    icon: Shield,
    accent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  },
  {
    key: 'tecnico',
    label: 'Técnico',
    description: 'Reparaciones y servicio técnico',
    icon: Wrench,
    accent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  {
    key: 'vendedor',
    label: 'Vendedor',
    description: 'Ventas, caja y atención',
    icon: UserCog,
    accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  },
  {
    key: 'cliente',
    label: 'Cliente',
    description: 'Compra en la tienda pública',
    icon: User,
    accent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    badge: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  },
]

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-red-500',
  suspended: 'bg-orange-500',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
}

function initials(user: SupabaseUser) {
  const source = user.name?.trim() || user.email || '?'
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function UsersRoleTree({
  users,
  isLoading,
  countsByRole,
  onView,
  onEdit,
}: {
  users: SupabaseUser[]
  isLoading: boolean
  /** Totales por rol a nivel organización (no solo la página cargada). */
  countsByRole?: Record<string, number>
  onView: (user: SupabaseUser) => void
  onEdit: (user: SupabaseUser) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<RoleKey, SupabaseUser[]>()
    for (const node of ROLE_NODES) map.set(node.key, [])

    for (const user of users) {
      const key = (ROLE_NODES.some((n) => n.key === user.role) ? user.role : 'cliente') as RoleKey
      map.get(key)!.push(user)
    }

    for (const list of map.values()) {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))
    }

    return map
  }, [users])

  // Arranca abierto solo donde hay gente cargada, para no mostrar 5 vacíos.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const visibleNodes = ROLE_NODES.filter((node) => {
    const loaded = grouped.get(node.key)?.length ?? 0
    const total = countsByRole?.[node.key] ?? 0
    return loaded > 0 || total > 0
  })

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-5 w-8 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (visibleNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <User className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">Sin usuarios para mostrar</p>
        <p className="text-xs text-muted-foreground">Ajustá los filtros para ver resultados.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3">
      {visibleNodes.map((node) => {
        const list = grouped.get(node.key) ?? []
        const total = countsByRole?.[node.key]
        const isCollapsed = collapsed[node.key] ?? list.length === 0
        const Icon = node.icon
        const hiddenCount = typeof total === 'number' ? Math.max(0, total - list.length) : 0

        return (
          <div key={node.key} className="overflow-hidden rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setCollapsed((cur) => ({ ...cur, [node.key]: !isCollapsed }))}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  !isCollapsed && 'rotate-90'
                )}
              />
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', node.accent)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{node.label}</span>
                <span className="block text-xs text-muted-foreground">{node.description}</span>
              </span>
              <Badge variant="outline" className={cn('shrink-0 tabular-nums', node.badge)}>
                {typeof total === 'number' ? total : list.length}
              </Badge>
            </button>

            {!isCollapsed && (
              <div className="border-t">
                {list.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">
                    No hay usuarios de este rol en la página actual.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {list.map((user) => (
                      <li
                        key={user.id}
                        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                          {initials(user)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{user.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                        </span>
                        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[user.status] ?? 'bg-gray-400')} />
                          {STATUS_LABEL[user.status] ?? user.status}
                        </span>
                        <span className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Ver detalle de ${user.name}`}
                            onClick={() => onView(user)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Editar ${user.name}`}
                            onClick={() => onEdit(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {hiddenCount > 0 && (
                  <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                    Se muestran {list.length} de {total}. Usá los filtros o la paginación de la pestaña
                    &quot;Usuarios&quot; para ver el resto.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
