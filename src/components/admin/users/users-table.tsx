'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  Mail,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react'
import { SupabaseUser } from '@/hooks/use-users-supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type SortDirection = 'asc' | 'desc' | null

interface UsersTableProps {
  users: SupabaseUser[]
  isLoading: boolean
  showOrganization?: boolean
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onEdit: (user: SupabaseUser) => void
  onDelete: (user: SupabaseUser) => void
  onView: (user: SupabaseUser) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  super_admin: {
    label: 'Super Admin',
    className: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  },
  admin: {
    label: 'Administrador',
    className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  },
  tecnico: {
    label: 'Técnico',
    className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  vendedor: {
    label: 'Vendedor',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  },
  cliente: {
    label: 'Cliente',
    className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  },
}

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  active: {
    label: 'Activo',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  inactive: {
    label: 'Inactivo',
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
    dot: 'bg-red-500',
  },
  suspended: {
    label: 'Suspendido',
    className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
    dot: 'bg-orange-500',
  },
}

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? { label: role, className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' }
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700', dot: 'bg-gray-400' }
}

function formatLastLogin(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getLastLoginTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UsersTable({
  users,
  isLoading,
  showOrganization = false,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onEdit,
  onDelete,
  onView
}: UsersTableProps) {
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const tableColSpan = showOrganization ? 7 : 6

  const sortedUsers = useMemo(() => {
    if (!sortDir) return users
    return [...users].sort((a, b) => {
      const ta = getLastLoginTimestamp(a.lastLogin)
      const tb = getLastLoginTimestamp(b.lastLogin)
      return sortDir === 'asc' ? ta - tb : tb - ta
    })
  }, [users, sortDir])

  const cycleSortDir = () => {
    setSortDir((prev) => {
      if (prev === null) return 'desc'
      if (prev === 'desc') return 'asc'
      return null
    })
  }

  const SortIcon = sortDir === 'asc' ? ArrowUp : sortDir === 'desc' ? ArrowDown : ArrowUpDown

  return (
    <div className="space-y-0">
      <div className="rounded-t-md border-b overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[280px] pl-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                Usuario
              </TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Rol</TableHead>
              {showOrganization ? (
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                  Organización
                </TableHead>
              ) : null}
              <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Estado</TableHead>
              <TableHead className="hidden md:table-cell font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                Departamento
              </TableHead>
              <TableHead className="hidden lg:table-cell font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                <button
                  onClick={cycleSortDir}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  title={sortDir === null ? 'Ordenar por último acceso' : sortDir === 'desc' ? 'Más reciente primero' : 'Más antiguo primero'}
                >
                  Último acceso
                  <SortIcon
                    className={`h-3.5 w-3.5 transition-colors ${sortDir ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                  />
                </button>
              </TableHead>
              <TableHead className="text-right pr-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={tableColSpan} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm">Cargando usuarios...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableColSpan} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <p className="text-sm font-medium">Sin resultados</p>
                    <p className="text-xs">No hay usuarios que coincidan con los filtros aplicados.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => {
                const roleConf = getRoleConfig(user.role)
                const statusConf = getStatusConfig(user.status)
                const initials = user.name ? user.name.charAt(0).toUpperCase() : '?'
                const isInactive = user.status !== 'active'

                return (
                  <TableRow
                    key={user.id}
                    className={`group hover:bg-muted/40 transition-colors cursor-default ${isInactive ? 'opacity-70' : ''}`}
                  >
                    {/* User cell */}
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border-2 border-muted flex-shrink-0">
                          <AvatarImage src={user.avatar_url} alt={user.name} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold text-sm">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate leading-tight">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role */}
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={`font-medium text-xs px-2 py-0.5 ${roleConf.className}`}
                      >
                        {roleConf.label}
                      </Badge>
                    </TableCell>

                    {/* Organisation (superadmin only) */}
                    {showOrganization ? (
                      <TableCell className="py-3">
                        {user.organizations && user.organizations.length > 0 ? (
                          <div className="flex max-w-[200px] flex-wrap gap-1">
                            {user.organizations.slice(0, 2).map((org) => (
                              <Badge key={org.id} variant="secondary" className="max-w-[160px] truncate font-normal text-xs">
                                {org.name}
                              </Badge>
                            ))}
                            {user.organizations.length > 2 ? (
                              <Badge variant="outline" className="font-normal text-xs">
                                +{user.organizations.length - 2}
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin organización</span>
                        )}
                      </TableCell>
                    ) : null}

                    {/* Status */}
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={`font-medium text-xs px-2 py-0.5 flex items-center gap-1.5 w-fit ${statusConf.className}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusConf.dot} flex-shrink-0`} />
                        {statusConf.label}
                      </Badge>
                    </TableCell>

                    {/* Department */}
                    <TableCell className="hidden md:table-cell py-3 text-sm text-muted-foreground">
                      {user.department || <span className="text-muted-foreground/50">—</span>}
                    </TableCell>

                    {/* Last login */}
                    <TableCell className="hidden lg:table-cell py-3 text-sm text-muted-foreground">
                      {formatLastLogin(user.lastLogin)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-4 py-3">
                      <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md"
                          onClick={() => onView(user)}
                          title="Ver detalles"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md"
                          onClick={() => onEdit(user)}
                          title="Editar usuario"
                        >
                          <Edit className="h-3.5 w-3.5 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md"
                          onClick={() => onDelete(user)}
                          title="Desactivar usuario"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
        <p className="text-xs text-muted-foreground">
          {totalCount === 0
            ? 'Sin usuarios'
            : `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, totalCount)} de ${totalCount} usuario${totalCount !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground px-1">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || isLoading}
          >
            Siguiente
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
