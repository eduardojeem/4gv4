"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MessageSquare, Phone, Mail, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CommunicationCenterEnhanced } from "@/components/repairs/CommunicationCenterEnhanced"
import { RepairSelector } from "@/components/repairs/RepairSelector"
import { useRepairs } from "@/contexts/RepairsContext"
import { useRepairCommunications } from "@/hooks/use-repair-communications"
import { CommunicationChannel } from "@/types/repairs"
import { DEFAULT_TEMPLATES } from "@/data/communication-templates"

export default function RepairsCommunicationsPage() {
  const router = useRouter()
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
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/repairs")}
          className="-ml-2 gap-2 text-muted-foreground w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Reparaciones
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Centro de comunicación</h1>
              <p className="text-sm text-muted-foreground">WhatsApp, SMS y Email con tus clientes</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 font-normal text-emerald-700 dark:text-emerald-400">
              <MessageSquare className="h-3 w-3" />
              WhatsApp manual
            </Badge>
            <Badge variant="outline" className="gap-1 font-normal">
              <Users className="h-3 w-3" />
              {repairsLoading ? "…" : repairs.length} reparaciones
            </Badge>
          </div>
        </div>
      </div>

      {/* Selector de reparación */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <RepairSelector
            repairs={repairs}
            selectedRepairId={selectedRepairId}
            onSelectRepair={setSelectedRepairId}
            isLoading={repairsLoading}
            className="w-full"
          />

          {!repairsLoading && repairs.length === 0 && (
            <div className="rounded-lg border border-dashed p-3 text-sm">
              <p className="font-medium">No hay reparaciones disponibles.</p>
              <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={() => router.push("/dashboard/repairs")}>
                Crear una reparación →
              </Button>
            </div>
          )}

          {hasRepairsWithoutContactData && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Los clientes no tienen teléfono ni email.
              </p>
              <Button variant="link" size="sm" className="h-auto p-0 text-amber-700 dark:text-amber-400" onClick={() => router.push("/dashboard/customers")}>
                Completar datos de contacto →
              </Button>
            </div>
          )}

          {selectedRepair && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Badge variant="secondary">{selectedRepair.customer?.name || "Cliente sin nombre"}</Badge>
              <Badge variant="outline" className="font-normal">{selectedRepair.device}</Badge>
              {selectedRepair.customer?.phone ? (
                <Badge variant="outline" className="gap-1 font-normal text-emerald-700 dark:text-emerald-400">
                  <Phone className="h-3 w-3" />
                  {selectedRepair.customer.phone}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  Sin teléfono
                </Badge>
              )}
              {selectedRepair.customer?.email ? (
                <Badge variant="outline" className="gap-1 font-normal text-emerald-700 dark:text-emerald-400">
                  <Mail className="h-3 w-3" />
                  {selectedRepair.customer.email}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  Sin email
                </Badge>
              )}
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
