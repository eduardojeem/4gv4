
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MessageSquare, TrendingUp, Send, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

  // Get selected repair object
  const selectedRepair = useMemo(
    () => repairs.find((r) => r.id === selectedRepairId) || null,
    [repairs, selectedRepairId]
  )

  const { messages, sendMessage, loading: messagesLoading } = useRepairCommunications(
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
      selectedRepair.customer.phone,
      selectedRepair.customer.email,
      templateId
    )
  }

  // Calculate stats
  const stats = useMemo(() => {
    const totalMessages = messages.length
    const sentToday = messages.filter(
      (m) => new Date(m.sentAt).toDateString() === new Date().toDateString()
    ).length
    const byChannel = messages.reduce(
      (acc, m) => {
        acc[m.channel] = (acc[m.channel] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return { totalMessages, sentToday, byChannel }
  }, [messages])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950">
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/repairs")}
            className="gap-2 -ml-2 w-fit hover:bg-primary/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Reparaciones
          </Button>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Centro de Comunicación
              </h1>
              <p className="text-muted-foreground mt-1">
                Gestiona comunicaciones con clientes por WhatsApp, SMS y Email
              </p>
            </div>

            {selectedRepair && (
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {stats.totalMessages} mensajes
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {stats.sentToday} hoy
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {selectedRepair && stats.totalMessages > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Mensajes</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                      {stats.totalMessages}
                    </p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">WhatsApp</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {stats.byChannel.whatsapp || 0}
                    </p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-green-600 dark:text-green-400 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                      {stats.byChannel.email || 0}
                    </p>
                  </div>
                  <Send className="h-8 w-8 text-purple-600 dark:text-purple-400 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/40 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">SMS</p>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                      {stats.byChannel.sms || 0}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Repair Selector */}
        <Card className="shadow-lg border-2 hover:border-primary/30 transition-colors">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Seleccionar Reparación
            </CardTitle>
            <CardDescription>
              Elige la reparación para gestionar sus comunicaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <RepairSelector 
                repairs={repairs}
                selectedRepairId={selectedRepairId}
                onSelectRepair={setSelectedRepairId}
                isLoading={repairsLoading}
                className="flex-1 max-w-xl"
              />
            </div>

            {selectedRepair && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Badge variant="outline">
                  Cliente: {selectedRepair.customer.name}
                </Badge>
                <Badge variant="outline">
                  Dispositivo: {selectedRepair.device}
                </Badge>
                {selectedRepair.customer.phone && (
                  <Badge variant="outline">
                    📱 {selectedRepair.customer.phone}
                  </Badge>
                )}
                {selectedRepair.customer.email && (
                  <Badge variant="outline">
                    ✉️ {selectedRepair.customer.email}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Communication Center */}
        <CommunicationCenterEnhanced
          repair={selectedRepair}
          templates={DEFAULT_TEMPLATES}
          messages={messages}
          onSendMessage={handleSendMessage}
          loading={messagesLoading}
        />
      </div>
    </div>
  )
}
