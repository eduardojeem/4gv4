'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/currency'
import { formatCustomerId, formatCreditId } from '@/lib/utils'
import {
    Calendar, DollarSign, Percent, TrendingUp,
    Clock, CheckCircle, Receipt, FileText, FileDown, Printer,
    AlertCircle, CalendarClock
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface InstallmentItem {
    id: string
    installment_number: number
    due_date: string
    amount: number
    status: 'pending' | 'paid' | 'late'
    paid_at?: string | null
    amount_paid?: number | null
}

interface PaymentItem {
    id: string
    amount: number
    payment_method?: string
    created_at?: string
}

interface CreditDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    credit: {
        id: string
        customer_id: string
        customer_name: string
        principal: number
        interest_rate: number
        term_months: number
        start_date: string
        status: 'active' | 'completed' | 'defaulted' | 'cancelled'
        customer_code?: string
    } | null
    installments: InstallmentItem[]
    payments: PaymentItem[]
    remainingBalance: number
    paidAmount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
    active: 'Activo', completed: 'Completado', defaulted: 'Moroso', cancelled: 'Cancelado'
}
const STATUS_STYLE: Record<string, string> = {
    active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    defaulted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
}
const METHOD_LABEL: Record<string, string> = {
    cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia'
}
const METHOD_STYLE: Record<string, string> = {
    cash:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    card:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    transfer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

function getInstallmentStatus(inst: InstallmentItem): 'paid' | 'late' | 'overdue' | 'pending' {
    if (inst.status === 'paid') return 'paid'
    if (inst.status === 'late') return 'late'
    if (new Date(inst.due_date) < new Date()) return 'overdue'
    return 'pending'
}

const INST_STATUS_CONFIG = {
    paid:    { label: 'Pagada',    Icon: CheckCircle,   color: 'text-green-600 dark:text-green-400',  rowBg: '' },
    late:    { label: 'Atrasada',  Icon: AlertCircle,   color: 'text-red-600 dark:text-red-400',      rowBg: 'bg-red-50/40 dark:bg-red-900/10' },
    overdue: { label: 'Vencida',   Icon: Clock,         color: 'text-orange-600 dark:text-orange-400',rowBg: 'bg-orange-50/40 dark:bg-orange-900/10' },
    pending: { label: 'Pendiente', Icon: CalendarClock, color: 'text-blue-600 dark:text-blue-400',    rowBg: '' },
}

function avatarGradient(name: string) {
    const g = ['from-blue-500 to-blue-700','from-violet-500 to-violet-700','from-emerald-500 to-emerald-700',
               'from-rose-500 to-rose-700','from-amber-500 to-amber-700','from-cyan-500 to-cyan-700']
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
    return g[Math.abs(h) % g.length]
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CreditDetailDialog({
    open, onOpenChange, credit, installments, payments, remainingBalance, paidAmount
}: CreditDetailDialogProps) {
    if (!credit) return null

    const totalAmount = paidAmount + remainingBalance
    const progressPct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0
    const endDate = new Date(credit.start_date)
    endDate.setMonth(endDate.getMonth() + credit.term_months)

    const initials = credit.customer_name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const gradient = avatarGradient(credit.customer_name)
    const lateCount = installments.filter(i => getInstallmentStatus(i) === 'late' || getInstallmentStatus(i) === 'overdue').length

    // ─── Export helpers ───────────────────────────────────────────────────────
    const exportDetailCsv = () => {
        const esc = (v: string | number) => {
            const t = String(v ?? '').replace(/\r?\n/g, ' ').replace(/\t/g, ' ').trim()
            return /^[=+\-@]/.test(t) ? `'${t}` : t
        }
        const row = (...cols: (string | number)[]) => cols.map(esc).join('\t') + '\n'
        let tsv = 'DETALLE DEL CRÉDITO\n'
        tsv += row('Campo','Valor')
        tsv += row('ID Crédito', formatCreditId(credit.id))
        tsv += row('Cliente', credit.customer_name)
        tsv += row('Estado', STATUS_LABEL[credit.status] ?? credit.status)
        tsv += row('Principal', credit.principal)
        tsv += row('Tasa', `${credit.interest_rate}%`)
        tsv += row('Plazo', `${credit.term_months} meses`)
        tsv += row('Inicio', new Date(credit.start_date).toLocaleDateString('es-AR'))
        tsv += row('Fin estimado', endDate.toLocaleDateString('es-AR'))
        tsv += row('Pagado', paidAmount)
        tsv += row('Pendiente', remainingBalance)
        tsv += row('Progreso', `${progressPct}%`)
        tsv += '\nCUOTAS\n' + row('N°','Vencimiento','Monto','Pagado','Estado')
        installments.forEach(i => tsv += row(i.installment_number, new Date(i.due_date).toLocaleDateString('es-AR'), i.amount, i.amount_paid ?? 0, INST_STATUS_CONFIG[getInstallmentStatus(i)].label))
        tsv += '\nPAGOS\n' + row('Fecha','Método','Monto')
        if (payments.length === 0) tsv += row('Sin pagos','','')
        else payments.forEach(p => tsv += row(p.created_at ? new Date(p.created_at).toLocaleString('es-AR') : '-', METHOD_LABEL[p.payment_method ?? ''] ?? p.payment_method ?? '-', p.amount))
        const blob = new Blob(['\uFEFF' + tsv], { type: 'text/tab-separated-values;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `credito_${credit.id}_detalle.xls`; a.click()
        URL.revokeObjectURL(url)
    }

    const generateDetailDoc = async () => {
        const { default: jsPDF } = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const pageW = doc.internal.pageSize.getWidth()
        doc.setFontSize(18); doc.setFont('helvetica','bold')
        doc.text('Detalle del Crédito', pageW / 2, 18, { align: 'center' })
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(100)
        doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, pageW / 2, 24, { align: 'center' })
        doc.setTextColor(0)
        autoTable(doc, { startY: 30, head:[['Campo','Valor']], body:[
            ['ID', formatCreditId(credit.id)],['Cliente', credit.customer_name],
            ['Estado', STATUS_LABEL[credit.status] ?? credit.status],
            ['Principal', formatCurrency(credit.principal)],['Tasa', `${credit.interest_rate}%`],
            ['Plazo', `${credit.term_months} meses`],
            ['Inicio', new Date(credit.start_date).toLocaleDateString('es-AR')],
            ['Fin estimado', endDate.toLocaleDateString('es-AR')],
            ['Pagado', formatCurrency(paidAmount)],['Pendiente', formatCurrency(remainingBalance)],
            ['Progreso', `${progressPct}%`],
        ], theme:'grid', headStyles:{fillColor:[37,99,235],textColor:255,fontStyle:'bold'},
           columnStyles:{0:{fontStyle:'bold',cellWidth:60}}, margin:{left:14,right:14} })
        const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
        doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Cuotas', 14, y1)
        autoTable(doc, { startY: y1+4, head:[['N°','Vencimiento','Monto','Pagado','Estado']],
            body: installments.map(i => [i.installment_number, new Date(i.due_date).toLocaleDateString('es-AR'),
                formatCurrency(i.amount), formatCurrency(i.amount_paid ?? 0), INST_STATUS_CONFIG[getInstallmentStatus(i)].label]),
            theme:'striped', headStyles:{fillColor:[234,88,12],textColor:255,fontStyle:'bold'}, margin:{left:14,right:14} })
        const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
        doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Pagos Registrados', 14, y2)
        autoTable(doc, { startY: y2+4, head:[['Fecha','Método','Monto']],
            body: payments.length === 0 ? [['Sin pagos','-','-']] : payments.map(p => [
                p.created_at ? new Date(p.created_at).toLocaleString('es-AR') : '-',
                METHOD_LABEL[p.payment_method ?? ''] ?? p.payment_method ?? '-',
                formatCurrency(p.amount)]),
            theme:'striped', headStyles:{fillColor:[22,163,74],textColor:255,fontStyle:'bold'}, margin:{left:14,right:14} })
        return doc
    }

    const exportDetailPdf = async () => { const doc = await generateDetailDoc(); doc.save(`credito_${credit.id}_detalle.pdf`) }
    const printDetailPdf = async () => { const doc = await generateDetailDoc(); doc.autoPrint(); doc.output('dataurlnewwindow') }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">

                {/* ── Hero header ── */}
                <div className="relative px-6 pt-6 pb-5 border-b border-border/60 bg-gradient-to-br from-blue-50/60 to-slate-50/40 dark:from-blue-900/10 dark:to-slate-800/20">
                    <DialogHeader>
                        <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className={`flex-shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-lg font-bold shadow-md select-none`}>
                                {initials}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <DialogTitle className="text-xl font-bold leading-tight">{credit.customer_name}</DialogTitle>
                                        <DialogDescription className="text-xs font-mono mt-0.5">{formatCreditId(credit.id)} · {credit.customer_code || formatCustomerId(credit.customer_id)}</DialogDescription>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLE[credit.status] ?? STATUS_STYLE.cancelled}`}>
                                            {STATUS_LABEL[credit.status]}
                                        </span>
                                        {lateCount > 0 && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 animate-pulse">
                                                {lateCount} atrasada{lateCount > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="mt-3 space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-green-600 dark:text-green-400 font-medium tabular-nums">{formatCurrency(paidAmount)} pagado</span>
                                        <span className="font-bold tabular-nums">{progressPct}%</span>
                                        <span className="text-muted-foreground tabular-nums">{formatCurrency(remainingBalance)} pendiente</span>
                                    </div>
                                    <div className="h-2.5 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden border border-white/40">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-700"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-5">
                    {/* ── Metrics grid ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Principal', value: formatCurrency(credit.principal), Icon: DollarSign, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
                            { label: 'Tasa de interés', value: `${credit.interest_rate}%`, Icon: Percent, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
                            { label: 'Plazo', value: `${credit.term_months} m.`, Icon: Calendar, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
                            { label: 'Progreso', value: `${progressPct}%`, Icon: TrendingUp, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
                        ].map(({ label, value, Icon, color, bg }) => (
                            <div key={label} className={`rounded-xl border p-3 ${bg}`}>
                                <Icon className={`h-4 w-4 ${color} mb-1.5`} />
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                                <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Dates row ── */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-muted/30">
                            <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Inicio</p>
                                <p className="text-sm font-semibold">{new Date(credit.start_date).toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' })}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-muted/30">
                            <Clock className="h-4 w-4 text-orange-600 shrink-0" />
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fin estimado</p>
                                <p className="text-sm font-semibold">{endDate.toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' })}</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Tabs ── */}
                    <Tabs defaultValue="installments" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-9">
                            <TabsTrigger value="installments" className="text-xs gap-1.5">
                                <Receipt className="h-3.5 w-3.5" />
                                Cuotas
                                <span className="ml-1 text-[10px] font-bold bg-muted rounded-full px-1.5">{installments.length}</span>
                            </TabsTrigger>
                            <TabsTrigger value="payments" className="text-xs gap-1.5">
                                <DollarSign className="h-3.5 w-3.5" />
                                Pagos
                                <span className="ml-1 text-[10px] font-bold bg-muted rounded-full px-1.5">{payments.length}</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* Installments */}
                        <TabsContent value="installments" className="mt-3">
                            <div className="rounded-xl border border-border/50 overflow-hidden">
                                {/* Header */}
                                <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_140px] gap-3 items-center px-4 py-2 bg-muted/40 border-b border-border/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                    <span className="w-8 text-center">#</span>
                                    <span>Vencimiento</span>
                                    <span className="text-right w-24">Monto</span>
                                    <span className="text-right w-24">Pagado</span>
                                    <span className="text-center">Estado / Progreso</span>
                                </div>
                                {installments.map((inst, idx) => {
                                    const s = getInstallmentStatus(inst)
                                    const cfg = INST_STATUS_CONFIG[s]
                                    const StatusIcon = cfg.Icon
                                    const paid = Number(inst.amount_paid || 0)
                                    const amt = Number(inst.amount || 0)
                                    const pct = amt > 0 ? Math.min(100, Math.round((paid / amt) * 100)) : 0
                                    const rowBg = cfg.rowBg || (idx % 2 === 0 ? 'bg-white dark:bg-white/[0.02]' : 'bg-slate-50/50 dark:bg-white/[0.01]')
                                    return (
                                        <div key={inst.id} className={`grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_auto_140px] gap-2 sm:gap-3 items-center px-4 py-3 border-b border-border/30 last:border-0 transition-colors ${rowBg}`}>
                                            <span className="w-8 text-center text-sm font-mono font-bold text-muted-foreground">#{inst.installment_number}</span>
                                            <div>
                                                <p className="text-sm font-medium">{new Date(inst.due_date).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' })}</p>
                                                {/* Mobile: amount inline */}
                                                <p className="text-xs text-muted-foreground sm:hidden tabular-nums">{formatCurrency(inst.amount)}</p>
                                            </div>
                                            <div className="hidden sm:block text-right w-24">
                                                <p className="text-sm font-semibold tabular-nums">{formatCurrency(inst.amount)}</p>
                                            </div>
                                            <div className="hidden sm:block text-right w-24">
                                                <p className={`text-sm tabular-nums ${paid > 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}>
                                                    {formatCurrency(paid)}
                                                </p>
                                            </div>
                                            <div className="col-span-2 sm:col-span-1 w-full sm:w-[140px] space-y-1">
                                                <div className={`flex items-center gap-1 ${cfg.color}`}>
                                                    <StatusIcon className="h-3 w-3 shrink-0" />
                                                    <span className="text-[11px] font-semibold">{cfg.label}</span>
                                                </div>
                                                {pct > 0 && (
                                                    <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </TabsContent>

                        {/* Payments */}
                        <TabsContent value="payments" className="mt-3">
                            {payments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed border-border text-center">
                                    <div className="p-3 rounded-full bg-muted/50 mb-2"><Receipt className="h-6 w-6 text-muted-foreground/50" /></div>
                                    <p className="text-sm font-medium text-muted-foreground">Sin pagos registrados</p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/30">
                                    {payments.map((p, idx) => {
                                        const mStyle = METHOD_STYLE[p.payment_method ?? ''] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        const mLabel = METHOD_LABEL[p.payment_method ?? ''] ?? p.payment_method ?? '—'
                                        const rowBg = idx % 2 === 0 ? 'bg-white dark:bg-white/[0.02]' : 'bg-slate-50/50 dark:bg-white/[0.01]'
                                        return (
                                            <div key={p.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-green-50/20 dark:hover:bg-green-900/10 transition-colors ${rowBg}`}>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium">{p.created_at ? new Date(p.created_at).toLocaleString('es-AR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</p>
                                                </div>
                                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${mStyle}`}>{mLabel}</span>
                                                <p className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums shrink-0">+{formatCurrency(p.amount)}</p>
                                            </div>
                                        )
                                    })}
                                    {/* Total row */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total recibido</span>
                                        <span className="text-base font-bold text-green-600 dark:text-green-400 tabular-nums">
                                            {formatCurrency(payments.reduce((s, p) => s + Number(p.amount || 0), 0))}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    {/* ── Actions ── */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportDetailCsv}>
                            <FileText className="h-3.5 w-3.5" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400" onClick={exportDetailPdf}>
                            <FileDown className="h-3.5 w-3.5" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400" onClick={printDetailPdf}>
                            <Printer className="h-3.5 w-3.5" /> Imprimir
                        </Button>
                        <Button size="sm" className="h-8 ml-auto" onClick={() => onOpenChange(false)}>
                            Cerrar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
