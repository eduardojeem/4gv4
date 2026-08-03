import React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowLeft,
  Edit,
  History,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  Star,
  Shield,
  Download,
  Copy,
  Link2,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Customer } from "@/hooks/use-customer-state"
import { formatCurrency } from "@/lib/currency"

interface CustomerDetailHeaderProps {
  customer: Customer
  onBack: () => void
  onEdit: () => void
  onViewHistory: () => void
  compact?: boolean
}

export function CustomerDetailHeader({
  customer,
  onBack,
  onEdit,
  onViewHistory,
  compact: _compact,
}: CustomerDetailHeaderProps) {

  const getStatusBadge = (status?: string) => {
    const normalized = String(status || 'active').toLowerCase().trim()
    if (normalized === 'active' || normalized === 'activo') {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
          Activo
        </Badge>
      )
    }
    if (normalized === 'suspended' || normalized === 'suspendido') {
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">
          Suspendido
        </Badge>
      )
    }
    return (
      <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
        Inactivo
      </Badge>
    )
  }

  const getSegmentBadge = (segment: string) => {
    switch (segment) {
      case 'vip':
        return (
          <Badge className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30 font-semibold">
            <Star className="h-3 w-3 mr-1 fill-purple-500 text-purple-500" />
            VIP
          </Badge>
        )
      case 'premium':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30">
            Premium
          </Badge>
        )
      case 'wholesale':
        return (
          <Badge className="bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30">
            Mayorista
          </Badge>
        )
      case 'business':
        return (
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30">
            Empresa
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400">
            Regular
          </Badge>
        )
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado al portapapeles`)
  }

  const handleWhatsApp = () => {
    if (!customer.phone) return
    const phone = customer.phone.replace(/\D/g, '')
    const msg = `Hola ${customer.name}, te contactamos de 4G.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(37, 99, 235)
    doc.text('4G - PUNTO DE VENTA', pageW / 2, 22, { align: 'center' })

    doc.setFontSize(14); doc.setTextColor(0)
    doc.text('Reporte de Cliente', pageW / 2, 32, { align: 'center' })

    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100)
    doc.text(`Generado el ${new Date().toLocaleString('es-PY')}`, pageW / 2, 40, { align: 'center' })

    doc.setTextColor(0)

    autoTable(doc, {
      startY: 50,
      head: [['Campo', 'Valor']],
      body: [
        ['Nombre', customer.name || '-'],
        ['Email', customer.email || '-'],
        ['Teléfono', customer.phone || '-'],
        ['Dirección', customer.address || customer.city || '-'],
        ['Estado', customer.status === 'active' ? 'Activo' : customer.status || 'Activo'],
        ['Segmento', customer.segment === 'vip' ? 'VIP' : customer.segment === 'wholesale' ? 'Mayorista' : customer.segment === 'business' ? 'Empresa' : 'Regular'],
        ['Total Gastado', formatCurrency(customer.lifetime_value || 0)],
        ['Compras', `${customer.total_purchases || 0}`],
        ['Crédito', formatCurrency(customer.credit_limit || 0)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      margin: { left: 14, right: 14 }
    })

    doc.save(`cliente_${customer.name?.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`)
  }

  const initials = customer.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div className="space-y-4">
      {/* Navigation Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-1.5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Clientes
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewHistory}
            className="gap-1.5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <History className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Historial</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportToPDF}
            className="gap-1.5 rounded-xl border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </Button>

          <Button
            size="sm"
            onClick={onEdit}
            className="gap-1.5 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-500"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* Main Glass Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* Avatar + Main Information */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Avatar className="h-20 w-20 rounded-2xl border-2 border-slate-200 shadow-md dark:border-white/15">
              <AvatarImage src={customer.avatar || undefined} alt={customer.name} />
              <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  {customer.name}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {getStatusBadge(customer.status)}
                  {getSegmentBadge(customer.segment)}
                  {(customer as any).profile_id ? (
                    <Badge className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <Shield className="h-3 w-3" />
                      Cuenta vinculada
                    </Badge>
                  ) : (
                    <Badge className="gap-1 border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                      <Link2 className="h-3 w-3" />
                      Sin cuenta digital
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick Details Chips */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600 dark:text-slate-400">
                {customer.phone && (
                  <div className="flex items-center gap-1.5 font-mono">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{customer.phone}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(customer.phone, 'Teléfono')}
                      className="p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                      title="Copiar teléfono"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {customer.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate max-w-[200px]">{customer.email}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(customer.email, 'Email')}
                      className="p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                      title="Copiar email"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {(customer.address || customer.city) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{customer.address || customer.city}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Direct Quick Contact Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 md:flex-col md:items-end">
            {customer.phone && (
              <Button
                size="sm"
                onClick={handleWhatsApp}
                className="gap-1.5 rounded-xl border border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              >
                <MessageSquare className="h-4 w-4" />
                Escribir por WhatsApp
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
