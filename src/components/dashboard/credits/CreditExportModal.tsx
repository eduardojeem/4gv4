'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Eye,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  Wallet,
  Users,
  User,
  UserCheck,
  X,
  Check,
  ChevronDown,
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { formatDateOnlyDisplay, startOfLocalDay } from '@/lib/date-only'
import { isInstallmentLate, type CreditRow, type InstallmentRow, type PaymentRow } from '@/hooks/use-credits'

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface CreditExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credits: CreditRow[]
  installments: InstallmentRow[]
  payments: PaymentRow[]
  creditById: Record<string, CreditRow>
}

type ExportScope = 'all' | 'installments' | 'payments'
type StatusFilter = 'all' | 'pending' | 'late' | 'paid'
type DatePreset = 'all' | 'this_month' | 'last_30' | 'custom'
type SortField = 'customer' | 'dueDate' | 'amount' | 'outstanding' | 'status'
type ModalTab = 'summary' | 'filters' | 'preview'

// ─── Dynamic Library Loaders ──────────────────────────────────────────────────

async function loadXlsxStyle() {
  const mod = await import('xlsx-js-style')
  return mod.default
}

async function loadPdfLibraries() {
  const [pdfMod, tableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF: pdfMod.default, autoTable: tableMod.default }
}

// ─── Pure SVG Charts ─────────────────────────────────────────────────────────

interface DonutProps {
  segments: { value: number; color: string; label: string }[]
  size?: number
  strokeWidth?: number
}

function DonutChart({ segments, size = 110, strokeWidth = 14 }: DonutProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  let offset = 0
  const arcs = segments.map((seg) => {
    const frac = total > 0 ? seg.value / total : 0
    const dash = frac * circumference
    const arc = { ...seg, dash, gap: circumference - dash, offset }
    offset += dash
    return arc
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={-arc.offset}
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

function MiniAgingBar({
  label,
  amount,
  count,
  pct,
  color,
}: {
  label: string
  amount: number
  count: number
  pct: number
  color: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">{count} cuotas</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(amount)}
          </span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export interface CustomerOption {
  id: string
  name: string
  code: string
  creditCount: number
  totalScheduled: number
  totalPaid: number
  totalOpen: number
  overdueOpen: number
  lateCount: number
  pendingCount: number
  hasOverdue: boolean
}

const getInitials = (name: string): string => {
  if (!name) return 'CL'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-emerald-600 to-teal-600',
  'from-violet-600 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-600 to-blue-600',
]

const getAvatarGradient = (idOrName: string): string => {
  let hash = 0
  for (let i = 0; i < idOrName.length; i++) {
    hash = (hash << 5) - hash + idOrName.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[idx]
}

const csvEscape = (value: string | number) => {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  const escaped = text.replace(/"/g, '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CreditExportModal({
  open,
  onOpenChange,
  credits,
  installments,
  payments,
  creditById,
}: CreditExportModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<ModalTab>('summary')

  // Customer selection state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false)

  // Filter state
  const [scope, setScope] = useState<ExportScope>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // View state
  const [sortField, setSortField] = useState<SortField>('dueDate')
  const [sortAsc, setSortAsc] = useState(true)
  const [previewPage, setPreviewPage] = useState(1)

  // Column inclusion configuration
  const [includeDaysOverdue, setIncludeDaysOverdue] = useState(true)
  const [includeOrigin, setIncludeOrigin] = useState(true)

  // Loading indicator for generation
  const [isExporting, setIsExporting] = useState<'excel' | 'pdf' | 'csv' | null>(null)

  // Extract and compile unique customers with financial health summary
  const customerList = useMemo<CustomerOption[]>(() => {
    const map = new Map<string, CustomerOption>()

    // 1. Seed from credits
    for (const c of credits) {
      const id = c.customer_id || c.customer_name || c.id
      if (!id) continue
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: c.customer_name?.trim() || 'Cliente sin nombre',
          code: c.customer_code?.trim() || '',
          creditCount: 0,
          totalScheduled: 0,
          totalPaid: 0,
          totalOpen: 0,
          overdueOpen: 0,
          lateCount: 0,
          pendingCount: 0,
          hasOverdue: false,
        })
      }
      const item = map.get(id)!
      item.creditCount++
      if (!item.code && c.customer_code) {
        item.code = c.customer_code.trim()
      }
      if (item.name === 'Cliente sin nombre' && c.customer_name) {
        item.name = c.customer_name.trim()
      }
    }

    // 2. Accumulate debt metrics from installments
    for (const inst of installments) {
      const c = creditById[inst.credit_id]
      const id = c?.customer_id || c?.customer_name || c?.id
      if (!id) continue

      if (!map.has(id)) {
        map.set(id, {
          id,
          name: c?.customer_name?.trim() || 'Cliente sin nombre',
          code: c?.customer_code?.trim() || '',
          creditCount: 1,
          totalScheduled: 0,
          totalPaid: 0,
          totalOpen: 0,
          overdueOpen: 0,
          lateCount: 0,
          pendingCount: 0,
          hasOverdue: false,
        })
      }

      const item = map.get(id)!
      const amount = Number(inst.amount || 0)
      const paid = Math.max(0, Number(inst.amount_paid || 0))
      const open = Math.max(0, amount - paid)
      const isLate = isInstallmentLate(inst)

      item.totalScheduled += amount
      item.totalPaid += Math.min(amount, paid)
      item.totalOpen += open

      if (open > 0) {
        if (isLate) {
          item.overdueOpen += open
          item.lateCount++
          item.hasOverdue = true
        } else {
          item.pendingCount++
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    )
  }, [credits, installments, creditById])

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return customerList.find((c) => c.id === selectedCustomerId) || null
  }, [customerList, selectedCustomerId])

  const filteredCustomerList = useMemo(() => {
    if (!customerSearchQuery.trim()) return customerList
    const q = customerSearchQuery.toLowerCase().trim()
    return customerList.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    )
  }, [customerList, customerSearchQuery])

  // Quick Preset Actions
  const handleApplyPreset = (preset: 'all' | 'overdue' | 'this_month' | 'paid') => {
    setSearch('')
    setFromDate('')
    setToDate('')
    setPreviewPage(1)

    if (preset === 'all') {
      setStatusFilter('all')
      setDatePreset('all')
      setScope('all')
    } else if (preset === 'overdue') {
      setStatusFilter('late')
      setDatePreset('all')
      setScope('installments')
    } else if (preset === 'this_month') {
      setStatusFilter('all')
      setDatePreset('this_month')
      setScope('all')
    } else if (preset === 'paid') {
      setStatusFilter('paid')
      setDatePreset('all')
      setScope('installments')
    }
  }

  const handleResetFilters = () => {
    setSelectedCustomerId(null)
    setCustomerSearchQuery('')
    setIsCustomerPickerOpen(false)
    setStatusFilter('all')
    setDatePreset('all')
    setScope('all')
    setSearch('')
    setFromDate('')
    setToDate('')
    setPreviewPage(1)
  }

  const isFiltered =
    selectedCustomerId !== null ||
    statusFilter !== 'all' ||
    datePreset !== 'all' ||
    search.trim() !== '' ||
    fromDate !== '' ||
    toDate !== ''

  // Filtered installments computation
  const filteredInstallments = useMemo(() => {
    const today = startOfLocalDay(new Date())

    return installments.filter((inst) => {
      // 0. Selected customer filter
      if (selectedCustomerId) {
        const c = creditById[inst.credit_id]
        const cId = c?.customer_id || c?.customer_name || c?.id
        if (cId !== selectedCustomerId) return false
      }

      // 1. Status filter
      const isLate = isInstallmentLate(inst)
      if (statusFilter === 'pending' && (inst.status !== 'pending' || isLate)) return false
      if (statusFilter === 'late' && !isLate) return false
      if (statusFilter === 'paid' && inst.status !== 'paid') return false

      // 2. Search filter (client name, customer code or credit id)
      if (search.trim()) {
        const query = search.toLowerCase()
        const customerName = (creditById[inst.credit_id]?.customer_name || '').toLowerCase()
        const customerCode = (creditById[inst.credit_id]?.customer_code || '').toLowerCase()
        const creditCode = (creditById[inst.credit_id]?.credit_code || inst.credit_id).toLowerCase()
        if (!customerName.includes(query) && !creditCode.includes(query) && !customerCode.includes(query)) {
          return false
        }
      }

      // 3. Date range filter
      if (datePreset === 'this_month') {
        const due = new Date(inst.due_date)
        if (due.getMonth() !== today.getMonth() || due.getFullYear() !== today.getFullYear()) {
          return false
        }
      } else if (datePreset === 'last_30') {
        const due = new Date(inst.due_date)
        const diffDays = (today.getTime() - due.getTime()) / (1000 * 3600 * 24)
        if (diffDays < -30 || diffDays > 30) return false
      } else if (datePreset === 'custom') {
        const due = inst.due_date.slice(0, 10)
        if (fromDate && due < fromDate) return false
        if (toDate && due > toDate) return false
      }

      return true
    })
  }, [installments, selectedCustomerId, statusFilter, search, datePreset, fromDate, toDate, creditById])

  // Sorted installments for preview and export
  const sortedInstallments = useMemo(() => {
    return [...filteredInstallments].sort((a, b) => {
      let comp = 0
      if (sortField === 'customer') {
        const nameA = creditById[a.credit_id]?.customer_name || ''
        const nameB = creditById[b.credit_id]?.customer_name || ''
        comp = nameA.localeCompare(nameB)
      } else if (sortField === 'dueDate') {
        comp = new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      } else if (sortField === 'amount') {
        comp = Number(a.amount || 0) - Number(b.amount || 0)
      } else if (sortField === 'outstanding') {
        const openA = Math.max(0, Number(a.amount || 0) - Number(a.amount_paid || 0))
        const openB = Math.max(0, Number(b.amount || 0) - Number(b.amount_paid || 0))
        comp = openA - openB
      } else if (sortField === 'status') {
        const stA = a.status === 'paid' ? 'paid' : isInstallmentLate(a) ? 'late' : 'pending'
        const stB = b.status === 'paid' ? 'paid' : isInstallmentLate(b) ? 'late' : 'pending'
        comp = stA.localeCompare(stB)
      }
      return sortAsc ? comp : -comp
    })
  }, [filteredInstallments, sortField, sortAsc, creditById])

  // Filtered payments computation
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (selectedCustomerId) {
        const c = creditById[p.credit_id]
        const cId = c?.customer_id || c?.customer_name || c?.id
        if (cId !== selectedCustomerId) return false
      }

      if (search.trim()) {
        const query = search.toLowerCase()
        const customerName = (creditById[p.credit_id]?.customer_name || '').toLowerCase()
        const customerCode = (creditById[p.credit_id]?.customer_code || '').toLowerCase()
        const creditId = (p.credit_id || '').toLowerCase()
        if (!customerName.includes(query) && !creditId.includes(query) && !customerCode.includes(query)) return false
      }

      if (datePreset === 'custom' && p.created_at) {
        const created = p.created_at.slice(0, 10)
        if (fromDate && created < fromDate) return false
        if (toDate && created > toDate) return false
      }

      return true
    })
  }, [payments, selectedCustomerId, search, datePreset, fromDate, toDate, creditById])

  // Metrics calculation
  const metrics = useMemo(() => {
    const today = startOfLocalDay(new Date())
    let totalScheduled = 0
    let totalPaid = 0
    let totalOutstanding = 0
    let totalOverdue = 0

    let pendingCount = 0
    let lateCount = 0
    let paidCount = 0

    // Aging breakdown
    let aging1to7 = 0
    let aging1to7Count = 0
    let aging8to30 = 0
    let aging8to30Count = 0
    let aging31to60 = 0
    let aging31to60Count = 0
    let aging60plus = 0
    let aging60plusCount = 0

    for (const inst of filteredInstallments) {
      const amount = Number(inst.amount || 0)
      const paid = Math.max(0, Number(inst.amount_paid || 0))
      const outstanding = Math.max(0, amount - paid)
      const isLate = isInstallmentLate(inst)

      totalScheduled += amount
      totalPaid += Math.min(amount, paid)

      if (outstanding > 0) {
        totalOutstanding += outstanding
        if (isLate) {
          totalOverdue += outstanding
          lateCount++

          const dueDate = startOfLocalDay(new Date(inst.due_date))
          const daysOverdue = Math.max(1, Math.floor((today.getTime() - dueDate.getTime()) / 86400000))
          if (daysOverdue <= 7) {
            aging1to7 += outstanding
            aging1to7Count++
          } else if (daysOverdue <= 30) {
            aging8to30 += outstanding
            aging8to30Count++
          } else if (daysOverdue <= 60) {
            aging31to60 += outstanding
            aging31to60Count++
          } else {
            aging60plus += outstanding
            aging60plusCount++
          }
        } else {
          pendingCount++
        }
      } else {
        paidCount++
      }
    }

    const currentAmount = Math.max(0, totalOutstanding - totalOverdue)
    const recoveryRate = totalScheduled > 0 ? (totalPaid / totalScheduled) * 100 : 0
    const overdueRate = totalScheduled > 0 ? (totalOverdue / totalScheduled) * 100 : 0

    const involvedCredits = new Set(filteredInstallments.map((i) => i.credit_id)).size

    return {
      totalScheduled,
      totalPaid,
      totalOutstanding,
      totalOverdue,
      currentAmount,
      recoveryRate,
      overdueRate,
      pendingCount,
      lateCount,
      paidCount,
      totalCount: filteredInstallments.length,
      involvedCredits,
      totalPaymentsAmount: filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
      aging: {
        aging1to7,
        aging1to7Count,
        aging8to30,
        aging8to30Count,
        aging31to60,
        aging31to60Count,
        aging60plus,
        aging60plusCount,
      },
    }
  }, [filteredInstallments, filteredPayments])

  const donutSegments = [
    { value: metrics.totalPaid, color: '#10b981', label: 'Cobrado' },
    { value: metrics.currentAmount, color: '#3b82f6', label: 'Al día' },
    { value: metrics.totalOverdue, color: '#f43f5e', label: 'En mora' },
  ]

  // ─── Export: EXCEL (.xlsx) con xlsx-js-style Profesional ───────────────────

  const handleExportExcel = async () => {
    setIsExporting('excel')
    try {
      const XLSX = await loadXlsxStyle()
      const wb = XLSX.utils.book_new()

      // Palette
      const C = {
        navy: '0F172A',
        navyL: 'F1F5F9',
        slateHdr: '1E293B',
        blue: '2563EB',
        blueL: 'EFF6FF',
        emerald: '059669',
        emeraldL: 'ECFDF5',
        emeraldBg: 'DCFCE7',
        emeraldTxt: '166534',
        rose: 'DC2626',
        roseL: 'FEF2F2',
        roseBg: 'FEE2E2',
        roseTxt: '991B1B',
        amber: 'D97706',
        amberL: 'FFFBEB',
        amberBg: 'FEF3C7',
        amberTxt: '92400E',
        grayTxt: '334155',
        grayL: 'F8FAFC',
        border: 'CBD5E1',
        borderSoft: 'E2E8F0',
        white: 'FFFFFF',
      }

      const thinBorder = {
        top: { style: 'thin', color: { rgb: C.borderSoft } },
        bottom: { style: 'thin', color: { rgb: C.borderSoft } },
        left: { style: 'thin', color: { rgb: C.borderSoft } },
        right: { style: 'thin', color: { rgb: C.borderSoft } },
      }

      const totalBorder = {
        top: { style: 'thin', color: { rgb: C.navy } },
        bottom: { style: 'double', color: { rgb: C.navy } },
        left: { style: 'thin', color: { rgb: C.borderSoft } },
        right: { style: 'thin', color: { rgb: C.borderSoft } },
      }

      // Styles
      const titleStyle = {
        font: { bold: true, sz: 14, color: { rgb: C.navy }, name: 'Calibri' },
      }
      const subtitleStyle = {
        font: { sz: 10, color: { rgb: '64748B' }, name: 'Calibri' },
      }
      const sectionHdrStyle = {
        font: { bold: true, sz: 11, color: { rgb: C.blue }, name: 'Calibri' },
      }

      const tableHdrStyle = {
        font: { bold: true, sz: 10, color: { rgb: C.white }, name: 'Calibri' },
        fill: { fgColor: { rgb: C.navy } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      }

      const subTableHdrStyle = {
        font: { bold: true, sz: 9.5, color: { rgb: C.white }, name: 'Calibri' },
        fill: { fgColor: { rgb: C.slateHdr } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
      }

      const kpiCardHdr = (bg: string, fontColor: string) => ({
        font: { bold: true, sz: 9, color: { rgb: fontColor }, name: 'Calibri' },
        fill: { fgColor: { rgb: bg } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
      })

      const kpiCardVal = (bg: string, fontColor: string) => ({
        font: { bold: true, sz: 13, color: { rgb: fontColor }, name: 'Calibri' },
        fill: { fgColor: { rgb: bg } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
      })

      const kpiCardSub = (bg: string) => ({
        font: { sz: 8.5, color: { rgb: '64748B' }, name: 'Calibri' },
        fill: { fgColor: { rgb: bg } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
      })

      const dataCellStyle = (rowIdx: number, align = 'left', isBold = false) => ({
        font: { bold: isBold, sz: 9.5, color: { rgb: C.grayTxt }, name: 'Calibri' },
        fill: { fgColor: { rgb: rowIdx % 2 === 0 ? C.white : C.grayL } },
        border: thinBorder,
        alignment: { horizontal: align, vertical: 'center' },
      })

      const statusCellStyle = (status: 'paid' | 'late' | 'pending') => {
        const conf =
          status === 'paid'
            ? { bg: C.emeraldBg, fg: C.emeraldTxt, label: 'Pagada' }
            : status === 'late'
            ? { bg: C.roseBg, fg: C.roseTxt, label: 'En Mora' }
            : { bg: C.amberBg, fg: C.amberTxt, label: 'Pendiente' }
        return {
          font: { bold: true, sz: 9, color: { rgb: conf.fg }, name: 'Calibri' },
          fill: { fgColor: { rgb: conf.bg } },
          border: thinBorder,
          alignment: { horizontal: 'center', vertical: 'center' },
        }
      }

      const totalRowStyle = {
        font: { bold: true, sz: 10, color: { rgb: C.navy }, name: 'Calibri' },
        fill: { fgColor: { rgb: C.navyL } },
        border: totalBorder,
        alignment: { horizontal: 'right', vertical: 'center' },
      }

      const numFormat = '#,##0'

      // ── SHEET 1: DASHBOARD EJECUTIVO ──────────────────────────────────────────
      if (scope === 'all' || scope === 'installments') {
        // Calculate Top 5 Debtors for Executive briefing
        const topDebtors = Object.values(
          filteredInstallments.reduce<Record<string, { name: string; code: string; count: number; open: number }>>((acc, inst) => {
            const cid = inst.credit_id
            const amt = Number(inst.amount || 0)
            const paid = Math.max(0, Number(inst.amount_paid || 0))
            const open = Math.max(0, amt - paid)
            if (open <= 0) return acc
            if (!acc[cid]) {
              acc[cid] = {
                name: creditById[cid]?.customer_name || 'Sin nombre',
                code: creditById[cid]?.credit_code || cid,
                count: 0,
                open: 0,
              }
            }
            acc[cid].count++
            acc[cid].open += open
            return acc
          }, {})
        )
          .sort((a, b) => b.open - a.open)
          .slice(0, 5)

        const topDebtorRows = topDebtors.map((d, idx) => [
          { v: d.name, s: dataCellStyle(idx, 'left', true) },
          { v: d.code, s: dataCellStyle(idx, 'center') },
          { v: d.count, t: 'n', s: dataCellStyle(idx, 'center') },
          { v: d.open, t: 'n', z: numFormat, s: dataCellStyle(idx, 'right', true) },
        ])

        const topStartRow = 26
        const topEndRow = 25 + topDebtorRows.length

        const summaryAoa: unknown[][] = [
          // Row 1: Banner
          [{ v: 'SISTEMA 4G — GESTIÓN FINANCIERA DE CRÉDITOS Y COBRANZAS', s: titleStyle }],
          // Row 2: Subtitle
          [{ v: `Reporte emitido el ${new Date().toLocaleDateString('es-PY')} a las ${new Date().toLocaleTimeString('es-PY')} · Base de datos en tiempo real`, s: subtitleStyle }],
          // Row 3: Filtros
          [{ v: `Filtros: ${selectedCustomer ? `Cliente = ${selectedCustomer.name} (${selectedCustomer.code || 'ID: ' + selectedCustomer.id}) | ` : ''}Estado = ${statusFilter.toUpperCase()} | Período = ${datePreset} | Cuotas evaluadas = ${metrics.totalCount}`, s: subtitleStyle }],
          // Row 4: Empty
          [],

          // Row 5: KPI Cards Header Row
          [
            { v: 'TOTAL POR COBRAR', s: kpiCardHdr(C.blueL, C.blue) },
            { v: 'CARTERA EN MORA', s: kpiCardHdr(C.roseL, C.rose) },
            { v: 'TOTAL RECUPERADO', s: kpiCardHdr(C.emeraldL, C.emerald) },
            { v: 'TOTAL CARTERA EVALUADA', s: kpiCardHdr(C.navyL, C.navy) },
          ],
          // Row 6: KPI Cards Value Row (Formulas linking to summary tables)
          [
            { f: 'D12+D13', v: metrics.totalOutstanding, t: 'n', z: numFormat, s: kpiCardVal(C.blueL, C.blue) },
            { f: 'D13', v: metrics.totalOverdue, t: 'n', z: numFormat, s: kpiCardVal(C.roseL, C.rose) },
            { f: 'D11', v: metrics.totalPaid, t: 'n', z: numFormat, s: kpiCardVal(C.emeraldL, C.emerald) },
            { f: 'D14', v: metrics.totalScheduled, t: 'n', z: numFormat, s: kpiCardVal(C.navyL, C.navy) },
          ],
          // Row 7: KPI Cards Subtitle Row
          [
            { v: `${metrics.pendingCount + metrics.lateCount} cuotas abiertas`, s: kpiCardSub(C.blueL) },
            { v: `${metrics.lateCount} cuotas en atraso`, s: kpiCardSub(C.roseL) },
            { v: `${metrics.paidCount} cuotas saldadas`, s: kpiCardSub(C.emeraldL) },
            { v: `${metrics.involvedCredits} créditos · ${metrics.totalCount} cuotas`, s: kpiCardSub(C.navyL) },
          ],
          // Row 8: Empty
          [],

          // Row 9: Section: Distribución por Estado
          [{ v: 'DISTRIBUCIÓN DE CUOTAS POR ESTADO', s: sectionHdrStyle }],
          // Row 10: Table Header
          [
            { v: 'Estado de Cuota', s: subTableHdrStyle },
            { v: 'Cantidad Cuotas', s: subTableHdrStyle },
            { v: '% Participación', s: subTableHdrStyle },
            { v: 'Monto Total (Gs.)', s: subTableHdrStyle },
          ],
          // Row 11: Pagadas
          [
            { v: 'Pagadas (Canceladas)', s: dataCellStyle(0, 'left', true) },
            { v: metrics.paidCount, t: 'n', s: dataCellStyle(0, 'center') },
            { f: 'IF(D14>0, D11/D14, 0)', v: metrics.totalScheduled > 0 ? metrics.totalPaid / metrics.totalScheduled : 0, t: 'n', z: '0.0%', s: dataCellStyle(0, 'center') },
            { v: metrics.totalPaid, t: 'n', z: numFormat, s: dataCellStyle(0, 'right') },
          ],
          // Row 12: Pendientes
          [
            { v: 'Pendientes (Al Día)', s: dataCellStyle(1, 'left', true) },
            { v: metrics.pendingCount, t: 'n', s: dataCellStyle(1, 'center') },
            { f: 'IF(D14>0, D12/D14, 0)', v: metrics.totalScheduled > 0 ? metrics.currentAmount / metrics.totalScheduled : 0, t: 'n', z: '0.0%', s: dataCellStyle(1, 'center') },
            { v: metrics.currentAmount, t: 'n', z: numFormat, s: dataCellStyle(1, 'right') },
          ],
          // Row 13: En Mora
          [
            { v: 'En Mora / Atrasadas', s: dataCellStyle(2, 'left', true) },
            { v: metrics.lateCount, t: 'n', s: dataCellStyle(2, 'center') },
            { f: 'IF(D14>0, D13/D14, 0)', v: metrics.totalScheduled > 0 ? metrics.totalOverdue / metrics.totalScheduled : 0, t: 'n', z: '0.0%', s: dataCellStyle(2, 'center') },
            { v: metrics.totalOverdue, t: 'n', z: numFormat, s: dataCellStyle(2, 'right') },
          ],
          // Row 14: Totales
          [
            { v: 'TOTALES', s: totalRowStyle },
            { f: 'SUM(B11:B13)', v: metrics.totalCount, t: 'n', s: totalRowStyle },
            { f: 'SUM(C11:C13)', v: 1, t: 'n', z: '0.0%', s: totalRowStyle },
            { f: 'SUM(D11:D13)', v: metrics.totalScheduled, t: 'n', z: numFormat, s: totalRowStyle },
          ],
          // Row 15: Empty
          [],

          // Row 16: Section: Aging / Tramos de Mora
          [{ v: 'ANTIGÜEDAD DE DEUDA EN MORA (AGING)', s: { ...sectionHdrStyle, font: { bold: true, sz: 11, color: { rgb: C.rose }, name: 'Calibri' } } }],
          // Row 17: Table Header
          [
            { v: 'Tramo de Vencimiento', s: subTableHdrStyle },
            { v: 'Cuotas en Atraso', s: subTableHdrStyle },
            { v: '% de la Mora', s: subTableHdrStyle },
            { v: 'Saldo Vencido (Gs.)', s: subTableHdrStyle },
          ],
          // Row 18: 1 a 7 días
          [
            { v: '1 a 7 días de atraso', s: dataCellStyle(0) },
            { v: metrics.aging.aging1to7Count, t: 'n', s: dataCellStyle(0, 'center') },
            { f: 'IF(D22>0, D18/D22, 0)', v: metrics.totalOverdue > 0 ? metrics.aging.aging1to7 / metrics.totalOverdue : 0, t: 'n', z: '0.0%', s: dataCellStyle(0, 'center') },
            { v: metrics.aging.aging1to7, t: 'n', z: numFormat, s: dataCellStyle(0, 'right') },
          ],
          // Row 19: 8 a 30 días
          [
            { v: '8 a 30 días de atraso', s: dataCellStyle(1) },
            { v: metrics.aging.aging8to30Count, t: 'n', s: dataCellStyle(1, 'center') },
            { f: 'IF(D22>0, D19/D22, 0)', v: metrics.totalOverdue > 0 ? metrics.aging.aging8to30 / metrics.totalOverdue : 0, t: 'n', z: '0.0%', s: dataCellStyle(1, 'center') },
            { v: metrics.aging.aging8to30, t: 'n', z: numFormat, s: dataCellStyle(1, 'right') },
          ],
          // Row 20: 31 a 60 días
          [
            { v: '31 a 60 días de atraso', s: dataCellStyle(2) },
            { v: metrics.aging.aging31to60Count, t: 'n', s: dataCellStyle(2, 'center') },
            { f: 'IF(D22>0, D20/D22, 0)', v: metrics.totalOverdue > 0 ? metrics.aging.aging31to60 / metrics.totalOverdue : 0, t: 'n', z: '0.0%', s: dataCellStyle(2, 'center') },
            { v: metrics.aging.aging31to60, t: 'n', z: numFormat, s: dataCellStyle(2, 'right') },
          ],
          // Row 21: Más de 60 días
          [
            { v: 'Más de 60 días de atraso', s: dataCellStyle(3) },
            { v: metrics.aging.aging60plusCount, t: 'n', s: dataCellStyle(3, 'center') },
            { f: 'IF(D22>0, D21/D22, 0)', v: metrics.totalOverdue > 0 ? metrics.aging.aging60plus / metrics.totalOverdue : 0, t: 'n', z: '0.0%', s: dataCellStyle(3, 'center') },
            { v: metrics.aging.aging60plus, t: 'n', z: numFormat, s: dataCellStyle(3, 'right') },
          ],
          // Row 22: TOTAL CARTERA EN MORA
          [
            { v: 'TOTAL CARTERA EN MORA', s: totalRowStyle },
            { f: 'SUM(B18:B21)', v: metrics.lateCount, t: 'n', s: totalRowStyle },
            { f: 'SUM(C18:C21)', v: 1, t: 'n', z: '0.0%', s: totalRowStyle },
            { f: 'SUM(D18:D21)', v: metrics.totalOverdue, t: 'n', z: numFormat, s: totalRowStyle },
          ],
          // Row 23: Empty
          [],

          // Row 24: Section: Top Deudores
          ...(topDebtorRows.length > 0 ? [
            [{ v: 'TOP CLIENTES CON MAYOR SALDO PENDIENTE', s: { ...sectionHdrStyle, font: { bold: true, sz: 11, color: { rgb: C.navy }, name: 'Calibri' } } }],
            // Row 25: Table Header
            [
              { v: 'Cliente', s: subTableHdrStyle },
              { v: 'Código Crédito', s: subTableHdrStyle },
              { v: 'Cuotas Abiertas', s: subTableHdrStyle },
              { v: 'Saldo Pendiente (Gs.)', s: subTableHdrStyle },
            ],
            // Rows 26..N: Top Debtors
            ...topDebtorRows,
            // Row N+1: Total Top
            [
              { v: 'SUBTOTAL TOP CLIENTES', s: totalRowStyle },
              { v: '', s: totalRowStyle },
              { f: `SUM(C${topStartRow}:C${topEndRow})`, v: topDebtors.reduce((s, d) => s + d.count, 0), t: 'n', s: totalRowStyle },
              { f: `SUM(D${topStartRow}:D${topEndRow})`, v: topDebtors.reduce((s, d) => s + d.open, 0), t: 'n', z: numFormat, s: totalRowStyle },
            ],
          ] : []),
        ]

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa)
        wsSummary['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 22 }, { wch: 28 }]
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Ejecutivo')
      }

      // ── SHEET 2: PLANILLA DETALLADA DE CUOTAS (CON FÓRMULAS VIVAS) ───────────
      if (scope === 'all' || scope === 'installments') {
        const instHeaderTitles = [
          'Cliente',
          'Código Crédito',
          'N° Cuota',
          'Vencimiento',
          'Monto Cuota (Gs.)',
          'Monto Pagado (Gs.)',
          'Saldo Pendiente (Gs.)',
          '% Pagado',
          'Estado',
          ...(includeDaysOverdue ? ['Días Atraso'] : []),
        ]

        const instHeaderCells = instHeaderTitles.map((title) => ({
          v: title,
          s: tableHdrStyle,
        }))

        const today = new Date()
        let sumAmount = 0
        let sumPaid = 0
        let sumOpen = 0

        const instDataRows = sortedInstallments.map((i, rowIdx) => {
          const rowNumber = rowIdx + 2 // Row 1 is header, data rows start at row 2
          const amount = Number(i.amount || 0)
          const paid = Math.max(0, Number(i.amount_paid || 0))
          const open = Math.max(0, amount - paid)
          const isLate = isInstallmentLate(i)
          const dueDate = new Date(i.due_date)
          const daysOverdue = isLate ? Math.max(1, Math.floor((today.getTime() - dueDate.getTime()) / 86400000)) : 0
          const statusKey = i.status === 'paid' ? 'paid' : isLate ? 'late' : 'pending'
          const pctPaid = amount > 0 ? Math.min(1, paid / amount) : 0

          sumAmount += amount
          sumPaid += Math.min(amount, paid)
          sumOpen += open

          return [
            // A: Cliente
            {
              v: creditById[i.credit_id]?.customer_name
                ? `${creditById[i.credit_id]?.customer_name}${creditById[i.credit_id]?.customer_code ? ` (${creditById[i.credit_id]?.customer_code})` : ''}`
                : 'Sin nombre',
              s: dataCellStyle(rowIdx, 'left'),
            },
            // B: Código Crédito
            { v: creditById[i.credit_id]?.credit_code || i.credit_id, s: dataCellStyle(rowIdx, 'center') },
            // C: N° Cuota
            { v: i.installment_number, t: 'n', s: dataCellStyle(rowIdx, 'center') },
            // D: Vencimiento
            { v: formatDateOnlyDisplay(i.due_date), s: dataCellStyle(rowIdx, 'center') },
            // E: Monto Cuota (Gs.)
            { v: amount, t: 'n', z: numFormat, s: dataCellStyle(rowIdx, 'right') },
            // F: Monto Pagado (Gs.)
            { v: paid, t: 'n', z: numFormat, s: dataCellStyle(rowIdx, 'right') },
            // G: Saldo Pendiente (Gs.) -> FÓRMULA MATEMÁTICA VIVA: =MAX(0, E{r}-F{r})
            { f: `MAX(0, E${rowNumber}-F${rowNumber})`, v: open, t: 'n', z: numFormat, s: dataCellStyle(rowIdx, 'right', open > 0) },
            // H: % Pagado -> FÓRMULA MATEMÁTICA VIVA: =IF(E{r}>0, F{r}/E{r}, 0)
            { f: `IF(E${rowNumber}>0, F${rowNumber}/E${rowNumber}, 0)`, v: pctPaid, t: 'n', z: '0.0%', s: dataCellStyle(rowIdx, 'center') },
            // I: Estado
            { v: statusKey === 'paid' ? 'Pagada' : statusKey === 'late' ? 'En Mora' : 'Pendiente', s: statusCellStyle(statusKey) },
            // J: Días Atraso (opcional)
            ...(includeDaysOverdue ? [{ v: daysOverdue > 0 ? daysOverdue : '', t: daysOverdue > 0 ? 'n' : 's', s: dataCellStyle(rowIdx, 'center') }] : []),
          ]
        })

        // Totals Row with Live SUM Formulas
        const totalRowIndex = sortedInstallments.length + 2
        const lastDataRow = sortedInstallments.length > 0 ? sortedInstallments.length + 1 : 2

        const totalRow = sortedInstallments.length > 0 ? [
          // A: Totales Label
          { v: 'TOTALES CONSOLIDADOS', s: { ...totalRowStyle, alignment: { horizontal: 'left', vertical: 'center' } } },
          // B: Vacío
          { v: '', s: totalRowStyle },
          // C: Total Cuotas -> FÓRMULA: =COUNTA(C2:C{N})
          { f: `COUNTA(C2:C${lastDataRow})`, v: sortedInstallments.length, t: 'n', s: totalRowStyle },
          // D: Vacío
          { v: '', s: totalRowStyle },
          // E: Total Monto Cuota -> FÓRMULA: =SUM(E2:E{N})
          { f: `SUM(E2:E${lastDataRow})`, v: sumAmount, t: 'n', z: numFormat, s: totalRowStyle },
          // F: Total Monto Pagado -> FÓRMULA: =SUM(F2:F{N})
          { f: `SUM(F2:F${lastDataRow})`, v: sumPaid, t: 'n', z: numFormat, s: totalRowStyle },
          // G: Total Saldo Pendiente -> FÓRMULA: =SUM(G2:G{N})
          { f: `SUM(G2:G${lastDataRow})`, v: sumOpen, t: 'n', z: numFormat, s: totalRowStyle },
          // H: Promedio Ponderado Recupero -> FÓRMULA: =IF(E{total}>0, F{total}/E{total}, 0)
          { f: `IF(E${totalRowIndex}>0, F${totalRowIndex}/E${totalRowIndex}, 0)`, v: sumAmount > 0 ? sumPaid / sumAmount : 0, t: 'n', z: '0.0%', s: totalRowStyle },
          // I: Estado
          { v: '', s: totalRowStyle },
          // J: Días Atraso
          ...(includeDaysOverdue ? [{ v: '', s: totalRowStyle }] : []),
        ] : []

        const wsInstallments = XLSX.utils.aoa_to_sheet([
          instHeaderCells,
          ...instDataRows,
          ...(totalRow.length > 0 ? [totalRow] : []),
        ])

        wsInstallments['!cols'] = [
          { wch: 32 }, // Cliente
          { wch: 18 }, // Código Crédito
          { wch: 11 }, // N° Cuota
          { wch: 15 }, // Vencimiento
          { wch: 19 }, // Monto Cuota
          { wch: 19 }, // Monto Pagado
          { wch: 21 }, // Saldo Pendiente
          { wch: 13 }, // % Pagado
          { wch: 15 }, // Estado
          ...(includeDaysOverdue ? [{ wch: 14 }] : []),
        ]

        // Freeze Panes on Header Row (So header stays pinned while scrolling)
        wsInstallments['!freeze'] = { xSplit: 0, ySplit: 1 }

        // Autofilter for instant filtering inside Excel
        if (sortedInstallments.length > 0) {
          const lastColIndex = instHeaderTitles.length - 1
          const lastColLetter = XLSX.utils.encode_col(lastColIndex)
          wsInstallments['!autofilter'] = { ref: `A1:${lastColLetter}${sortedInstallments.length + 1}` }
        }

        XLSX.utils.book_append_sheet(wb, wsInstallments, 'Planilla de Cuotas')
      }

      // ── SHEET 3: HISTORIAL DE COBROS Y PAGOS (CON FÓRMULAS VIVAS) ───────────────
      if (scope === 'all' || scope === 'payments') {
        const payHeaderTitles = [
          'Cliente',
          'Código Crédito',
          'Fecha de Cobro',
          'Método de Pago',
          'Monto Cobrado (Gs.)',
          'Notas / Referencia',
        ]

        const payHeaderCells = payHeaderTitles.map((title) => ({
          v: title,
          s: tableHdrStyle,
        }))

        let sumPayAmount = 0
        const payDataRows = filteredPayments.map((p, rowIdx) => {
          const amt = Number(p.amount || 0)
          sumPayAmount += amt
          return [
            {
              v: creditById[p.credit_id]?.customer_name
                ? `${creditById[p.credit_id]?.customer_name}${creditById[p.credit_id]?.customer_code ? ` (${creditById[p.credit_id]?.customer_code})` : ''}`
                : 'Sin nombre',
              s: dataCellStyle(rowIdx, 'left'),
            },
            { v: creditById[p.credit_id]?.credit_code || p.credit_id, s: dataCellStyle(rowIdx, 'center') },
            { v: p.created_at ? new Date(p.created_at).toLocaleDateString('es-PY') : '', s: dataCellStyle(rowIdx, 'center') },
            { v: p.payment_method ? (p.payment_method === 'cash' ? 'Efectivo' : p.payment_method === 'card' ? 'Tarjeta' : p.payment_method === 'transfer' ? 'Transferencia' : p.payment_method) : 'Sin especificar', s: dataCellStyle(rowIdx, 'center') },
            { v: amt, t: 'n', z: numFormat, s: dataCellStyle(rowIdx, 'right', true) },
            { v: p.notes || '', s: dataCellStyle(rowIdx, 'left') },
          ]
        })

        const lastPayRow = filteredPayments.length > 0 ? filteredPayments.length + 1 : 2
        const payTotalRow = filteredPayments.length > 0 ? [
          { v: 'TOTAL RECAUDADO', s: { ...totalRowStyle, alignment: { horizontal: 'left', vertical: 'center' } } },
          { v: '', s: totalRowStyle },
          { v: '', s: totalRowStyle },
          // Total de cobros registrados
          { f: `COUNTA(A2:A${lastPayRow})`, v: filteredPayments.length, t: 'n', s: totalRowStyle },
          // Suma total recaudada -> FÓRMULA VIVA: =SUM(E2:E{N})
          { f: `SUM(E2:E${lastPayRow})`, v: sumPayAmount, t: 'n', z: numFormat, s: totalRowStyle },
          { v: '', s: totalRowStyle },
        ] : []

        const wsPayments = XLSX.utils.aoa_to_sheet([
          payHeaderCells,
          ...payDataRows,
          ...(payTotalRow.length > 0 ? [payTotalRow] : []),
        ])

        wsPayments['!cols'] = [
          { wch: 32 },
          { wch: 18 },
          { wch: 16 },
          { wch: 18 },
          { wch: 22 },
          { wch: 35 },
        ]

        // Freeze Panes and Autofilter
        wsPayments['!freeze'] = { xSplit: 0, ySplit: 1 }
        if (filteredPayments.length > 0) {
          wsPayments['!autofilter'] = { ref: `A1:F${filteredPayments.length + 1}` }
        }

        XLSX.utils.book_append_sheet(wb, wsPayments, 'Historial de Cobros')
      }

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      triggerDownload(blob, `reporte_creditos_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      console.error('Error generating Excel:', err)
    } finally {
      setIsExporting(null)
    }
  }

  // ─── Export: PDF con jsPDF y jsPDF-AutoTable ────────────────────────────────

  const handleExportPdf = async () => {
    setIsExporting('pdf')
    try {
      const { jsPDF, autoTable } = await loadPdfLibraries()
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const primaryColor: [number, number, number] = [15, 23, 42]
      const accentBlue: [number, number, number] = [37, 99, 235]

      // Header Banner
      doc.setFillColor(...primaryColor)
      doc.rect(0, 0, 210, 24, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(255, 255, 255)
      doc.text(
        selectedCustomer
          ? `REPORTE DE CRÉDITO Y COBRANZAS — ${selectedCustomer.name.toUpperCase()}`
          : 'REPORTE EJECUTIVO DE CRÉDITOS Y COBRANZAS',
        14,
        12
      )

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(203, 213, 225)
      const dateText = `Generado el ${new Date().toLocaleDateString('es-PY')} a las ${new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} · Sistema 4G`
      doc.text(dateText, 14, 19)

      // Filter summary line
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(
        `Filtros activos: ${selectedCustomer ? `Cliente: ${selectedCustomer.name} (${selectedCustomer.code || 'ID: ' + selectedCustomer.id}) | ` : ''}Estado = ${statusFilter.toUpperCase()} | Período = ${datePreset} | Cuotas evaluadas = ${metrics.totalCount}`,
        14,
        30
      )

      // KPI Metric Cards (Grid of 3)
      const startY = 34
      const cardW = 58
      const cardH = 22

      // Card 1: Total por Cobrar
      doc.setFillColor(239, 246, 255)
      doc.setDrawColor(191, 219, 254)
      doc.roundedRect(14, startY, cardW, cardH, 2, 2, 'FD')
      doc.setFontSize(7)
      doc.setTextColor(...accentBlue)
      doc.setFont('helvetica', 'bold')
      doc.text('TOTAL POR COBRAR', 18, startY + 6)
      doc.setFontSize(12)
      doc.setTextColor(30, 58, 138)
      doc.text(formatCurrency(metrics.totalOutstanding), 18, startY + 13.5)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(`${metrics.pendingCount + metrics.lateCount} cuotas abiertas`, 18, startY + 18.5)

      // Card 2: En Mora
      doc.setFillColor(255, 241, 242)
      doc.setDrawColor(254, 205, 211)
      doc.roundedRect(14 + cardW + 4, startY, cardW, cardH, 2, 2, 'FD')
      doc.setFontSize(7)
      doc.setTextColor(225, 29, 72)
      doc.setFont('helvetica', 'bold')
      doc.text('EN MORA / VENCIDO', 18 + cardW + 4, startY + 6)
      doc.setFontSize(12)
      doc.setTextColor(159, 18, 57)
      doc.text(formatCurrency(metrics.totalOverdue), 18 + cardW + 4, startY + 13.5)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(`${metrics.lateCount} cuotas (${metrics.overdueRate.toFixed(1)}%)`, 18 + cardW + 4, startY + 18.5)

      // Card 3: Recuperado
      doc.setFillColor(240, 253, 244)
      doc.setDrawColor(187, 247, 208)
      doc.roundedRect(14 + (cardW + 4) * 2, startY, cardW, cardH, 2, 2, 'FD')
      doc.setFontSize(7)
      doc.setTextColor(22, 101, 52)
      doc.setFont('helvetica', 'bold')
      doc.text('RECUPERADO / COBRADO', 18 + (cardW + 4) * 2, startY + 6)
      doc.setFontSize(12)
      doc.setTextColor(20, 83, 45)
      doc.text(formatCurrency(metrics.totalPaid), 18 + (cardW + 4) * 2, startY + 13.5)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(`${metrics.recoveryRate.toFixed(1)}% tasa de cobro`, 18 + (cardW + 4) * 2, startY + 18.5)

      // AutoTable
      const tableRows = sortedInstallments.slice(0, 180).map((i) => {
        const amt = Number(i.amount || 0)
        const paid = Math.max(0, Number(i.amount_paid || 0))
        const open = Math.max(0, amt - paid)
        const isLate = isInstallmentLate(i)
        const statusStr = i.status === 'paid' ? 'Pagada' : isLate ? 'En Mora' : 'Pendiente'

        return [
          creditById[i.credit_id]?.customer_name
            ? `${creditById[i.credit_id]?.customer_name}${creditById[i.credit_id]?.customer_code ? ` (${creditById[i.credit_id]?.customer_code})` : ''}`
            : 'Cliente',
          `#${i.installment_number}`,
          formatDateOnlyDisplay(i.due_date),
          formatCurrency(amt),
          formatCurrency(open),
          statusStr,
        ]
      })

      autoTable(doc, {
        startY: 61,
        head: [['Cliente', 'Cuota', 'Vence', 'Monto', 'Saldo', 'Estado']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 16, halign: 'center' },
          2: { cellWidth: 26, halign: 'center' },
          3: { cellWidth: 32, halign: 'right' },
          4: { cellWidth: 32, halign: 'right' },
          5: { cellWidth: 26, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const val = String(data.cell.raw)
            if (val === 'En Mora') {
              data.cell.styles.textColor = [225, 29, 72]
              data.cell.styles.fontStyle = 'bold'
            } else if (val === 'Pagada') {
              data.cell.styles.textColor = [16, 185, 129]
            }
          }
        },
      })

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        doc.setFontSize(7.5)
        doc.setTextColor(148, 163, 184)
        doc.text(
          `Página ${p} de ${pageCount} · Documento confidencial para gestión de cobranzas`,
          105,
          290,
          { align: 'center' }
        )
      }

      doc.save(`reporte_creditos_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('Error generating PDF:', err)
    } finally {
      setIsExporting(null)
    }
  }

  // ─── Export: CSV Universal UTF-8 ───────────────────────────────────────────

  const handleExportCsv = () => {
    setIsExporting('csv')
    try {
      type CsvRow = {
        'Código Cliente': string
        Cliente: string
        Crédito: string
        'N° Cuota': number
        Vencimiento: string
        'Monto (Gs)': number
        'Pagado (Gs)': number
        'Saldo (Gs)': number
        Estado: string
      }

      const headers: Array<keyof CsvRow> = [
        'Código Cliente',
        'Cliente',
        'Crédito',
        'N° Cuota',
        'Vencimiento',
        'Monto (Gs)',
        'Pagado (Gs)',
        'Saldo (Gs)',
        'Estado',
      ]

      const rows: CsvRow[] = sortedInstallments.map((i) => {
        const amt = Number(i.amount || 0)
        const paid = Math.max(0, Number(i.amount_paid || 0))
        const open = Math.max(0, amt - paid)
        const isLate = isInstallmentLate(i)
        return {
          'Código Cliente': creditById[i.credit_id]?.customer_code || '',
          Cliente: creditById[i.credit_id]?.customer_name || '',
          Crédito: creditById[i.credit_id]?.credit_code || i.credit_id,
          'N° Cuota': i.installment_number,
          Vencimiento: formatDateOnlyDisplay(i.due_date),
          'Monto (Gs)': amt,
          'Pagado (Gs)': paid,
          'Saldo (Gs)': open,
          Estado: i.status === 'paid' ? 'Pagada' : isLate ? 'En Mora' : 'Pendiente',
        }
      })

      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')),
      ].join('\n')

      const bom = '\uFEFF'
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
      triggerDownload(blob, `cuotas_${new Date().toISOString().slice(0, 10)}.csv`)
    } finally {
      setIsExporting(null)
    }
  }

  // Preview data pagination
  const previewPageSize = 7
  const pagedPreviewInstallments = useMemo(() => {
    const start = (previewPage - 1) * previewPageSize
    return sortedInstallments.slice(start, start + previewPageSize)
  }, [sortedInstallments, previewPage])

  const totalPreviewPages = Math.max(1, Math.ceil(sortedInstallments.length / previewPageSize))

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl bg-white dark:bg-[#0c1017]">
        {/* Modal Header (Fijo) */}
        <DialogHeader className="shrink-0 px-6 pt-5 pb-3 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.01]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Exportar Datos de Cartera</span>
                  <Badge variant="outline" className="text-[10px] font-semibold bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
                    {metrics.totalCount} cuotas
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Reporte financiero y planilla de cobranzas en Excel (.xlsx), PDF o CSV
                </DialogDescription>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'summary'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Resumen y Gráficos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('filters')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all relative ${
                  activeTab === 'filters'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filtros y Opciones</span>
                {isFiltered && (
                  <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Vista Previa ({sortedInstallments.length})</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body Container with Adaptive Height and Breathing Room */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 sm:px-7 py-5 space-y-5">
          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.01]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Plantillas:</span>
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset('all')}
                className={`h-8 px-3 text-xs rounded-xl font-medium transition-all ${
                  !isFiltered ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Reporte Completo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset('overdue')}
                className={`h-8 px-3 text-xs rounded-xl border-rose-200 dark:border-rose-900 transition-all ${
                  statusFilter === 'late' ? 'bg-rose-600 text-white font-semibold shadow-xs' : 'text-rose-700 dark:text-rose-300 hover:bg-rose-50'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Planilla de Morosidad
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset('this_month')}
                className={`h-8 px-3 text-xs rounded-xl border-blue-200 dark:border-blue-900 transition-all ${
                  datePreset === 'this_month' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-blue-700 dark:text-blue-300 hover:bg-blue-50'
                }`}
              >
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Cobranzas del Mes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset('paid')}
                className={`h-8 px-3 text-xs rounded-xl border-emerald-200 dark:border-emerald-900 transition-all ${
                  statusFilter === 'paid' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Cuotas Canceladas
              </Button>
            </div>

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* TAB 1: RESUMEN Y GRÁFICOS (SPACIOUS EXECUTIVE LAYOUT) */}
          {activeTab === 'summary' && (
            <div className="space-y-5">
              {/* Row 1: 4 KPIs Independientes y Amplios */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Por Cobrar */}
                <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-1">
                  <div className="flex items-center justify-between text-blue-700 dark:text-blue-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Por Cobrar</span>
                    <Clock className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-extrabold text-blue-950 dark:text-blue-100 font-mono tabular-nums pt-1">
                    {formatCurrency(metrics.totalOutstanding)}
                  </p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400 font-medium">
                    {metrics.pendingCount + metrics.lateCount} cuotas abiertas
                  </p>
                </div>

                {/* En Mora */}
                <div className="rounded-2xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-4 space-y-1">
                  <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">En Mora / Vencido</span>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-extrabold text-rose-950 dark:text-rose-100 font-mono tabular-nums pt-1">
                    {formatCurrency(metrics.totalOverdue)}
                  </p>
                  <p className="text-xs text-rose-600/80 dark:text-rose-400 font-medium">
                    {metrics.lateCount} cuotas ({metrics.overdueRate.toFixed(1)}%)
                  </p>
                </div>

                {/* Recuperado */}
                <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-1">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Recuperado</span>
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-extrabold text-emerald-950 dark:text-emerald-100 font-mono tabular-nums pt-1">
                    {formatCurrency(metrics.totalPaid)}
                  </p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400 font-medium">
                    {metrics.paidCount} cuotas saldadas
                  </p>
                </div>

                {/* Clientes y Créditos */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] p-4 space-y-1">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Cartera Total</span>
                    <Users className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums pt-1">
                    {formatCurrency(metrics.totalScheduled)}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {metrics.involvedCredits} créditos involucrados
                  </p>
                </div>
              </div>

              {/* Row 2: Dos Bloques Visuales Amplios Lado a Lado */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bloque Izquierdo: Donut de Recuperación */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-950/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Tasa de Cobranza y Cobertura
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Porcentaje cobrado sobre la cartera visible
                      </p>
                    </div>
                    <Badge variant="outline" className="font-semibold text-xs border-emerald-300 text-emerald-700 dark:text-emerald-400">
                      {metrics.recoveryRate.toFixed(1)}% Cobrado
                    </Badge>
                  </div>

                  <div className="flex items-center gap-6 pt-2">
                    <div className="relative shrink-0">
                      <DonutChart segments={donutSegments} size={110} strokeWidth={15} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Tasa</span>
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {metrics.recoveryRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">Cobrado</span>
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {formatCurrency(metrics.totalPaid)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">Al Día (Vigente)</span>
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {formatCurrency(metrics.currentAmount)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">En Mora</span>
                        </span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                          {formatCurrency(metrics.totalOverdue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bloque Derecho: Aging / Tramos de Morosidad */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-950/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Antigüedad de Deuda (Aging)
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Distribución del saldo vencido por tramos de días
                      </p>
                    </div>
                    <Badge variant="outline" className="font-semibold text-xs border-rose-300 text-rose-700 dark:text-rose-400">
                      {metrics.lateCount} cuotas atrasadas
                    </Badge>
                  </div>

                  <div className="space-y-3 pt-1">
                    <MiniAgingBar
                      label="1 a 7 días de atraso"
                      amount={metrics.aging.aging1to7}
                      count={metrics.aging.aging1to7Count}
                      pct={metrics.totalOverdue > 0 ? (metrics.aging.aging1to7 / metrics.totalOverdue) * 100 : 0}
                      color="#f59e0b"
                    />
                    <MiniAgingBar
                      label="8 a 30 días de atraso"
                      amount={metrics.aging.aging8to30}
                      count={metrics.aging.aging8to30Count}
                      pct={metrics.totalOverdue > 0 ? (metrics.aging.aging8to30 / metrics.totalOverdue) * 100 : 0}
                      color="#f97316"
                    />
                    <MiniAgingBar
                      label="31 a 60 días de atraso"
                      amount={metrics.aging.aging31to60}
                      count={metrics.aging.aging31to60Count}
                      pct={metrics.totalOverdue > 0 ? (metrics.aging.aging31to60 / metrics.totalOverdue) * 100 : 0}
                      color="#ef4444"
                    />
                    <MiniAgingBar
                      label="Más de 60 días de atraso"
                      amount={metrics.aging.aging60plus}
                      count={metrics.aging.aging60plusCount}
                      pct={metrics.totalOverdue > 0 ? (metrics.aging.aging60plus / metrics.totalOverdue) * 100 : 0}
                      color="#b91c1c"
                    />
                  </div>
                </div>
              </div>

              {/* Banner de Alcance y Botón para afinar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-white/[0.01]">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alcance seleccionado:</span>
                  <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">
                    {scope === 'all'
                      ? 'Reporte Completo (Resumen + Cuotas + Pagos)'
                      : scope === 'installments'
                      ? 'Solo Planilla de Cuotas y Vencimientos'
                      : 'Solo Historial de Pagos y Recaudación'}
                  </Badge>
                  {selectedCustomer && (
                    <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 border-blue-300 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30">
                      Cliente: {selectedCustomer.name}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('filters')}
                  className="h-8 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 gap-1.5 rounded-xl border-blue-200 dark:border-blue-900"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Ajustar filtros y columnas</span>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: FILTROS Y OPCIONES (CLEAN & SPACIOUS CONFIGURATION) */}
          {activeTab === 'filters' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-950/40 p-5 space-y-5">
                {/* 1. Filtro de Clientes y Estado */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-blue-600" />
                      <span>Filtro de Clientes y Estado</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {selectedCustomer ? '1 cliente filtrado' : `${customerList.length} clientes en cartera`}
                    </span>
                  </div>

                  {/* Customer Card or Customer Selector */}
                  {selectedCustomer ? (
                    <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900/60 p-4 sm:p-5 shadow-xs transition-all space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        <div className="flex items-center gap-3.5">
                          <div className={`relative h-12 w-12 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(selectedCustomer.name)} flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0 ring-2 ring-white dark:ring-slate-900`}>
                            {getInitials(selectedCustomer.name)}
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white shadow-xs">
                              <Check className="h-3 w-3" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                                {selectedCustomer.name}
                              </h3>
                              {selectedCustomer.code && (
                                <Badge variant="secondary" className="font-mono text-[11px] font-semibold px-2 py-0.5 bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {selectedCustomer.code}
                                </Badge>
                              )}
                              {selectedCustomer.hasOverdue ? (
                                <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold gap-1 px-2 py-0.5">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>En Mora</span>
                                </Badge>
                              ) : selectedCustomer.totalOpen > 0 ? (
                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold gap-1 px-2 py-0.5">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Al Día</span>
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold gap-1 px-2 py-0.5">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Saldado</span>
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                              <span>{selectedCustomer.creditCount} {selectedCustomer.creditCount === 1 ? 'crédito registrado' : 'créditos registrados'}</span>
                              <span>•</span>
                              <span>{selectedCustomer.pendingCount + selectedCustomer.lateCount} cuotas pendientes</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsCustomerPickerOpen((prev) => !prev)}
                            className="h-8 px-3 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 gap-1.5"
                          >
                            <Users className="h-3.5 w-3.5 text-blue-600" />
                            <span>{isCustomerPickerOpen ? 'Ocultar lista' : 'Cambiar cliente'}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCustomerId(null)
                              setCustomerSearchQuery('')
                              setIsCustomerPickerOpen(false)
                            }}
                            className="h-8 px-2.5 text-xs font-semibold rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1"
                            title="Quitar filtro de cliente y ver todos"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Ver todos</span>
                          </Button>
                        </div>
                      </div>

                      {/* Customer stats strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-blue-200/50 dark:border-blue-900/40 text-xs">
                        <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Deuda Total</p>
                          <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                            {formatCurrency(selectedCustomer.totalOpen)}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
                          <p className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Saldo Vencido</p>
                          <p className={`text-sm font-bold font-mono mt-0.5 ${selectedCustomer.overdueOpen > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                            {formatCurrency(selectedCustomer.overdueOpen)}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
                          <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Total Cobrado</p>
                          <p className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                            {formatCurrency(selectedCustomer.totalPaid)}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Cuotas</p>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                            {selectedCustomer.lateCount > 0 ? (
                              <span className="text-rose-600 font-bold">{selectedCustomer.lateCount} en mora</span>
                            ) : (
                              <span className="text-emerald-600 font-medium">0 en mora</span>
                            )}
                            {' · '}
                            <span>{selectedCustomer.pendingCount} al día</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                Cartera Completa (Todos los Clientes)
                              </h4>
                              <Badge variant="outline" className="text-[10px] font-semibold border-blue-200 text-blue-700 dark:text-blue-300">
                                {customerList.length} clientes
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              El archivo y reporte consolidará cuotas de todos los titulares de crédito.
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCustomerPickerOpen((prev) => !prev)}
                          className="h-9 px-3.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-400 text-blue-600 dark:text-blue-400 gap-1.5 shrink-0"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>{isCustomerPickerOpen ? 'Cerrar selector' : 'Seleccionar cliente específico'}</span>
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCustomerPickerOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Customer Picker Dropdown (Expandable) */}
                  {isCustomerPickerOpen && (
                    <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-950 p-3.5 space-y-3 shadow-md">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Search className="h-3.5 w-3.5 text-blue-600" />
                          <span>Buscar cliente en la cartera</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {filteredCustomerList.length} coincidencias
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Escriba nombre o código (ej. Juan Pérez, CLI-012)..."
                          value={customerSearchQuery}
                          onChange={(e) => setCustomerSearchQuery(e.target.value)}
                          className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border-slate-200 dark:border-slate-800"
                          autoFocus
                        />
                        {customerSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCustomerSearchQuery('')}
                            className="absolute right-3 top-2.5 text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Customer list scrollable */}
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                        {/* Option: Todos los clientes */}
                        <div
                          onClick={() => {
                            setSelectedCustomerId(null)
                            setIsCustomerPickerOpen(false)
                            setCustomerSearchQuery('')
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                            selectedCustomerId === null
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-800'
                              : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                              <Users className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-xs text-slate-900 dark:text-white">
                                Todos los clientes (Sin filtro)
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Exportar la cartera completa consolidada
                              </p>
                            </div>
                          </div>
                          {selectedCustomerId === null && (
                            <div className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </div>

                        {filteredCustomerList.length === 0 ? (
                          <div className="text-center py-6 text-xs text-muted-foreground">
                            No se encontraron clientes para &quot;{customerSearchQuery}&quot;
                          </div>
                        ) : (
                          filteredCustomerList.map((c) => {
                            const isSelected = selectedCustomerId === c.id
                            return (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setSelectedCustomerId(c.id)
                                  setIsCustomerPickerOpen(false)
                                  setCustomerSearchQuery('')
                                }}
                                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                                  isSelected
                                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-800'
                                    : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-tr ${getAvatarGradient(c.name)} flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs`}>
                                    {getInitials(c.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                        {c.name}
                                      </span>
                                      {c.code && (
                                        <span className="font-mono text-[10px] text-muted-foreground bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200/60 dark:border-slate-700 shrink-0">
                                          {c.code}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                      {c.creditCount} {c.creditCount === 1 ? 'crédito' : 'créditos'} · {c.pendingCount + c.lateCount} cuotas abiertas
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 pl-2">
                                  {c.hasOverdue ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900">
                                      <AlertTriangle className="h-3 w-3" />
                                      <span>Mora: {formatCurrency(c.overdueOpen)}</span>
                                    </span>
                                  ) : c.totalOpen > 0 ? (
                                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                      Saldo: {formatCurrency(c.totalOpen)}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                                      Al día
                                    </span>
                                  )}

                                  {isSelected && (
                                    <div className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                                      <Check className="h-3 w-3" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Secondary filters: Text search + Status pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por crédito, origen o nota..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-10 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {[
                        { id: 'all', label: 'Todas' },
                        { id: 'pending', label: 'Pendientes' },
                        { id: 'late', label: 'En Mora' },
                        { id: 'paid', label: 'Pagadas' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setStatusFilter(s.id as StatusFilter)}
                          className={`flex-1 h-10 px-3 rounded-xl text-xs font-semibold transition-all ${
                            statusFilter === s.id
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Rango de Fechas */}
                <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    <span>Período de Vencimiento</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {[
                      { id: 'all', label: 'Cualquier fecha' },
                      { id: 'this_month', label: 'Mes actual' },
                      { id: 'last_30', label: 'Últimos 30 días' },
                      { id: 'custom', label: 'Personalizado' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDatePreset(p.id as DatePreset)}
                        className={`h-9 px-4 rounded-xl text-xs font-semibold transition-all ${
                          datePreset === p.id
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}

                    {datePreset === 'custom' && (
                      <div className="flex items-center gap-2 ml-auto">
                        <Input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="h-9 text-xs w-36 bg-slate-50 dark:bg-slate-900 rounded-xl"
                        />
                        <span className="text-xs text-muted-foreground font-medium">a</span>
                        <Input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="h-9 text-xs w-36 bg-slate-50 dark:bg-slate-900 rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Alcance y Columnas */}
                <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-blue-600" />
                      <span>Hojas a Incluir en el Archivo</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'all', title: 'Completo', desc: 'Resumen + Cuotas + Pagos' },
                        { id: 'installments', title: 'Solo Cuotas', desc: 'Vencimientos y saldos' },
                        { id: 'payments', title: 'Solo Pagos', desc: 'Cobros registrados' },
                      ].map((sc) => (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => setScope(sc.id as ExportScope)}
                          className={`text-left p-3 rounded-2xl border transition-all ${
                            scope === sc.id
                              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 text-blue-950 dark:text-blue-100 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <p className="text-xs font-bold">{sc.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{sc.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
                      <span>Detalles de Columnas</span>
                    </label>
                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 space-y-2.5">
                      <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={includeDaysOverdue}
                          onChange={(e) => setIncludeDaysOverdue(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>Calcular días de atraso en mora</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={includeOrigin}
                          onChange={(e) => setIncludeOrigin(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>Código de crédito y origen</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VISTA PREVIA (SPACIOUS TABLE) */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>
                  Mostrando <strong>{sortedInstallments.length} cuotas</strong> según los filtros actuales
                </span>
                <span>Página <strong>{previewPage}</strong> de {totalPreviewPages}</span>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950/50 text-xs">
                <div className="grid grid-cols-[1.5fr_auto_auto_auto_auto] gap-3 px-4 py-3 bg-slate-100/80 dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSort('customer')}
                    className="flex items-center gap-1.5 text-left hover:text-blue-600"
                  >
                    <span>Cliente</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <span className="w-14 text-center">Cuota</span>
                  <button
                    type="button"
                    onClick={() => handleSort('dueDate')}
                    className="w-28 flex items-center justify-center gap-1.5 hover:text-blue-600"
                  >
                    <span>Vencimiento</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort('amount')}
                    className="w-32 flex items-center justify-end gap-1.5 hover:text-blue-600"
                  >
                    <span>Monto</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className="w-24 flex items-center justify-center gap-1.5 hover:text-blue-600"
                  >
                    <span>Estado</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </div>

                {pagedPreviewInstallments.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground space-y-3">
                    <p className="font-semibold text-sm">No se encontraron cuotas con los filtros aplicados</p>
                    <Button variant="outline" size="sm" onClick={handleResetFilters} className="rounded-xl">
                      Limpiar filtros
                    </Button>
                  </div>
                ) : (
                  pagedPreviewInstallments.map((inst) => {
                    const isLate = isInstallmentLate(inst)
                    const statusBadge =
                      inst.status === 'paid' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Pagada
                        </span>
                      ) : isLate ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                          En Mora
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          Pendiente
                        </span>
                      )

                    return (
                      <div
                        key={inst.id}
                        className="grid grid-cols-[1.5fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center border-b border-slate-100 dark:border-slate-800/60 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`h-7 w-7 rounded-lg bg-gradient-to-tr ${getAvatarGradient(creditById[inst.credit_id]?.customer_name || 'Cliente')} flex items-center justify-center text-white font-bold text-[10px] shrink-0 shadow-xs`}>
                            {getInitials(creditById[inst.credit_id]?.customer_name || 'Cliente')}
                          </div>
                          <div className="min-w-0 truncate">
                            <div className="truncate font-semibold text-xs text-slate-900 dark:text-white">
                              {creditById[inst.credit_id]?.customer_name || 'Sin nombre'}
                            </div>
                            {creditById[inst.credit_id]?.customer_code && (
                              <div className="font-mono text-[10px] text-muted-foreground truncate">
                                {creditById[inst.credit_id]?.customer_code}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="w-14 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                          #{inst.installment_number}
                        </div>
                        <div className="w-28 text-center text-muted-foreground">
                          {formatDateOnlyDisplay(inst.due_date)}
                        </div>
                        <div className="w-32 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(inst.amount)}
                        </div>
                        <div className="w-24 text-center">{statusBadge}</div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Pagination */}
              {totalPreviewPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-xl"
                    disabled={previewPage === 1}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground font-medium">
                    {previewPage} de {totalPreviewPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-xl"
                    disabled={previewPage === totalPreviewPages}
                    onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Persistent Footer with 3 Generous Download Buttons */}
        <div className="shrink-0 px-6 sm:px-7 py-3.5 border-t border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            <span>Se exportarán <strong>{metrics.totalCount} cuotas</strong></span>
            <span className="mx-2">·</span>
            <span>Saldo: <strong className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(metrics.totalOutstanding)}</strong></span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Excel */}
            <Button
              size="sm"
              className="flex-1 sm:flex-none h-10 px-4 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              onClick={handleExportExcel}
              disabled={isExporting !== null || sortedInstallments.length === 0}
            >
              {isExporting === 'excel' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              <span>Descargar Excel (.xlsx)</span>
            </Button>

            {/* PDF */}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none h-10 px-4 gap-2 rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/20 font-semibold"
              onClick={handleExportPdf}
              disabled={isExporting !== null || sortedInstallments.length === 0}
            >
              {isExporting === 'pdf' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 text-rose-600" />
              )}
              <span>Reporte PDF</span>
            </Button>

            {/* CSV */}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none h-10 px-4 gap-2 rounded-xl border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
              onClick={handleExportCsv}
              disabled={isExporting !== null || sortedInstallments.length === 0}
            >
              {isExporting === 'csv' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 text-slate-500" />
              )}
              <span>CSV</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
