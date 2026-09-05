'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  CreditCard, 
  TrendingUp,
  Star,
  Clock,
  X,
  MessageCircle,
  Copy,
  Check,
  Building2,
  ExternalLink,
  Edit,
  ShieldCheck,
  Sparkles,
  UserCheck,
  AlertCircle,
  Wallet,
  PhoneCall
} from 'lucide-react'
import type { Customer } from '@/hooks/use-customer-state'
import { formatCurrency } from '@/lib/currency'
import { customerSegmentLabel } from '@/lib/i18n/labels'
import { getWhatsAppLink } from '@/lib/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCustomerLiveMetrics } from '@/hooks/use-customer-live-metrics'

export interface CustomerAuthorizedPerson {
  id: string
  full_name: string
  document_number: string
  phone?: string | null
  relationship?: string | null
  is_active?: boolean
}

export type CustomerDetailInput = Partial<Customer> & {
  id: string
  name: string
}

interface CustomerDetailModalProps {
  open: boolean
  onClose: () => void
  customer: CustomerDetailInput | null
  authorizedPersons?: CustomerAuthorizedPerson[]
  onEdit?: (customer: any) => void
}

export function CustomerDetailModal({
  open,
  onClose,
  customer,
  authorizedPersons,
  onEdit
}: CustomerDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [detailedCustomer, setDetailedCustomer] = useState<CustomerDetailInput | null>(customer)
  const [authorizedList, setAuthorizedList] = useState<CustomerAuthorizedPerson[]>(authorizedPersons || [])
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // Las cuatro metricas de abajo salian de columnas de `customers` que nadie
  // escribe nunca —no hay trigger ni codigo que las toque—, asi que mostraban 0
  // para todos. Ahora se calculan sobre las ventas, las reparaciones y la
  // cuenta de puntos reales.
  const metrics = useCustomerLiveMetrics(customer?.id, open)

  // Sincronizar y cargar detalles ampliados desde Supabase si faltan datos
  useEffect(() => {
    if (!open || !customer) {
      setDetailedCustomer(customer)
      setAuthorizedList(authorizedPersons || [])
      return
    }

    setDetailedCustomer(customer)
    if (authorizedPersons) {
      setAuthorizedList(authorizedPersons)
    }

    let isMounted = true

    async function loadFullCustomerData() {
      try {
        setIsLoadingDetails(true)
        const supabase = createClient()

        // 1. Cargar datos completos del cliente si tiene ID
        if (customer?.id) {
          const { data: fullData } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customer.id)
            .maybeSingle()

          if (isMounted && fullData) {
            setDetailedCustomer((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                customerCode: fullData.customer_code || prev.customerCode,
                name: fullData.name || prev.name,
                phone: fullData.phone || prev.phone,
                alternate_phone: fullData.alternate_phone ?? prev.alternate_phone,
                alternate_phone_label: fullData.alternate_phone_label ?? prev.alternate_phone_label,
                email: fullData.email ?? prev.email,
                ruc: fullData.ruc ?? prev.ruc,
                address: fullData.address ?? prev.address,
                city: fullData.city ?? prev.city,
                notes: fullData.notes ?? prev.notes,
                customer_type: (fullData.customer_type as any) || prev.customer_type,
                status: (fullData.status as any) || prev.status,
                segment: fullData.segment || prev.segment,
                // total_repairs, total_purchases, lifetime_value y loyalty_points
                // no se copian: son columnas que nadie escribe y valen 0 para
                // todos. Esas cuatro cifras vienen de `useCustomerLiveMetrics`.
                credit_limit: fullData.credit_limit ?? prev.credit_limit,
                current_balance: fullData.current_balance ?? prev.current_balance,
                registration_date: fullData.registration_date ?? fullData.created_at ?? prev.registration_date,
              }
            })

            // 2. Si no se recibieron personas autorizadas por prop, consultar por profile_id
            const profileId = fullData.profile_id || customer.profile_id
            if ((!authorizedPersons || authorizedPersons.length === 0) && profileId) {
              const { data: authList } = await supabase
                .from('authorized_persons')
                .select('id, full_name, document_number, phone, relationship, is_active')
                .eq('profile_id', profileId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })

              if (isMounted && authList && authList.length > 0) {
                setAuthorizedList(authList)
              }
            }
          }
        }
      } catch (err) {
        console.warn('CustomerDetailModal: Error loading extended customer info:', err)
      } finally {
        if (isMounted) setIsLoadingDetails(false)
      }
    }

    loadFullCustomerData()

    return () => {
      isMounted = false
    }
  }, [open, customer?.id, authorizedPersons])

  const activeCustomer = detailedCustomer || customer
  if (!activeCustomer) return null

  const getCustomerInitials = (cust: CustomerDetailInput) => {
    const nameParts = (cust.name || '').trim().split(/\s+/)
    const firstInitial = nameParts[0]?.[0] || ''
    const lastInitial = nameParts[1]?.[0] || ''
    return `${firstInitial}${lastInitial}`.toUpperCase() || 'CL'
  }

  const getCustomerTypeBadge = (type?: string, isWholesale?: boolean) => {
    if (isWholesale || type === 'wholesale' || type === 'mayorista') {
      return {
        label: 'Mayorista / Técnico',
        className: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-700/60 font-bold'
      }
    }
    switch (type) {
      case 'premium': 
        return { label: 'Premium', className: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700/60 font-bold' }
      case 'empresa': 
        return { label: 'Empresa', className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700/60 font-bold' }
      default: 
        return { label: 'Cliente Regular', className: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium' }
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active': 
        return { label: 'Activo', className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60' }
      case 'inactive': 
        return { label: 'Inactivo', className: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' }
      case 'suspended': 
        return { label: 'Suspendido', className: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700/60' }
      default: 
        return { label: 'Activo', className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60' }
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible'
    try {
      return new Date(dateString).toLocaleDateString('es', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'No disponible'
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(label)
      toast.success(`${label} copiado al portapapeles`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const handleOpenWhatsApp = (phone: string, greetingTarget: string) => {
    const link = getWhatsAppLink({
      phone,
      message: `Hola ${greetingTarget}, te contactamos desde el servicio técnico de 4G.`
    })
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  const typeBadge = getCustomerTypeBadge(activeCustomer.customer_type, activeCustomer.segment === 'wholesale')
  const statusBadge = getStatusBadge(activeCustomer.status)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[96vw] sm:max-w-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        {/* Header con gradiente y avatar */}
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 border-b bg-gradient-to-r from-slate-50 via-slate-50/90 to-cyan-50/40 dark:from-slate-900/80 dark:via-slate-900/50 dark:to-cyan-950/20 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border border-cyan-500/20 shadow-xs shrink-0 ring-2 ring-cyan-500/10">
                <AvatarFallback className="text-base sm:text-lg font-black bg-gradient-to-br from-cyan-600 to-blue-600 text-white">
                  {getCustomerInitials(activeCustomer)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate">
                    {activeCustomer.name}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span 
                    onClick={() => copyToClipboard(activeCustomer.customerCode || `CLI-${String(activeCustomer.id).slice(0, 6)}`, 'Código de cliente')}
                    className="font-mono bg-muted/80 hover:bg-muted cursor-pointer px-2 py-0.5 rounded text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                    title="Click para copiar código"
                  >
                    {activeCustomer.customerCode || `CLI-${String(activeCustomer.id).slice(0, 6)}`}
                    <Copy className="h-2.5 w-2.5 opacity-60" />
                  </span>
                  {activeCustomer.ruc && (
                    <span 
                      onClick={() => copyToClipboard(activeCustomer.ruc!, 'RUC / C.I.')}
                      className="font-mono text-[11px] bg-muted/80 hover:bg-muted cursor-pointer px-2 py-0.5 rounded transition-colors inline-flex items-center gap-1"
                      title="Click para copiar C.I. o RUC"
                    >
                      CI/RUC: {activeCustomer.ruc}
                      <Copy className="h-2.5 w-2.5 opacity-60" />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Badges de Estado y Tipo */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant="outline" className={cn("text-[10px] sm:text-xs py-0.5 px-2 font-medium shadow-2xs", statusBadge.className)}>
                {statusBadge.label}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] sm:text-xs py-0.5 px-2 font-semibold shadow-2xs", typeBadge.className)}>
                {typeBadge.label}
              </Badge>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Ficha técnica y comercial completa del cliente
          </DialogDescription>
        </DialogHeader>

        {/* Barra de Acceso Rápido de Comunicación */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-100/60 dark:bg-slate-900/40 border-b border-border/50 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Acción Rápida:
            </span>
            {activeCustomer.phone && (
              <a
                href={`tel:${activeCustomer.phone}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-border/80 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700/60 text-foreground transition-all"
              >
                <PhoneCall className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Llamar</span>
              </a>
            )}
            {activeCustomer.phone && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 rounded-lg text-xs font-semibold border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shadow-2xs"
                onClick={() => handleOpenWhatsApp(activeCustomer.phone, activeCustomer.name)}
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                WhatsApp
              </Button>
            )}
            {activeCustomer.alternate_phone && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 rounded-lg text-xs font-semibold border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shadow-2xs"
                onClick={() => handleOpenWhatsApp(
                  activeCustomer.alternate_phone!,
                  activeCustomer.alternate_phone_label
                    ? `${activeCustomer.name} (${activeCustomer.alternate_phone_label})`
                    : activeCustomer.name
                )}
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                WhatsApp {activeCustomer.alternate_phone_label || 'Alt.'}
              </Button>
            )}
          </div>

          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-cyan-600 gap-1 ml-auto"
              onClick={() => {
                onClose()
                onEdit(activeCustomer)
              }}
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Editar</span>
            </Button>
          )}
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Canales de Contacto Directo */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Canales de Contacto
                </h4>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Líneas y avisos directos</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Teléfono principal */}
              {activeCustomer.phone ? (
                <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Phone className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      <span className="text-xs font-bold text-foreground truncate font-mono">{activeCustomer.phone}</span>
                      <Badge variant="outline" className="text-[9px] py-0 h-4 bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
                        Principal
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Línea directa para avisos y retiro</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      onClick={() => handleOpenWhatsApp(activeCustomer.phone, activeCustomer.name)}
                      title="Enviar mensaje por WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(activeCustomer.phone, 'Teléfono')}
                      title="Copiar teléfono"
                    >
                      {copiedField === 'Teléfono' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-dashed border-amber-300/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Sin teléfono principal registrado</span>
                </div>
              )}

              {/* Teléfono alternativo */}
              {activeCustomer.alternate_phone ? (
                <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Phone className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="text-xs font-bold text-foreground truncate font-mono">{activeCustomer.alternate_phone}</span>
                      <Badge variant="outline" className="text-[9px] py-0 h-4 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold">
                        {activeCustomer.alternate_phone_label || 'Secundario'}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Aviso si el principal no responde</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      onClick={() => handleOpenWhatsApp(
                        activeCustomer.alternate_phone!,
                        activeCustomer.alternate_phone_label ? `${activeCustomer.name} (${activeCustomer.alternate_phone_label})` : activeCustomer.name
                      )}
                      title="Enviar mensaje de WhatsApp al número alternativo"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(activeCustomer.alternate_phone!, 'Teléfono alternativo')}
                      title="Copiar teléfono alternativo"
                    >
                      {copiedField === 'Teléfono alternativo' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 text-xs text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span>Sin número alternativo asignado</span>
                  </div>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] font-semibold text-cyan-600"
                      onClick={() => {
                        onClose()
                        onEdit(activeCustomer)
                      }}
                    >
                      + Agregar
                    </Button>
                  )}
                </div>
              )}

              {/* Email */}
              {activeCustomer.email && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium text-foreground truncate">{activeCustomer.email}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Comprobantes y portal web</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => copyToClipboard(activeCustomer.email, 'Email')}
                    title="Copiar correo"
                  >
                    {copiedField === 'Email' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}

              {/* Dirección */}
              {activeCustomer.address && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium text-foreground truncate">{activeCustomer.address}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{activeCustomer.city || 'Ubicación registrada'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => copyToClipboard(`${activeCustomer.address} ${activeCustomer.city || ''}`.trim(), 'Dirección')}
                    title="Copiar dirección"
                  >
                    {copiedField === 'Dirección' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Personas Autorizadas para Retiro */}
          <section className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Personas Autorizadas para Retiro
                </h4>
              </div>
              <Badge variant="secondary" className="text-[10px] font-semibold">
                {authorizedList.length} autorizada{authorizedList.length === 1 ? '' : 's'}
              </Badge>
            </div>

            {authorizedList.length > 0 ? (
              <div className="space-y-2">
                {authorizedList.map((person) => (
                  <div
                    key={person.id}
                    className="p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-bold text-foreground">
                          {person.full_name}
                        </span>
                        {person.relationship && (
                          <Badge variant="outline" className="text-[9px] py-0 h-4 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-semibold">
                            {person.relationship}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap font-mono">
                        <span 
                          onClick={() => copyToClipboard(person.document_number, `C.I. de ${person.full_name}`)}
                          className="cursor-pointer hover:text-foreground inline-flex items-center gap-1 bg-white/70 dark:bg-slate-900/60 px-1.5 py-0.5 rounded border border-border/60"
                          title="Copiar C.I."
                        >
                          C.I.: {person.document_number}
                          <Copy className="h-2.5 w-2.5 opacity-60" />
                        </span>
                        {person.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5 text-muted-foreground" />
                            {person.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {person.phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40"
                          onClick={() => handleOpenWhatsApp(person.phone!, `${person.full_name} (Autorizado por ${activeCustomer.name})`)}
                          title={`Enviar WhatsApp a ${person.full_name}`}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                        onClick={() => copyToClipboard(`${person.full_name} - CI: ${person.document_number}${person.phone ? ` - Tel: ${person.phone}` : ''}`, 'Datos de autorizado')}
                        title="Copiar datos completos del autorizado"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 text-xs text-muted-foreground flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <span>Solo el titular registrado puede retirar equipos directamente con su C.I.</span>
                </div>
              </div>
            )}
          </section>

          {/* Estadísticas de Taller y Métricas */}
          <section className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Historial y Métricas en Taller
                </h4>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Paraguay (Gs.)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  <span>Reparaciones</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-foreground mt-1 tabular-nums">
                  {metrics.loading ? '…' : (metrics.repairs ?? '—')}
                </div>
                <p className="text-[9px] text-muted-foreground">Equipos en taller</p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Compras</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-foreground mt-1 tabular-nums">
                  {metrics.loading ? '…' : (metrics.purchases ?? '—')}
                </div>
                <p className="text-[9px] text-muted-foreground">Ventas registradas</p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Facturado Total</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums truncate">
                  {metrics.loading ? '…' : (metrics.billed === null ? '—' : formatCurrency(metrics.billed))}
                </div>
                <p className="text-[9px] text-muted-foreground">Ventas + reparaciones</p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  <span>Puntos Fidelidad</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-violet-600 dark:text-violet-400 mt-1 tabular-nums">
                  {metrics.loading ? '…' : (metrics.loyaltyPoints ?? '—')}
                </div>
                <p className="text-[9px] text-muted-foreground">
                  {metrics.loyaltyModuleInstalled ? 'Puntos vigentes' : 'Fidelidad no activada'}
                </p>
              </div>
            </div>

            {/* Un guion no es un cero: si la consulta falló, decirlo. Antes estos
                cuatro números salían de columnas que nadie escribe y mostraban 0
                para todos, que es peor que no mostrar nada. */}
            {!metrics.loading && (metrics.repairs === null || metrics.purchases === null || metrics.billed === null) && (
              <p className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3 shrink-0" />
                No pudimos cargar algunos números del cliente. Los que aparecen con “—” no están disponibles ahora.
              </p>
            )}

            {/* Saldo de Cuenta y Crédito si aplica */}
            {((activeCustomer.credit_limit && activeCustomer.credit_limit > 0) || (activeCustomer.current_balance && activeCustomer.current_balance > 0)) && (
              <div className="p-3 rounded-xl border border-blue-200/70 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <span className="font-bold text-foreground">Cuenta Corriente Comercial</span>
                    <p className="text-[10px] text-muted-foreground">
                      Límite autorizado: {formatCurrency(activeCustomer.credit_limit || 0)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">Saldo Pendiente:</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                    {formatCurrency(activeCustomer.current_balance || 0)}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Información de Registro y Notas Internas */}
          <section className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <Calendar className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Detalles de Registro & Notas
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Fecha de alta:
                </span>
                <span className="font-semibold text-foreground">
                  {formatDate(activeCustomer.registration_date || activeCustomer.created_at)}
                </span>
              </div>

              {activeCustomer.segment && (
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Segmento comercial:
                  </span>
                  <span className="font-semibold text-foreground">
                    {customerSegmentLabel(activeCustomer.segment)}
                  </span>
                </div>
              )}
            </div>

            {/* Notas internas */}
            {activeCustomer.notes ? (
              <div className="p-3.5 rounded-xl border border-amber-200/70 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20 text-xs space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <span>Observaciones Internas del Cliente:</span>
                </p>
                <p className="text-amber-950/80 dark:text-amber-300/80 leading-relaxed pl-5">
                  {activeCustomer.notes}
                </p>
              </div>
            ) : null}
          </section>
        </div>

        {/* Footer fijo con acciones */}
        <div className="p-3.5 sm:p-4 border-t bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between gap-2 shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="h-9 px-4 text-xs font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cerrar
          </Button>

          {onEdit && (
            <Button
              onClick={() => {
                onClose()
                onEdit(activeCustomer)
              }}
              className="h-9 px-4 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl gap-1.5 shadow-sm transition-all active:scale-[0.98]"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Editar Datos</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
