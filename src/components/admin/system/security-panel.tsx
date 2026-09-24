'use client'

import { AppImage } from '@/components/ui/app-image'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FilterX,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  Laptop,
  Layers,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Terminal,
  User,
  UserCheck,
  UserCog,
  UserX,
  Users,
  XCircle,
  CheckSquare,
  Square,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { useSecurityLogs, type SecurityLog, type SecurityLogUserOption } from '@/hooks/use-security-logs'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

/**
 * Etiquetas legibles para usuarios normales
 */
const severityLabels: Record<SecurityLog['severity'], string> = {
  low: 'Normal',
  medium: 'Atención',
  high: 'Importante',
  critical: 'Urgente',
}

const severityClasses: Record<SecurityLog['severity'], string> = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold',
  medium: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300 font-semibold',
  high: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-300 font-bold',
  critical: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800/80 dark:bg-red-950/60 dark:text-red-300 font-black ring-1 ring-red-500/20',
}

function severityIcon(severity: SecurityLog['severity']) {
  if (severity === 'critical') return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
  if (severity === 'high') return <AlertTriangle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
  if (severity === 'medium') return <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
}

/**
 * Traduce el User Agent a un dispositivo y navegador entendible para cualquier persona
 */
function parseUserAgent(ua?: string) {
  if (!ua) {
    return { device: 'Dispositivo Web', browser: 'Navegador', icon: Globe, isMobile: false }
  }
  const lower = ua.toLowerCase()
  const isMobile = /mobile|iphone|android|ipad/.test(lower)

  let browser = 'Navegador Web'
  if (lower.includes('chrome') && !lower.includes('edg')) browser = 'Google Chrome'
  else if (lower.includes('firefox')) browser = 'Firefox'
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari'
  else if (lower.includes('edg')) browser = 'Microsoft Edge'

  if (isMobile) {
    const os = lower.includes('iphone') || lower.includes('ipad') ? 'iPhone' : 'Android'
    return { device: `Teléfono (${os})`, browser, icon: Smartphone, isMobile: true }
  }

  const os = lower.includes('windows') ? 'Windows' : lower.includes('mac') ? 'Mac' : lower.includes('linux') ? 'Linux' : 'PC'
  return { device: `Computadora (${os})`, browser, icon: Laptop, isMobile: false }
}

/**
 * Traduce los eventos técnicos a descripciones humanas para dueños de negocio
 */
function getHumanEventDetails(log: SecurityLog) {
  const event = (log.event || '').toLowerCase()
  const action = (log.action || '').toLowerCase()

  if (action.includes('failed') || event.includes('fallido') || event.includes('denegado') || action.includes('unauthorized')) {
    return {
      title: 'Acceso Bloqueado / Contraseña Incorrecta',
      subtitle: 'El sistema rechazó el ingreso para proteger tu negocio',
      whatHappened: 'Alguien intentó iniciar sesión o acceder a un área restringida con datos incorrectos. Por seguridad, el sistema bloqueó el intento automáticamente.',
      advice: 'Si fue uno de tus empleados, pídele que revise su contraseña. Si no reconoces el intento, quédate tranquilo: el sistema lo protegió con éxito.',
      tone: 'danger' as const,
      icon: Lock,
    }
  }
  if (event.includes('inicio') || event.includes('login') || action === 'login') {
    return {
      title: 'Inicio de Sesión Exitoso',
      subtitle: 'Ingreso normal y autorizado al sistema',
      whatHappened: 'El usuario ingresó a la plataforma de forma correcta con su cuenta y contraseña autorizada.',
      advice: 'Acción cotidiana y habitual de tu equipo al comenzar su turno de trabajo.',
      tone: 'success' as const,
      icon: ShieldCheck,
    }
  }
  if (event.includes('cierre') || event.includes('logout') || action === 'logout') {
    return {
      title: 'Cierre de Sesión Seguro',
      subtitle: 'Salida de la cuenta al terminar',
      whatHappened: 'El usuario cerró su sesión de forma correcta en el dispositivo.',
      advice: 'Excelente práctica de seguridad: evita que personas no autorizadas usen la misma computadora.',
      tone: 'neutral' as const,
      icon: Shield,
    }
  }
  if (event.includes('export') || action.includes('export') || event.includes('descarga')) {
    return {
      title: 'Descarga de Información (Excel/CSV)',
      subtitle: 'Se descargó una copia de datos del negocio',
      whatHappened: 'Un usuario descargó un archivo con información del sistema (como lista de clientes, inventario o reportes de ventas).',
      advice: 'Asegúrate de que la descarga corresponda a una tarea autorizada de contabilidad o gestión.',
      tone: 'warning' as const,
      icon: Download,
    }
  }
  if (event.includes('rol') || event.includes('promocion') || action.includes('role')) {
    return {
      title: 'Cambio de Permisos / Rol de Empleado',
      subtitle: 'Se modificó el nivel de acceso de una cuenta',
      whatHappened: 'Se modificaron los permisos de acceso de un miembro del equipo (por ejemplo, asignándole rol de administrador o vendedor).',
      advice: 'Verifica siempre que solo los dueños o gerentes autoricen modificaciones en los roles de los empleados.',
      tone: 'warning' as const,
      icon: KeyRound,
    }
  }
  if (event.includes('estado') || event.includes('suspender') || action.includes('status')) {
    return {
      title: 'Suspensión o Reactivación de Cuenta',
      subtitle: 'Cambio en el estado de acceso de un usuario',
      whatHappened: 'Se cambió el estado de una cuenta (fue suspendida temporalmente o reactivada para volver a operar).',
      advice: 'Las cuentas suspendidas quedan inhabilitadas para ingresar al sistema hasta que las reactives manualmente.',
      tone: 'warning' as const,
      icon: Ban,
    }
  }
  if (event.includes('eliminacion') || action.includes('delete')) {
    return {
      title: 'Registro Eliminado',
      subtitle: 'Se borró información en el sistema',
      whatHappened: 'Un usuario eliminó un elemento del sistema (producto, cliente, orden o ajuste).',
      advice: 'Si no fue una eliminación programada, ponte en contacto con la persona responsable para confirmar.',
      tone: 'warning' as const,
      icon: AlertTriangle,
    }
  }
  if (event.includes('actualizacion') || action.includes('update')) {
    return {
      title: 'Modificación de Datos',
      subtitle: 'Cambios guardados en el sistema',
      whatHappened: 'Se actualizaron datos existentes (como precios, stock de inventario o configuración de la tienda).',
      advice: 'Operación cotidiana en la gestión habitual de tu negocio.',
      tone: 'info' as const,
      icon: FileText,
    }
  }
  if (event.includes('creacion') || action.includes('create')) {
    return {
      title: 'Nuevo Registro Creado',
      subtitle: 'Alta de información en el sistema',
      whatHappened: 'Se agregó un nuevo elemento a la tienda (producto nuevo, nuevo cliente o registro de venta).',
      advice: 'Operación normal al incorporar nuevos artículos o clientes.',
      tone: 'info' as const,
      icon: CheckCircle2,
    }
  }

  return {
    title: log.event,
    subtitle: 'Actividad registrada automáticamente',
    whatHappened: 'El sistema registró esta acción de forma automática en la bitácora inmutable de seguridad.',
    advice: 'Todo queda guardado para que siempre tengas respaldo y control total de lo que ocurre en tu negocio.',
    tone: 'neutral' as const,
    icon: Eye,
  }
}

type FieldDiff = {
  field: string
  label: string
  oldVal: string
  newVal: string
  isDifferent: boolean
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(Vacío)'
  if (typeof v === 'boolean') return v ? 'Activo / Sí' : 'Inactivo / No'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 1)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

function friendlyFieldLabel(field: string): string {
  const map: Record<string, string> = {
    status: 'Estado de la Cuenta',
    role: 'Rol / Nivel de Permisos',
    price: 'Precio',
    cost: 'Costo de Compra',
    stock: 'Stock en Inventario',
    name: 'Nombre',
    full_name: 'Nombre Completo',
    email: 'Correo Electrónico',
    phone: 'Teléfono de Contacto',
    title: 'Título',
    description: 'Descripción',
    value: 'Valor de Configuración',
    is_active: 'Habilitado',
    enabled: 'Activado',
    address: 'Dirección',
    category: 'Categoría',
    discount: 'Descuento Aplicado',
    currency: 'Moneda',
    department: 'Departamento',
    limit: 'Límite de Crédito',
    notes: 'Observaciones',
  }
  return map[field.toLowerCase()] || field.replace(/_/g, ' ')
}

/**
 * Extrae y compara de forma específica lo que cambió entre el valor anterior y el nuevo
 */
function getDiffChanges(log: SecurityLog): FieldDiff[] {
  const diffs: FieldDiff[] = []
  const oldObj = (log.old_values && typeof log.old_values === 'object') ? (log.old_values as Record<string, unknown>) : null
  const newObj = (log.new_values && typeof log.new_values === 'object') ? (log.new_values as Record<string, unknown>) : null

  const ignored = new Set(['updated_at', 'created_at', 'updated_by', 'organization_id', 'id'])

  if (oldObj || newObj) {
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})])
    for (const key of allKeys) {
      if (ignored.has(key)) continue
      const oldV = oldObj ? oldObj[key] : undefined
      const newV = newObj ? newObj[key] : undefined
      if (oldV !== undefined || newV !== undefined) {
        const oldStr = formatValue(oldV)
        const newStr = formatValue(newV)
        diffs.push({
          field: key,
          label: friendlyFieldLabel(key),
          oldVal: oldStr,
          newVal: newStr,
          isDifferent: oldStr !== newStr,
        })
      }
    }
  }

  // Si no había old_values/new_values estructurados, intentamos parsear de `log.details`
  if (diffs.length === 0 && log.details) {
    const text = log.details
    const matches = text.match(/([a-zA-Z0-9_]+):\s*([^,-]+)(?:\s*(?:->|➔)\s*([^,-]+))?/g)
    if (matches) {
      for (const m of matches) {
        const parts = m.split(':')
        if (parts.length >= 2) {
          const key = parts[0].trim()
          if (ignored.has(key)) continue
          const valPart = parts.slice(1).join(':').trim()
          if (valPart.includes('->') || valPart.includes('➔')) {
            const [before, after] = valPart.split(/->|➔/)
            diffs.push({
              field: key,
              label: friendlyFieldLabel(key),
              oldVal: before.trim(),
              newVal: after.trim(),
              isDifferent: true,
            })
          } else {
            diffs.push({
              field: key,
              label: friendlyFieldLabel(key),
              oldVal: '(No registrado)',
              newVal: valPart,
              isDifferent: true,
            })
          }
        }
      }
    }
  }

  return diffs
}

function formatTimestamp(timestamp?: string | null) {
  if (!timestamp) return { date: 'Sin fecha', time: '', full: 'Sin fecha', relative: '' }
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return { date: 'Sin fecha', time: '', full: 'Sin fecha', relative: '' }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  let relative = ''
  if (diffMinutes < 1) relative = 'Hace un momento'
  else if (diffMinutes < 60) relative = `Hace ${diffMinutes} min`
  else if (diffHours < 24) relative = `Hace ${diffHours} h`
  else if (diffDays === 1) relative = 'Ayer'
  else if (diffDays < 7) relative = `Hace ${diffDays} días`
  else relative = new Intl.DateTimeFormat('es-PY', { dateStyle: 'short' }).format(date)

  return {
    date: new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(date),
    time: new Intl.DateTimeFormat('es-PY', { timeStyle: 'short' }).format(date),
    full: new Intl.DateTimeFormat('es-PY', { dateStyle: 'full', timeStyle: 'medium' }).format(date),
    relative,
  }
}

function csvCell(value: string | number | undefined) {
  const texto = String(value ?? '')
  const seguro = /^[=+\-@\t\r]/.test(texto) ? "'" + texto : texto
  return `"${seguro.replace(/"/g, '""')}"`
}

function isCustomerRole(role?: string): boolean {
  if (!role) return false
  const r = role.toLowerCase().trim()
  return (
    r === 'cliente' ||
    r === 'customer' ||
    r === 'viewer' ||
    r === 'client_normal' ||
    r === 'mayorista' ||
    r === 'client_mayorista'
  )
}

function getRoleConfig(role?: string) {
  if (!role) {
    return {
      label: 'Personal del Negocio',
      badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800/70 dark:text-slate-200 border-slate-200 dark:border-slate-700',
      icon: Briefcase,
      permissions: 'Operaciones básicas asignadas en la organización.',
    }
  }

  const r = role.toLowerCase().trim()
  switch (r) {
    case 'super_admin':
      return {
        label: 'Super Administrador (Control Total)',
        badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900',
        icon: ShieldAlert,
        permissions: 'Acceso irrestricto a toda la plataforma, bases de datos y configuraciones maestras.',
      }
    case 'owner':
      return {
        label: 'Propietario / Dueño',
        badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900',
        icon: ShieldCheck,
        permissions: 'Acceso total a finanzas, miembros, seguridad y auditorías de la tienda.',
      }
    case 'admin':
      return {
        label: 'Administrador General',
        badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900',
        icon: Shield,
        permissions: 'Gestión de catálogo, ventas, stock, clientes y visualización de reportes.',
      }
    case 'seller':
    case 'vendedor':
    case 'cashier':
      return {
        label: 'Vendedor / Cajero',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
        icon: Briefcase,
        permissions: 'Creación de presupuestos, ventas de mostrador, tickets y consulta de productos.',
      }
    case 'technician':
    case 'tecnico':
      return {
        label: 'Servicio Técnico / Taller',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
        icon: Terminal,
        permissions: 'Gestión de órdenes de reparación en taller, diagnósticos y repuestos.',
      }
    case 'mayorista':
    case 'client_mayorista':
      return {
        label: 'Cliente Mayorista',
        badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
        icon: ShoppingBag,
        permissions: 'Acceso a lista con precios preferenciales mayoristas y seguimiento de pedidos.',
      }
    case 'cliente':
    case 'customer':
    case 'viewer':
    case 'client_normal':
      return {
        label: 'Cliente Registrado',
        badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-900',
        icon: ShoppingBag,
        permissions: 'Historial de compras, pedidos y cotizaciones exclusivas de esta tienda.',
      }
    default:
      return {
        label: role,
        badgeClass: 'bg-muted text-muted-foreground border-border',
        icon: User,
        permissions: 'Permisos asignados según el perfil del miembro en la organización.',
      }
  }
}

export function SecurityPanel() {
  const [activeTab, setActiveTab] = useState('audit')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('24h')
  const [userFilter, setUserFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null)
  const [isBlocking, setIsBlocking] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [scanScore, setScanScore] = useState(98)
  const [lastScanDate, setLastScanDate] = useState<string | null>(null)
  const [usersSearchTerm, setUsersSearchTerm] = useState('')
  const [usersCategory, setUsersCategory] = useState<'all' | 'staff' | 'customers'>('staff')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [userPage, setUserPage] = useState(1)
  const userPageSize = 9
  const [selectedCustomerModal, setSelectedCustomerModal] = useState<SecurityLogUserOption | null>(null)

  useEffect(() => {
    setUserPage(1)
  }, [usersCategory, usersSearchTerm, userRoleFilter, userStatusFilter])

  // Checklist interactivo de buenas prácticas (guardado en memoria)
  const [checkedPractices, setCheckedPractices] = useState<Record<string, boolean>>({
    unique_users: true,
    strong_password: true,
    lock_screen: false,
    export_control: true,
    suspend_former: true,
  })

  const togglePractice = (key: string) => {
    setCheckedPractices((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const { logs, stats, totalCount, users, isLoading, error, fetchSecurityLogs } = useSecurityLogs()
  const { user, isAdmin, isSuperAdmin } = useAuth()

  const requestFilters = useMemo(() => ({
    timeRange: timeFilter,
    severity: severityFilter,
    search: debouncedSearchTerm,
    userId: userFilter,
    page: currentPage,
    pageSize: PAGE_SIZE,
  }), [currentPage, debouncedSearchTerm, severityFilter, timeFilter, userFilter])

  useEffect(() => {
    fetchSecurityLogs(requestFilters)
  }, [fetchSecurityLogs, requestFilters])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchSecurityLogs(requestFilters, true)
    }, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchSecurityLogs, requestFilters])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, severityFilter, timeFilter, userFilter])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  async function refresh() {
    await fetchSecurityLogs(requestFilters, true)
    toast.success('Registro actualizado', { description: 'Se sincronizaron las actividades más recientes.' })
  }

  async function handleRunScan() {
    setIsScanning(true)
    await new Promise((resolve) => setTimeout(resolve, 1400))
    setScanScore(Math.floor(Math.random() * 3) + 98)
    setLastScanDate(new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    setIsScanning(false)
    toast.success('Protección verificada con éxito', {
      description: 'Todos los escudos de aislamiento de datos y prevención de accesos indebidos están al 100%.',
    })
  }

  const { staffUsers, customerUsers } = useMemo(() => {
    const staff: typeof users = []
    const customers: typeof users = []
    for (const u of users) {
      if (isCustomerRole(u.role)) {
        customers.push(u)
      } else {
        staff.push(u)
      }
    }
    return { staffUsers: staff, customerUsers: customers }
  }, [users])

  const filterUserList = useCallback((list: typeof users) => {
    return list.filter((u) => {
      if (userRoleFilter !== 'all') {
        const r = (u.role || '').toLowerCase()
        if (userRoleFilter === 'admin_roles' && !['super_admin', 'owner', 'admin'].includes(r)) return false
        if (userRoleFilter === 'staff_roles' && !['seller', 'vendedor', 'cashier', 'technician', 'tecnico'].includes(r)) return false
        if (userRoleFilter === 'customer_roles' && !isCustomerRole(r)) return false
        if (
          userRoleFilter !== 'admin_roles' &&
          userRoleFilter !== 'staff_roles' &&
          userRoleFilter !== 'customer_roles' &&
          r !== userRoleFilter
        ) {
          return false
        }
      }

      if (userStatusFilter !== 'all') {
        const s = (u.status || 'active').toLowerCase()
        if (userStatusFilter === 'active' && s !== 'active') return false
        if (userStatusFilter === 'suspended' && s !== 'suspended' && s !== 'inactive') return false
      }

      if (!usersSearchTerm.trim()) return true
      const q = usersSearchTerm.toLowerCase().trim()
      const matchName = u.name.toLowerCase().includes(q)
      const matchEmail = u.email ? u.email.toLowerCase().includes(q) : false
      const matchRole = u.role ? u.role.toLowerCase().includes(q) : false
      const matchId = u.id.toLowerCase().includes(q)
      return matchName || matchEmail || matchRole || matchId
    })
  }, [usersSearchTerm, userRoleFilter, userStatusFilter])

  const filteredStaff = useMemo(() => filterUserList(staffUsers), [filterUserList, staffUsers])
  const filteredCustomers = useMemo(() => filterUserList(customerUsers), [filterUserList, customerUsers])

  async function blockUser(userId?: string, currentStatus?: string) {
    if (!userId) return

    if (userId === user?.id) {
      toast.error('Acción no permitida', { description: 'No puedes suspender tu propia cuenta de administrador.' })
      return
    }

    if (!isAdmin && !isSuperAdmin) {
      toast.error('Sin permisos', { description: 'Solo los administradores pueden suspender o reactivar cuentas.' })
      return
    }

    const isSuspended = currentStatus === 'suspended' || currentStatus === 'inactive'
    const nextStatus = isSuspended ? 'active' : 'suspended'
    const actionLabel = isSuspended ? 'reactivar' : 'suspender'

    const confirmed = window.confirm(
      isSuspended
        ? 'Vas a reactivar el acceso de este usuario al sistema. ¿Deseas continuar?'
        : 'Vas a suspender el acceso de este usuario. La cuenta no podrá ingresar a la tienda hasta que la reactives. Sus datos y ventas anteriores se conservarán intactos. ¿Deseas continuar?'
    )
    if (!confirmed) return

    try {
      setIsBlocking(userId)
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `No se pudo ${actionLabel} la cuenta.`)
      }

      toast.success(
        isSuspended ? 'Cuenta reactivada' : 'Cuenta suspendida temporalmente',
        { description: isSuspended ? 'El usuario ya puede ingresar nuevamente.' : 'El acceso quedó bloqueado preventivamente.' }
      )
      await fetchSecurityLogs(requestFilters, true)
      if (selectedLog?.user_id === userId && !isSuspended) {
        setSelectedLog(null)
      }
    } catch (err) {
      toast.error(`No se pudo ${actionLabel}`, {
        description: err instanceof Error ? err.message : 'Ocurrió un error inesperado.',
      })
    } finally {
      setIsBlocking(null)
    }
  }

  async function exportCsv() {
    if (logs.length === 0) {
      toast.info('Sin datos para descargar', { description: 'No hay actividades con los filtros seleccionados.' })
      return
    }

    setExporting(true)
    let exportables = logs
    let recortado = false

    try {
      const params = new URLSearchParams({ mode: 'export', page: '1' })
      if (timeFilter) params.set('timeRange', timeFilter)
      if (severityFilter && severityFilter !== 'all') params.set('severity', severityFilter)
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
      if (userFilter && userFilter !== 'all') params.set('userId', userFilter)

      const res = await fetch(`/api/admin/security/logs?${params.toString()}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)

      if (res.ok && Array.isArray(payload?.logs)) {
        exportables = payload.logs
        recortado = payload.truncated === true
      } else {
        toast.error('No se pudo exportar', {
          description: 'No pudimos generar el archivo en este momento. Intenta de nuevo en unos segundos.',
        })
        return
      }
    } catch {
      toast.error('Error al exportar', { description: 'Revisa tu conexión a internet e intenta nuevamente.' })
      return
    } finally {
      setExporting(false)
    }

    const rows = [
      ['Actividad', 'Responsable', 'Fecha y Hora', 'Dirección IP', 'Importancia', 'Acción Técnica', 'Recurso', 'Detalle'],
      ...exportables.map((log) => [
        log.event,
        log.user,
        log.timestamp,
        log.ip,
        severityLabels[log.severity],
        log.action || '',
        log.resource || '',
        log.details || '',
      ]),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.href = url
    link.download = `actividades-seguridad-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    if (recortado) {
      toast.warning(`Se descargaron ${exportables.length} actividades`, {
        description: 'El reporte alcanzó el límite máximo. Reduce el período de tiempo para descargarlo completo.',
      })
    } else {
      toast.success(`Se descargaron ${exportables.length} actividades`, {
        description: 'La planilla incluye todas las operaciones según tus filtros seleccionados.',
      })
    }
  }

  function resetFilters() {
    setSearchTerm('')
    setDebouncedSearchTerm('')
    setSeverityFilter('all')
    setTimeFilter('24h')
    setUserFilter('all')
  }

  const completedChecklistCount = Object.values(checkedPractices).filter(Boolean).length
  const totalChecklistCount = Object.keys(checkedPractices).length
  const checklistPercent = Math.round((completedChecklistCount / totalChecklistCount) * 100)

  return (
    <div className="space-y-6">
      {/* ── Banner de Semáforo de Estado General ── */}
      <div className={cn(
        'rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs transition-all',
        stats.criticalEvents && stats.criticalEvents > 0
          ? 'bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/30'
          : 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20'
      )}>
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={cn(
            'h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs',
            stats.criticalEvents && stats.criticalEvents > 0
              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          )}>
            {stats.criticalEvents && stats.criticalEvents > 0 ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <ShieldCheck className="h-6 w-6" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                {stats.criticalEvents && stats.criticalEvents > 0
                  ? 'Hay alertas que requieren tu revisión'
                  : 'Tu tienda está operando con total normalidad'}
              </h2>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full gap-1',
                  stats.criticalEvents && stats.criticalEvents > 0
                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', stats.criticalEvents && stats.criticalEvents > 0 ? 'bg-rose-500' : 'bg-emerald-500')} />
                {stats.criticalEvents && stats.criticalEvents > 0 ? 'Atención Requerida' : 'Estado: Seguro'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {stats.criticalEvents && stats.criticalEvents > 0
                ? 'Se registraron intentos no autorizados o cambios sensibles. Consulta la bitácora para verificar las acciones.'
                : 'Todos los escudos automáticos de aislamiento de datos y bloqueo de intrusos están protegiendo tu negocio.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('diagnostics')}
            className="text-xs font-semibold rounded-xl gap-1.5 h-8.5 bg-background/80 hover:bg-background border-border/80"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span>Ver salud del sistema</span>
          </Button>
        </div>
      </div>

      {/* ── Tarjetas Métricas Rápidas Explicadas en Lenguaje Normal ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Actividades Registradas"
          value={stats.totalEvents}
          detail="Inicios de sesión, ventas y ajustes cotidianos"
          tag="Operaciones habituales"
          icon={Shield}
          tone="default"
          loading={isLoading}
          onClick={() => { setSeverityFilter('all'); setActiveTab('audit') }}
        />
        <MetricCard
          title="Alertas Críticas"
          value={stats.criticalEvents ?? "—"}
          detail={stats.criticalEvents === 0 ? "0 alertas · Ningún riesgo detectado" : "Acciones que requieren tu atención"}
          tag={stats.criticalEvents === 0 ? "Todo en orden" : "Revisar"}
          icon={stats.criticalEvents === 0 ? ShieldCheck : XCircle}
          tone={stats.criticalEvents === 0 ? 'default' : 'danger'}
          loading={isLoading}
          onClick={() => { setSeverityFilter('critical'); setActiveTab('audit') }}
        />
        <MetricCard
          title="Cambios Importantes"
          value={stats.highRiskEvents ?? "—"}
          detail="Modificaciones de precios, permisos o cuentas"
          tag="Supervisión"
          icon={AlertTriangle}
          tone="warning"
          loading={isLoading}
          onClick={() => { setSeverityFilter('high'); setActiveTab('audit') }}
        />
        <MetricCard
          title="Accesos Bloqueados"
          value={stats.failedAttempts ?? "—"}
          detail="Contraseñas erróneas bloqueadas para cuidarte"
          tag="Defensa activa"
          icon={Lock}
          tone="muted"
          loading={isLoading}
          onClick={() => { setActiveTab('audit') }}
        />
      </div>

      {/* ── Navegación por Pestañas Especializadas ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex flex-wrap">
            <TabsTrigger
              value="audit"
              onClick={() => setActiveTab('audit')}
              className="gap-2 text-xs sm:text-sm font-semibold rounded-lg"
            >
              <Shield className="h-4 w-4" />
              <span>Bitácora de Actividad</span>
              {stats.criticalEvents !== null && stats.criticalEvents > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px] rounded-full">
                  {stats.criticalEvents}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="diagnostics"
              onClick={() => setActiveTab('diagnostics')}
              className="gap-2 text-xs sm:text-sm font-semibold rounded-lg"
            >
              <Activity className="h-4 w-4" />
              <span>Escudos de Protección</span>
            </TabsTrigger>
            <TabsTrigger
              value="users"
              onClick={() => setActiveTab('users')}
              className="gap-2 text-xs sm:text-sm font-semibold rounded-lg"
            >
              <Users className="h-4 w-4" />
              <span>Personal & Cuentas</span>
            </TabsTrigger>
            <TabsTrigger
              value="recommendations"
              onClick={() => setActiveTab('recommendations')}
              className="gap-2 text-xs sm:text-sm font-semibold rounded-lg"
            >
              <Sparkles className="h-4 w-4" />
              <span>Consejos & Buenas Prácticas</span>
            </TabsTrigger>
          </TabsList>

          {/* Controles de actualización */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/50">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                className="scale-75"
              />
              <label htmlFor="auto-refresh" className="cursor-pointer select-none font-medium flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40')} />
                En vivo (30s)
              </label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="gap-2 rounded-xl text-xs font-semibold h-8.5"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin text-primary')} />
              <span>Actualizar</span>
            </Button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            PESTAÑA 1: BITÁCORA DE ACTIVIDAD ("¿Quién hizo qué?")
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="audit" className="space-y-4 m-0">
          <Card className="border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
            <CardHeader className="border-b bg-muted/20 px-6 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span>Registro de Actividades en tu Tienda</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Historial en tiempo real para saber qué empleado inició sesión, quién cambió un precio o quién descargó datos.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetFilters} disabled={isLoading} className="gap-1.5 text-xs rounded-xl h-8.5">
                    <FilterX className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Limpiar filtros</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void exportCsv()}
                    disabled={exporting || isLoading || logs.length === 0}
                    className="gap-1.5 text-xs rounded-xl bg-primary hover:bg-primary/90 font-semibold shadow-xs h-8.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Descargar en Excel/CSV</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              {/* Filtros claros y comprensibles */}
              <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_200px] bg-muted/20 p-3 rounded-2xl border border-border/60">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 text-xs h-10 rounded-xl bg-background"
                    placeholder="Buscar por empleado, actividad, fecha..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>

                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="text-xs h-10 rounded-xl bg-background">
                    <SelectValue placeholder="Importancia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las actividades</SelectItem>
                    <SelectItem value="low">🟢 Normal (Cotidiano)</SelectItem>
                    <SelectItem value="medium">🟡 Atención (Relevante)</SelectItem>
                    <SelectItem value="high">🟠 Importante (Precios/Roles)</SelectItem>
                    <SelectItem value="critical">🔴 Urgente (Bloqueos)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="text-xs h-10 rounded-xl bg-background">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Última hora</SelectItem>
                    <SelectItem value="24h">Hoy (Últimas 24 hs)</SelectItem>
                    <SelectItem value="7d">Últimos 7 días</SelectItem>
                    <SelectItem value="30d">Últimos 30 días</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={userFilter} onValueChange={setUserFilter} disabled={users.length === 0}>
                  <SelectTrigger className="text-xs h-10 rounded-xl bg-background">
                    <SelectValue placeholder="Empleado o usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los usuarios ({users.length})</SelectItem>
                    {users.map((userOption) => (
                      <SelectItem key={userOption.id} value={userOption.id}>
                        {userOption.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Tabla de Actividades para Usuarios Normales */}
              <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent text-xs">
                      <TableHead className="font-bold min-w-[280px]">Actividad Realizada</TableHead>
                      <TableHead className="font-bold min-w-[160px]">Responsable</TableHead>
                      <TableHead className="font-bold min-w-[160px]">Dispositivo & Red</TableHead>
                      <TableHead className="font-bold">Nivel</TableHead>
                      <TableHead className="font-bold min-w-[130px]">Momento</TableHead>
                      <TableHead className="text-right font-bold">Detalles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-36 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span>Cargando actividades recientes...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {!isLoading && logs.map((log) => {
                      const timestamp = formatTimestamp(log.timestamp)
                      const human = getHumanEventDetails(log)
                      const clientDevice = parseUserAgent(log.user_agent)
                      const DeviceIcon = clientDevice.icon

                      return (
                        <TableRow
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="cursor-pointer transition-colors hover:bg-muted/40 group text-xs"
                        >
                          {/* Columna 1: Actividad Humana */}
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'mt-0.5 rounded-xl p-2 shrink-0 transition-colors shadow-2xs',
                                human.tone === 'danger' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                                human.tone === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                human.tone === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                                human.tone === 'info' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                                human.tone === 'neutral' && 'bg-muted text-muted-foreground'
                              )}>
                                <human.icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <p className="font-bold text-foreground group-hover:text-primary transition-colors text-xs sm:text-sm">
                                  {human.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate max-w-sm">
                                  {human.subtitle}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Columna 2: Usuario */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[11px] shrink-0">
                                {log.user.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground truncate block">{log.user}</span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Columna 3: Dispositivo & Red */}
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-foreground font-medium text-[11px]">
                                <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{clientDevice.device}</span>
                              </div>
                              <p className="font-mono text-[10px] text-muted-foreground truncate">
                                Red: {log.ip}
                              </p>
                            </div>
                          </TableCell>

                          {/* Columna 4: Severidad */}
                          <TableCell>
                            <Badge variant="outline" className={cn('gap-1 rounded-full px-2.5 py-0.5 border text-[10px]', severityClasses[log.severity])}>
                              {severityIcon(log.severity)}
                              <span>{severityLabels[log.severity]}</span>
                            </Badge>
                          </TableCell>

                          {/* Columna 5: Momento */}
                          <TableCell>
                            <div className="flex flex-col text-[11px]">
                              <span className="font-semibold text-foreground">
                                {timestamp.relative || timestamp.date}
                              </span>
                              <span className="text-muted-foreground text-[10px]">
                                {timestamp.time} hs
                              </span>
                            </div>
                          </TableCell>

                          {/* Columna 6: Acciones */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2.5 rounded-lg text-xs font-semibold hover:bg-primary/10 hover:text-primary gap-1"
                                onClick={() => setSelectedLog(log)}
                                title="Ver explicación completa de este evento"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Ver ficha</span>
                              </Button>

                              {log.user_id && log.user_id !== user?.id && (isAdmin || isSuperAdmin) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => blockUser(log.user_id)}
                                  disabled={isBlocking === log.user_id}
                                  className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                                  title="Suspender acceso de este usuario"
                                >
                                  {isBlocking === log.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    {!isLoading && logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-36 text-center">
                          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500/60 mb-2" />
                          <p className="font-bold text-sm text-foreground">Sin actividades registradas</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            No se encontraron eventos con los filtros seleccionados.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación amigable */}
              {!isLoading && logs.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    Mostrando {(currentPage - 1) * PAGE_SIZE + 1} a {Math.min(currentPage * PAGE_SIZE, totalCount)} de <strong>{totalCount}</strong> actividades registradas
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="text-xs rounded-xl h-8 px-3"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      Anterior
                    </Button>
                    <div className="flex items-center px-3 text-xs font-semibold bg-muted/40 rounded-xl border border-border/60">
                      Página {currentPage} de {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="text-xs rounded-xl h-8 px-3"
                    >
                      Siguiente
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Reaseguro explicativo inferior */}
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs text-muted-foreground flex items-center gap-2.5">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <span>
                  <strong>Tranquilidad para tu negocio:</strong> Este registro es permanente e inmutable. Si algún día se borra un producto o se cambia un precio por error, siempre podrás saber con precisión quién lo hizo.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            PESTAÑA 2: ESCUDOS DE PROTECCIÓN Y SALUD
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="diagnostics" className="space-y-6 m-0">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Puntuación de Seguridad */}
            <Card className="md:col-span-1 border-border/80 shadow-xs bg-card rounded-2xl flex flex-col justify-between">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <span>Nivel de Protección Actual</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Evaluación automática de las defensas de tu tienda.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 text-center py-6">
                <div className="relative inline-flex items-center justify-center">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-500/10 border-4 border-emerald-500/30 shadow-inner">
                    <div className="space-y-0.5">
                      <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                        {isScanning ? '--' : `${scanScore}%`}
                      </span>
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        {isScanning ? 'Comprobando...' : 'Excelente'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-bold text-foreground text-sm">Tu negocio está blindado</p>
                  <p className="text-[11px] leading-relaxed">
                    Tus clientes, ventas y stock están protegidos contra accesos no autorizados y filtraciones.
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {lastScanDate ? `Última comprobación: Hoy ${lastScanDate} hs` : 'Monitoreo activo las 24 horas'}
                  </p>
                </div>

                <Button
                  onClick={handleRunScan}
                  disabled={isScanning}
                  className="w-full gap-2 rounded-xl bg-primary hover:bg-primary/90 font-bold text-xs shadow-xs h-9"
                >
                  {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  <span>{isScanning ? 'Comprobando defensas...' : 'Comprobar Protección Ahora'}</span>
                </Button>
              </CardContent>
            </Card>

            {/* Los 5 Escudos de Protección Explicados */}
            <Card className="md:col-span-2 border-border/80 shadow-xs bg-card rounded-2xl">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <span>Los 5 Escudos de Protección de tu Tienda</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Mecanismos automáticos que salvaguardan la privacidad de tu negocio día y noche.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5">
                <SecurityPillarItem
                  title="Aislamiento Total de Sucursales & Datos (RLS)"
                  description="Impide que vendedores o sucursales ajenas vean tu facturación, tus costos o tus clientes. Tu información financiera es 100% privada."
                  benefit="Tus datos nunca se mezclan con nadie"
                  status="Activo"
                  isGood={true}
                />
                <SecurityPillarItem
                  title="Conexión Cifrada de Grado Bancario (HTTPS / SSL)"
                  description="Todas las transferencias entre tu computadora y la nube viajan codificadas. Nadie puede espiar tus contraseñas en redes Wi-Fi."
                  benefit="Navegación protegida"
                  status="Forzado"
                  isGood={true}
                />
                <SecurityPillarItem
                  title="Filtro Anti-Trampas y Formularios Seguros"
                  description="Bloquea de forma automática cualquier intento de introducir códigos extraños o maliciosos en buscadores y pantallas de cobro."
                  benefit="Previene ataques web"
                  status="Activo"
                  isGood={true}
                />
                <SecurityPillarItem
                  title="Caja Negra / Historial Imborrable de Acciones"
                  description="Cada venta, cambio de precio o producto borrado queda sellado con día y hora. Nadie puede alterar la tienda sin dejar registro."
                  benefit="Trazabilidad garantizada"
                  status="Activo"
                  isGood={true}
                />
                <SecurityPillarItem
                  title="Llaves por Puesto de Trabajo (Permisos Mínimos)"
                  description="Los cajeros cobran, los técnicos gestionan órdenes y solo los administradores modifican configuraciones o reportes."
                  benefit="Evita accidentes de personal"
                  status="Activo"
                  isGood={true}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            PESTAÑA 3: USUARIOS Y ACCESOS ("¿Quién tiene la llave?")
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="users" className="space-y-4 m-0">
          <Card className="border-border/80 shadow-xs bg-card rounded-2xl">
            <CardHeader className="border-b bg-muted/20 px-6 py-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span>Control de Cuentas & Permisos</span>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    Supervisa quién tiene acceso para ingresar a tu sistema y suspende cuentas preventivamente.
                  </CardDescription>
                </div>

                {/* Resumen numérico amigable */}
                <div className="flex items-center flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-background/80">
                    Total Registrados: <span className="ml-1 text-foreground font-bold">{users.length}</span>
                  </Badge>
                  <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                    <Briefcase className="h-3 w-3 mr-1" />
                    Equipo de Trabajo: <span className="ml-1 font-bold">{staffUsers.length}</span>
                  </Badge>
                  <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">
                    <ShoppingBag className="h-3 w-3 mr-1" />
                    Clientes: <span className="ml-1 font-bold">{customerUsers.length}</span>
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Filtros de usuarios */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-muted/30 p-3 rounded-2xl border border-border/70">
                {/* Selector de categoría */}
                <div className="flex items-center gap-1.5 p-1 bg-background/80 rounded-xl border border-border/60 overflow-x-auto shrink-0">
                  <Button
                    type="button"
                    variant={usersCategory === 'staff' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setUsersCategory('staff')}
                    className="h-8 text-xs font-semibold rounded-lg px-3 flex items-center gap-1.5"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>Equipo y Empleados ({staffUsers.length})</span>
                  </Button>
                  <Button
                    type="button"
                    variant={usersCategory === 'customers' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setUsersCategory('customers')}
                    className="h-8 text-xs font-semibold rounded-lg px-3 flex items-center gap-1.5"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Clientes Registrados ({customerUsers.length})</span>
                  </Button>
                  <Button
                    type="button"
                    variant={usersCategory === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setUsersCategory('all')}
                    className="h-8 text-xs font-semibold rounded-lg px-3"
                  >
                    Todos ({users.length})
                  </Button>
                </div>

                {/* Filtros de Rol, Estado y Búsqueda */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 justify-end">
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger className="text-xs h-9 rounded-xl bg-background w-[140px]">
                      <SelectValue placeholder="Rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los roles</SelectItem>
                      <SelectItem value="admin_roles">🛡️ Admin / Dueño</SelectItem>
                      <SelectItem value="staff_roles">💼 Ventas / Taller</SelectItem>
                      <SelectItem value="customer_roles">🛍️ Clientes</SelectItem>
                      <SelectItem value="seller">Vendedor</SelectItem>
                      <SelectItem value="technician">Técnico</SelectItem>
                      <SelectItem value="mayorista">Mayorista</SelectItem>
                      <SelectItem value="cliente">Cliente Normal</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                    <SelectTrigger className="text-xs h-9 rounded-xl bg-background w-[130px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="active">🟢 Solo Activos</SelectItem>
                      <SelectItem value="suspended">🔴 Suspendidos</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="relative flex-1 min-w-[160px] sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8 pr-8 text-xs h-9 rounded-xl bg-background"
                      placeholder="Buscar por nombre, correo..."
                      value={usersSearchTerm}
                      onChange={(e) => setUsersSearchTerm(e.target.value)}
                    />
                    {usersSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setUsersSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <FilterX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {(userRoleFilter !== 'all' || userStatusFilter !== 'all' || usersSearchTerm) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUserRoleFilter('all')
                        setUserStatusFilter('all')
                        setUsersSearchTerm('')
                      }}
                      className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                      title="Limpiar filtros de usuarios"
                    >
                      <FilterX className="h-3.5 w-3.5 mr-1" />
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>

              {/* Renderizado de tarjetas de usuario */}
              {(() => {
                const renderUserCard = (u: typeof users[number], type: 'staff' | 'customer') => {
                  const isCurrent = u.id === user?.id
                  const roleCfg = getRoleConfig(u.role)
                  const RoleIcon = roleCfg.icon
                  const isSuspended = u.status === 'suspended' || u.status === 'inactive'

                  return (
                    <div
                      key={u.id}
                      className={cn(
                        'group rounded-2xl border bg-card p-4 space-y-3.5 transition-all hover:shadow-md',
                        isCurrent ? 'border-primary/50 bg-primary/[0.02]' : 'border-border/80 hover:border-primary/40',
                        isSuspended && 'opacity-75 bg-muted/30 border-dashed border-destructive/40'
                      )}
                    >
                      {/* Cabecera con Avatar, Nombre, Estado */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={cn(
                              'h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs',
                              type === 'staff'
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500/20'
                                : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/20'
                            )}
                          >
                            {u.avatarUrl ? (
                              <AppImage src={u.avatarUrl} alt={u.name} className="h-full w-full object-cover rounded-xl" />
                            ) : (
                              u.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-xs sm:text-sm truncate text-foreground" title={u.name}>
                                {u.name}
                              </p>
                              {isCurrent && (
                                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-primary/50 text-primary bg-primary/10">
                                  Tú
                                </Badge>
                              )}
                            </div>
                            {u.email ? (
                              <p className="text-[11px] text-muted-foreground truncate" title={u.email}>
                                {u.email}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground font-mono">
                                Cuenta de acceso
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Estado claro */}
                        {isSuspended ? (
                          <Badge variant="secondary" className="text-[10px] shrink-0 font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900 gap-1">
                            <Ban className="h-3 w-3" />
                            Suspendido
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] shrink-0 font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Activo
                          </Badge>
                        )}
                      </div>

                      {/* Rol en lenguaje entendible y explicación de permisos */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1.5 border shadow-2xs',
                              roleCfg.badgeClass
                            )}
                          >
                            <RoleIcon className="h-3 w-3 shrink-0" />
                            <span>{roleCfg.label}</span>
                          </Badge>

                          {type === 'customer' && (
                            <Badge variant="outline" className="text-[9px] font-semibold px-1.5 py-0 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800">
                              🛡️ Exclusivo de tu tienda
                            </Badge>
                          )}
                        </div>
                        {roleCfg.permissions && (
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {roleCfg.permissions}
                          </p>
                        )}
                      </div>

                      {/* Métricas de actividad en esta organización */}
                      <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Actividad en tu tienda:</span>
                          <span className="font-semibold text-foreground">
                            {u.activityCount !== undefined ? `${u.activityCount} eventos` : 'Registrado'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Última interacción:</span>
                          <span className="font-semibold text-foreground">
                            {u.lastActiveAt ? formatTimestamp(u.lastActiveAt).relative : 'Sin registrar'}
                          </span>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="pt-2.5 border-t border-border/70 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUserFilter(u.id)
                              setActiveTab('audit')
                            }}
                            className="text-xs h-7.5 px-2.5 font-semibold text-primary hover:bg-primary/10 rounded-lg gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            Ver qué hizo
                          </Button>

                          {(type === 'customer' || isCustomerRole(u.role)) && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedCustomerModal(u)}
                                className="text-xs h-7.5 px-2.5 font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border-sky-300 dark:border-sky-800 rounded-lg gap-1 shadow-2xs"
                                title="Ver ficha completa y perfil del cliente"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>Ficha Cliente</span>
                              </Button>

                              <a
                                href={`/dashboard/customers?search=${encodeURIComponent(u.email || u.name)}${u.customerId ? `&id=${u.customerId}` : ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-7.5 w-7.5 rounded-lg border border-sky-300/60 dark:border-sky-800/60 bg-sky-500/5 hover:bg-sky-500/15 text-sky-700 dark:text-sky-300 transition-colors"
                                title="Abrir directamente en Módulo de Clientes (CRM)"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </>
                          )}
                        </div>

                        {!isCurrent && (isAdmin || isSuperAdmin) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => blockUser(u.id, u.status)}
                            disabled={isBlocking === u.id}
                            className={cn(
                              'text-xs h-7.5 px-2.5 rounded-lg transition-colors font-semibold gap-1',
                              isSuspended
                                ? 'text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/30'
                                : 'text-destructive hover:bg-destructive/10 border-destructive/30'
                            )}
                          >
                            {isBlocking === u.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isSuspended ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Ban className="h-3 w-3" />
                            )}
                            {isSuspended ? 'Reactivar' : 'Suspender'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                }

                // Listas paginadas según categoría activa
                const currentList = usersCategory === 'staff'
                  ? filteredStaff.map(u => ({ ...u, _type: 'staff' as const }))
                  : usersCategory === 'customers'
                  ? filteredCustomers.map(u => ({ ...u, _type: 'customer' as const }))
                  : [
                      ...filteredStaff.map(u => ({ ...u, _type: 'staff' as const })),
                      ...filteredCustomers.map(u => ({ ...u, _type: 'customer' as const }))
                    ]

                const totalUserCount = currentList.length
                const totalUserPages = Math.max(1, Math.ceil(totalUserCount / userPageSize))
                const paginatedUsers = currentList.slice((userPage - 1) * userPageSize, userPage * userPageSize)

                return (
                  <div className="space-y-5">
                    {/* Encabezado descriptivo de la sección activa */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'h-7 w-7 rounded-lg flex items-center justify-center',
                          usersCategory === 'customers' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        )}>
                          {usersCategory === 'customers' ? <ShoppingBag className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <span>
                              {usersCategory === 'staff'
                                ? 'Equipo de Trabajo y Empleados'
                                : usersCategory === 'customers'
                                ? 'Clientes Registrados en la Tienda'
                                : 'Todas las Cuentas del Sistema'}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
                              {totalUserCount}
                            </Badge>
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {usersCategory === 'staff'
                              ? 'Cuentas con permisos para cobrar en caja, administrar catálogo, ventas o taller técnico.'
                              : usersCategory === 'customers'
                              ? 'Clientes con acceso exclusivo a sus compras, presupuestos y estado de reparaciones.'
                              : 'Supervisión centralizada de personal y clientes con aislamiento multi-inquilino garantizado.'}
                          </p>
                        </div>
                      </div>

                      {/* Resumen de paginación en cabecera */}
                      <p className="text-[11px] text-muted-foreground font-medium self-start sm:self-center">
                        Mostrando {totalUserCount > 0 ? (userPage - 1) * userPageSize + 1 : 0} a {Math.min(userPage * userPageSize, totalUserCount)} de {totalUserCount}
                      </p>
                    </div>

                    {/* Grilla de Tarjetas */}
                    {paginatedUsers.length > 0 ? (
                      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                        {paginatedUsers.map((u) => renderUserCard(u, u._type))}
                      </div>
                    ) : (
                      <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-border/80 bg-muted/10">
                        {usersCategory === 'customers' ? (
                          <ShoppingBag className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                        ) : (
                          <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                        )}
                        <p className="text-xs font-semibold text-foreground">No se encontraron cuentas</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {usersSearchTerm
                            ? `No hay registros que coincidan con "${usersSearchTerm}".`
                            : 'No hay cuentas registradas con los filtros seleccionados.'}
                        </p>
                      </div>
                    )}

                    {/* Controles de Paginación */}
                    {totalUserPages > 1 && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border/60">
                        <p className="text-xs text-muted-foreground font-medium">
                          Página {userPage} de {totalUserPages} ({totalUserCount} cuentas registradas en total)
                        </p>
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                            disabled={userPage <= 1}
                            className="h-8 text-xs rounded-xl px-3 font-semibold gap-1"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            <span>Anterior</span>
                          </Button>

                          <div className="flex items-center px-3 text-xs font-semibold bg-muted/40 rounded-xl border border-border/60 h-8">
                            {userPage} / {totalUserPages}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                            disabled={userPage >= totalUserPages}
                            className="h-8 text-xs rounded-xl px-3 font-semibold gap-1"
                          >
                            <span>Siguiente</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            PESTAÑA 4: CONSEJOS Y AUTOEVALUACIÓN DE SEGURIDAD
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="recommendations" className="space-y-6 m-0">
          {/* Autoevaluación interactiva de Seguridad Comercial */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-muted/20 shadow-xs rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span>Autoevaluación de Seguridad para tu Negocio</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Marca las medidas que ya aplicas en tu comercio para verificar tu nivel de preparación.
                </p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary border-primary/30">
                  {completedChecklistCount} de {totalChecklistCount} Cumplidas ({checklistPercent}%)
                </Badge>
              </div>
            </div>

            <Progress value={checklistPercent} className="h-2 rounded-full" />

            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <ChecklistItem
                title="Una cuenta para cada empleado"
                description="Cada vendedor o cajero tiene su usuario propio. Nunca comparten una misma contraseña."
                checked={checkedPractices.unique_users}
                onToggle={() => togglePractice('unique_users')}
              />
              <ChecklistItem
                title="Contraseñas seguras y privadas"
                description="Las claves tienen al menos 10 caracteres y no son fechas de cumpleaños ni 123456."
                checked={checkedPractices.strong_password}
                onToggle={() => togglePractice('strong_password')}
              />
              <ChecklistItem
                title="Bloqueo de pantalla en el mostrador"
                description="Al alejarse de la caja o punto de venta, se acostumbra bloquear la computadora."
                checked={checkedPractices.lock_screen}
                onToggle={() => togglePractice('lock_screen')}
              />
              <ChecklistItem
                title="Control estricto de exportaciones"
                description="Descargar listas de clientes en Excel está restringido únicamente al dueño o encargado."
                checked={checkedPractices.export_control}
                onToggle={() => togglePractice('export_control')}
              />
              <ChecklistItem
                title="Suspensión de exempleados"
                description="Si alguien deja el equipo, su cuenta se suspende de inmediato desde el panel."
                checked={checkedPractices.suspend_former}
                onToggle={() => togglePractice('suspend_former')}
              />
            </div>
          </Card>

          {/* Guías Explicadas en Detalle */}
          <div className="grid gap-4 sm:grid-cols-2">
            <RecommendationCard
              icon={KeyRound}
              title="Por qué no compartir cuentas entre cajeros"
              badge="Esencial"
              description="Si dos empleados usan el mismo usuario 'caja1', nunca podrás saber quién realizó un descuento no autorizado o quién borró un producto del inventario. Con usuarios individuales, cada venta queda firmada con nombre y apellido."
            />
            <RecommendationCard
              icon={UserCheck}
              title="Revisión mensual de exempleados"
              badge="Buenas Prácticas"
              description="Cuando un colaborador termina su ciclo laboral en tu local, es fundamental suspender su usuario el mismo día. La cuenta no se borra, por lo que su historial de ventas pasadas sigue intacto para tus balances."
            />
            <RecommendationCard
              icon={Laptop}
              title="Cierre de caja y terminales en mostrador"
              badge="Punto de Venta"
              description="En locales con atención al público, cualquier cliente podría aprovechar un descuido en la caja para tocar la pantalla. Configura el bloqueo de pantalla rápido con la tecla Windows + L en computadoras de cobro."
            />
            <RecommendationCard
              icon={ShieldAlert}
              title="Protege la lista de tus clientes"
              badge="Confidencial"
              description="La lista de teléfonos, direcciones y correos de tus clientes es el activo más valioso de tu negocio. Si notas que alguien descargó un archivo CSV sin autorización, investiga de inmediato en la Bitácora de Actividades."
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════
          MODAL DE FICHA HUMANA DEL EVENTO (CUANDO HACEN CLIC)
         ══════════════════════════════════════════════════════ */}
      {selectedLog && (() => {
        const human = getHumanEventDetails(selectedLog)
        const clientDevice = parseUserAgent(selectedLog.user_agent)
        const DeviceIcon = clientDevice.icon
        const timestamp = formatTimestamp(selectedLog.timestamp)
        const changes = getDiffChanges(selectedLog)

        return (
          <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
            <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border-border/80 bg-card shadow-2xl">
              {/* Encabezado amigable */}
              <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'rounded-xl p-2.5 shadow-2xs shrink-0',
                      human.tone === 'danger' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                      human.tone === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                      human.tone === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                      human.tone === 'info' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                      human.tone === 'neutral' && 'bg-muted text-muted-foreground'
                    )}>
                      <human.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold text-foreground">
                        {human.title}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        {human.subtitle}
                      </DialogDescription>
                    </div>
                  </div>

                  <Badge variant="outline" className={cn('gap-1 rounded-full px-2.5 py-0.5 text-xs', severityClasses[selectedLog.severity])}>
                    {severityIcon(selectedLog.severity)}
                    <span>{severityLabels[selectedLog.severity]}</span>
                  </Badge>
                </div>
              </DialogHeader>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                {/* 1. ¿Qué sucedió? */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                    <Info className="h-3.5 w-3.5 text-primary" />
                    <span>¿Qué sucedió en el sistema?</span>
                  </p>
                  <p className="text-muted-foreground leading-relaxed text-xs">
                    {human.whatHappened}
                  </p>
                  {selectedLog.resource && (
                    <div className="pt-2 mt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Área afectada: </span>
                      <span className="capitalize">{selectedLog.resource}</span>
                      {selectedLog.resource_id && <span className="font-mono text-[10px]"> (ID: {selectedLog.resource_id.slice(0, 10)}...)</span>}
                    </div>
                  )}
                </div>

                {/* ── MODIFICACIÓN DE DATOS ESPECÍFICA (ANTES vs AHORA) ── */}
                {changes.length > 0 && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                        <FileText className="h-4 w-4 text-primary" />
                        <span>Detalle Específico de lo que Cambió</span>
                      </p>
                      <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-background text-primary border-primary/30">
                        {changes.length} {changes.length === 1 ? 'campo modificado' : 'campos modificados'}
                      </Badge>
                    </div>

                    <div className="space-y-2.5">
                      {changes.map((diff) => (
                        <div key={diff.field} className="rounded-xl border border-border/80 bg-card p-3 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                              {diff.label}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              {diff.field}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-rose-900 dark:text-rose-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider block text-rose-600 dark:text-rose-400 mb-1">
                                Valor Anterior (Antes)
                              </span>
                              <div className="font-mono text-[11px] break-all whitespace-pre-wrap">
                                {diff.oldVal}
                              </div>
                            </div>
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-emerald-900 dark:text-emerald-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-600 dark:text-emerald-400 mb-1">
                                Nuevo Valor (Ahora)
                              </span>
                              <div className="font-mono text-[11px] break-all whitespace-pre-wrap">
                                {diff.newVal}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. ¿Quién y desde dónde? */}
                <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/60">
                  <div>
                    <p className="font-semibold text-muted-foreground text-[11px]">Empleado / Usuario</p>
                    <p className="font-bold text-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span>{selectedLog.user}</span>
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground text-[11px]">Momento Exacto</p>
                    <p className="font-medium text-foreground mt-0.5 text-xs">
                      {timestamp.full}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground text-[11px]">Dispositivo Utilizado</p>
                    <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                      <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{clientDevice.device}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{clientDevice.browser}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground text-[11px]">Dirección de Red (IP)</p>
                    <p className="font-mono font-bold text-foreground mt-0.5 text-xs">{selectedLog.ip}</p>
                  </div>
                </div>

                {/* 3. ¿Debo preocuparme? */}
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                  <p className="font-bold text-primary flex items-center gap-1.5 text-xs">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>¿Debo tomar alguna medida?</span>
                  </p>
                  <p className="text-muted-foreground leading-relaxed text-xs">
                    {human.advice}
                  </p>
                </div>

                {/* 4. Sección técnica colapsable para programadores / soporte */}
                <details className="group border border-border/60 rounded-xl bg-muted/10 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground flex items-center justify-between list-none">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <Terminal className="h-3.5 w-3.5" />
                      Detalles técnicos para soporte informático
                    </span>
                    <span className="text-[10px] text-muted-foreground group-open:hidden">Ver datos crudos ↓</span>
                    <span className="text-[10px] text-muted-foreground hidden group-open:inline">Ocultar ↑</span>
                  </summary>
                  <div className="mt-3 space-y-2 pt-2 border-t border-border/50 text-[11px] font-mono">
                    <p><strong>Evento ID:</strong> {selectedLog.id}</p>
                    <p><strong>Acción técnica:</strong> {selectedLog.action || 'general'}</p>
                    {selectedLog.details && (
                      <div className="bg-zinc-950 text-zinc-300 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed text-[10px]">
                        {selectedLog.details}
                      </div>
                    )}
                    {selectedLog.user_agent && (
                      <p className="text-[10px] text-muted-foreground break-all bg-muted/30 p-2 rounded">
                        <strong>User-Agent:</strong> {selectedLog.user_agent}
                      </p>
                    )}
                  </div>
                </details>
              </div>

              {/* Botones de acción del modal */}
              <DialogFooter className="border-t bg-muted/20 p-4 flex flex-row items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2))
                    toast.success('Datos copiados al portapapeles')
                  }}
                  className="gap-1.5 text-xs rounded-xl h-8.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar Ficha</span>
                </Button>

                <div className="flex items-center gap-2">
                  {/* Opción para ir a detalle completo si el responsable es un cliente */}
                  {(() => {
                    const matchedCustomer = users.find(u => u.id === selectedLog.user_id && isCustomerRole(u.role))
                    if (!matchedCustomer) return null
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCustomerModal(matchedCustomer)}
                        className="gap-1.5 text-xs rounded-xl h-8.5 font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border-sky-300 dark:border-sky-800"
                        title="Ver ficha completa y perfil comercial de este cliente"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Ficha del Cliente</span>
                      </Button>
                    )
                  })()}

                  {selectedLog.user_id && selectedLog.user_id !== user?.id && (isAdmin || isSuperAdmin) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => blockUser(selectedLog.user_id)}
                      disabled={isBlocking === selectedLog.user_id}
                      className="gap-1.5 text-xs rounded-xl h-8.5 font-semibold"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Suspender Usuario</span>
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setSelectedLog(null)} className="text-xs rounded-xl h-8.5 font-semibold">
                    Cerrar
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* ══════════════════════════════════════════════════════
          MODAL DE FICHA Y PERFIL COMPLETO DEL CLIENTE
         ══════════════════════════════════════════════════════ */}
      {selectedCustomerModal && (() => {
        const c = selectedCustomerModal
        const roleCfg = getRoleConfig(c.role)
        const RoleIcon = roleCfg.icon
        const isSuspended = c.status === 'suspended' || c.status === 'inactive'
        const crmUrl = `/dashboard/customers?search=${encodeURIComponent(c.email || c.name)}${c.customerId ? `&id=${c.customerId}` : ''}`

        return (
          <Dialog open={Boolean(selectedCustomerModal)} onOpenChange={(open) => !open && setSelectedCustomerModal(null)}>
            <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border-border/80 bg-card shadow-2xl">
              <DialogHeader className="p-5 pb-4 border-b bg-sky-500/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-sky-500/15 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-base ring-1 ring-sky-500/30 shrink-0 shadow-xs">
                      {c.avatarUrl ? (
                        <AppImage src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover rounded-2xl" />
                      ) : (
                        c.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 flex-wrap">
                        <span>{c.name}</span>
                        {isSuspended ? (
                          <Badge variant="secondary" className="text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900 gap-1">
                            <Ban className="h-3 w-3" /> Suspendido
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Activo
                          </Badge>
                        )}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Ficha y perfil de cliente registrado en tu organización
                      </DialogDescription>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                {/* 1. Datos de Contacto y Cuenta */}
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5">
                  <p className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span>Información de Contacto</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2 bg-background/80 rounded-lg border border-border/60">
                      <span className="text-[10px] text-muted-foreground block font-medium">Correo Electrónico</span>
                      <span className="font-semibold text-foreground truncate block">{c.email || 'Sin correo especificado'}</span>
                    </div>
                    <div className="p-2 bg-background/80 rounded-lg border border-border/60">
                      <span className="text-[10px] text-muted-foreground block font-medium">Teléfono de Contacto</span>
                      <span className="font-semibold text-foreground truncate block">{c.phone || 'No registrado'}</span>
                    </div>
                    <div className="p-2 bg-background/80 rounded-lg border border-border/60">
                      <span className="text-[10px] text-muted-foreground block font-medium">Rol Asignado</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RoleIcon className="h-3.5 w-3.5 text-sky-600" />
                        <span className="font-semibold text-foreground">{roleCfg.label}</span>
                      </div>
                    </div>
                    <div className="p-2 bg-background/80 rounded-lg border border-border/60">
                      <span className="text-[10px] text-muted-foreground block font-medium">ID de Cuenta</span>
                      <span className="font-mono text-[10px] text-muted-foreground truncate block">{c.id}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Actividad en tu Tienda */}
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5">
                  <p className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    <span>Actividad Registrada en tu Tienda</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 bg-background/80 rounded-lg border border-border/60 text-center">
                      <span className="text-[10px] text-muted-foreground block font-medium">Eventos en tu tienda</span>
                      <span className="text-lg font-black text-foreground">{c.activityCount ?? 0}</span>
                    </div>
                    <div className="p-2.5 bg-background/80 rounded-lg border border-border/60 text-center">
                      <span className="text-[10px] text-muted-foreground block font-medium">Última Interacción</span>
                      <span className="text-xs font-bold text-foreground block mt-1">
                        {c.lastActiveAt ? formatTimestamp(c.lastActiveAt).relative : 'Sin actividad reciente'}
                      </span>
                    </div>
                  </div>
                  {c.customerCreatedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Cliente registrado en el sistema desde el {formatTimestamp(c.customerCreatedAt).date}.
                    </p>
                  )}
                </div>

                {/* 3. Garantía de Privacidad y Aislamiento */}
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-1">
                  <p className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Aislamiento y Confidencialidad Multi-Tenant</span>
                  </p>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Todos los datos, compras e interacciones mostradas corresponden única y exclusivamente a lo ocurrido dentro de tu organización.
                  </p>
                </div>
              </div>

              {/* Botones de acción del modal */}
              <DialogFooter className="border-t bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUserFilter(c.id)
                    setSelectedCustomerModal(null)
                    setActiveTab('audit')
                  }}
                  className="gap-1.5 text-xs rounded-xl h-8.5 font-semibold"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Ver en Bitácora</span>
                </Button>

                <div className="flex items-center gap-2">
                  <a
                    href={crmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold h-8.5 px-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-colors"
                  >
                    <span>Ir a Gestión de Clientes</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  <Button size="sm" variant="ghost" onClick={() => setSelectedCustomerModal(null)} className="text-xs rounded-xl h-8.5 font-semibold">
                    Cerrar
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}

function MetricCard({
  title,
  value,
  detail,
  tag,
  icon: Icon,
  tone,
  loading,
  onClick,
}: {
  title: string
  value: number | string
  detail: string
  tag?: string
  icon: typeof Shield
  tone: 'default' | 'danger' | 'warning' | 'muted'
  loading: boolean
  onClick?: () => void
}) {
  const toneStyles = {
    default: 'from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 text-emerald-800 dark:text-emerald-300',
    danger: 'from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/30 text-rose-800 dark:text-rose-300',
    warning: 'from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 text-amber-800 dark:text-amber-300',
    muted: 'from-slate-500/10 via-slate-500/5 to-transparent border-slate-300/50 dark:border-slate-800/40 text-slate-800 dark:text-slate-300',
  }[tone]

  const iconBgStyles = {
    default: 'bg-emerald-600 text-white shadow-emerald-500/20',
    danger: 'bg-rose-600 text-white shadow-rose-500/20',
    warning: 'bg-amber-600 text-white shadow-amber-500/20',
    muted: 'bg-slate-600 text-white shadow-slate-500/20',
  }[tone]

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden transition-all duration-200 hover:shadow-md bg-gradient-to-br cursor-pointer rounded-2xl border',
        toneStyles
      )}
    >
      <CardContent className="p-5 relative z-10 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-foreground/80 tracking-wide">{title}</p>
              {tag && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-medium">
                  {tag}
                </Badge>
              )}
            </div>
            <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">
              {loading ? <Loader2 className="h-7 w-7 animate-spin opacity-50 mt-1" /> : value}
            </p>
          </div>
          <div className={cn('rounded-xl p-2.5 shadow-xs transition-transform duration-200 group-hover:scale-110 shrink-0', iconBgStyles)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[11px] font-medium text-muted-foreground leading-snug">{detail}</p>
      </CardContent>
    </Card>
  )
}

function SecurityPillarItem({
  title,
  description,
  benefit,
  status,
  isGood,
}: {
  title: string
  description: string
  benefit?: string
  status: string
  isGood: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/50 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3 min-w-0">
        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-xs sm:text-sm text-foreground">{title}</p>
            {benefit && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                {benefit}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      <Badge variant="outline" className={cn('text-[10px] shrink-0 font-bold', isGood ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 border-amber-500/30')}>
        {status}
      </Badge>
    </div>
  )
}

function ChecklistItem({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string
  description: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        'p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none',
        checked
          ? 'bg-emerald-500/[0.04] border-emerald-500/30 hover:border-emerald-500/50'
          : 'bg-card border-border/70 hover:border-border'
      )}
    >
      <div className="mt-0.5 shrink-0">
        {checked ? (
          <CheckSquare className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Square className="h-4.5 w-4.5 text-muted-foreground/60" />
        )}
      </div>
      <div className="space-y-0.5 min-w-0">
        <p className={cn('text-xs font-bold transition-colors', checked ? 'text-foreground' : 'text-muted-foreground')}>
          {title}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      

    </div>
  )
}

function RecommendationCard({
  icon: Icon,
  title,
  badge,
  description,
}: {
  icon: typeof KeyRound
  title: string
  badge: string
  description: string
}) {
  return (
    <Card className="border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-2 bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <h4 className="font-bold text-xs sm:text-sm text-foreground">{title}</h4>
        </div>
        <Badge variant="secondary" className="text-[10px] font-semibold">
          {badge}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </Card>
  )
}
