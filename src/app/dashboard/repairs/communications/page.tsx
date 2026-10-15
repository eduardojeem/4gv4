"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ExternalLink,
  Home,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Smartphone,
  User,
  Users,
  Wrench,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CommunicationCenterEnhanced } from "@/components/repairs/CommunicationCenterEnhanced"
import { RepairSelector } from "@/components/repairs/RepairSelector"
import { useRepairs } from "@/contexts/RepairsContext"
import { useBranch } from "@/contexts/branch-context"
import { useRepairCommunications } from "@/hooks/use-repair-communications"
import { CommunicationChannel } from "@/types/repairs"
import { DEFAULT_TEMPLATES } from "@/data/communication-templates"
import { repairStatusLabel } from "@/lib/i18n/labels"
import { cn } from "@/lib/utils"

export default function RepairsCommunicationsPage() {
  const router = useRouter()
  const { selectedBranch } = useBranch()
  const { repairs, isLoading: repairsLoading } = useRepairs()
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null)

  const selectedRepair = useMemo(
    () => repairs.find((r) => r.id === selectedRepairId) || null,
    [repairs, selectedRepairId]
  )

  const repairsWithContact = useMemo(
    () => repairs.filter((repair) => Boolean(repair.customer?.phone || repair.customer?.email)),
    [repairs]
  )
  const hasRepairsWithoutContactData =
    !repairsLoading && repairs.length > 0 && repairsWithContact.length === 0

  const { messages, sendMessage, updateStatus, loading: messagesLoading } = useRepairCommunications(
    selectedRepairId || undefined
  )

  const handleSendMessage = async (
    channel: CommunicationChannel,
    content: string,
    templateId?: string
  ) => {
    if (!selectedRepair) return false
    return sendMessage(
      channel,
      content,
      selectedRepair.customer?.phone,
      selectedRepair.customer?.email,
      templateId
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <nav aria-label="Navegación" className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground font-medium">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Inicio</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <Link
          href="/dashboard/repairs"
          className="hover:text-primary transition-colors"
        >
          Reparaciones
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-foreground font-semibold">Comunicaciones</span>
      </nav>

      {/* Header Section */}
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b border-border/60 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Centro de Comunicación
                </h1>
                {selectedBranch && (
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium border-border/80 bg-background/50 text-muted-foreground"
                  >
                    <Building2 className="h-3 w-3 text-primary" />
                    <span>{selectedBranch.name}</span>
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Envía notificaciones de estado por WhatsApp, SMS y Email a tus clientes en un clic.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Badge
            variant="outline"
            className="h-8 gap-1.5 px-3 font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            WhatsApp Web / Móvil
          </Badge>
          <Badge
            variant="outline"
            className="h-8 gap-1.5 px-3 font-medium bg-muted/60 text-muted-foreground border-border/70"
          >
            <Users className="h-3.5 w-3.5" />
            {repairsLoading ? "…" : repairs.length} {repairs.length === 1 ? "reparación" : "reparaciones"}
          </Badge>
        </div>
      </header>

      {/* Selector de reparación & Ficha de Contexto */}
      <Card className="border border-border/70 bg-card/60 shadow-sm backdrop-blur-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Seleccionar orden de trabajo
            </label>
            <RepairSelector
              repairs={repairs}
              selectedRepairId={selectedRepairId}
              onSelectRepair={setSelectedRepairId}
              isLoading={repairsLoading}
              className="w-full bg-background"
            />
          </div>

          {!repairsLoading && repairs.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/80 p-5 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/30">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">No hay órdenes de reparación disponibles</p>
                <p className="text-xs text-muted-foreground">Crea una nueva reparación para comenzar a enviar actualizaciones a clientes.</p>
              </div>
              <Button size="sm" onClick={() => router.push("/dashboard/repairs")} className="gap-1.5 shrink-0">
                <Wrench className="h-3.5 w-3.5" />
                Nueva reparación
              </Button>
            </div>
          )}

          {hasRepairsWithoutContactData && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs sm:text-sm">Faltan datos de contacto en las reparaciones</p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    Tus clientes actuales no tienen número de teléfono ni correo electrónico registrado.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-amber-500/40 text-amber-800 hover:bg-amber-500/10 dark:text-amber-200"
                onClick={() => router.push("/dashboard/customers")}
              >
                Actualizar clientes →
              </Button>
            </div>
          )}

          {/* Tarjeta de Ficha de Cliente y Reparación Seleccionada */}
          {selectedRepair && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 sm:p-4 mt-2 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                    {selectedRepair.customer?.name ? selectedRepair.customer.name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {selectedRepair.customer?.name || "Cliente sin nombre"}
                      </span>
                      <Badge variant="secondary" className="font-mono text-[10px] px-1.5 h-4 shrink-0">
                        #{selectedRepair.ticketNumber || selectedRepair.id.slice(0, 8)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                      <Smartphone className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                      <span>{selectedRepair.device}</span>
                      {selectedRepair.issue && (
                        <span className="truncate max-w-[200px] text-muted-foreground/80 before:content-['•'] before:mr-1.5">
                          {selectedRepair.issue}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs font-medium capitalize bg-background/80">
                    {repairStatusLabel(selectedRepair.status)}
                  </Badge>
                </div>
              </div>

              {/* Canales de contacto directos con enlace clickeable */}
              <div className="flex flex-wrap items-center gap-2 pt-3">
                {selectedRepair.customer?.phone ? (
                  <a
                    href={`tel:${selectedRepair.customer.phone}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>{selectedRepair.customer.phone}</span>
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border/70 bg-muted/40 text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0 opacity-40" />
                    <span>Sin teléfono</span>
                  </span>
                )}

                {selectedRepair.customer?.email ? (
                  <a
                    href={`mailto:${selectedRepair.customer.email}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span>{selectedRepair.customer.email}</span>
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border/70 bg-muted/40 text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0 opacity-40" />
                    <span>Sin email</span>
                  </span>
                )}

                <Link
                  href={`/dashboard/repairs`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Ver orden completa</span>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CommunicationCenterEnhanced
        repair={selectedRepair}
        templates={DEFAULT_TEMPLATES}
        messages={messages}
        onSendMessage={handleSendMessage}
        onUpdateStatus={updateStatus}
        loading={messagesLoading}
      />
    </div>
  )
}
