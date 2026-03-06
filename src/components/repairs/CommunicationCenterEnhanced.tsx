"use client"

import { useMemo, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  CommunicationChannel,
  CommunicationMessage,
  CommunicationTemplate,
  Repair,
} from "@/types/repairs"
import { expandTemplate } from "@/services/communication-service"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  Smartphone,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Filter,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { getWhatsAppLink } from "@/lib/whatsapp"

interface Props {
  repair: Repair | null
  templates: CommunicationTemplate[]
  messages: CommunicationMessage[]
  onSendMessage: (
    channel: CommunicationChannel,
    content: string,
    templateId?: string
  ) => Promise<boolean>
  loading?: boolean
}

const CHANNEL_LABEL: Record<CommunicationChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  in_app: "In-app",
}

export function CommunicationCenterEnhanced({
  repair,
  templates,
  messages,
  onSendMessage,
  loading = false,
}: Props) {
  const [selectedChannel, setSelectedChannel] = useState<CommunicationChannel>("whatsapp")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("custom")
  const [customMessage, setCustomMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [historyChannel, setHistoryChannel] = useState<"all" | CommunicationChannel>("all")
  const [historyStatus, setHistoryStatus] = useState<"all" | "pending" | "sent" | "failed">("all")

  const variables = useMemo(
    () => ({
      customerName: repair?.customer?.name || "",
      repairId: repair?.ticketNumber || repair?.id?.slice(0, 8) || "",
      deviceModel: repair?.device || "",
    }),
    [repair]
  )

  const [preview, setPreview] = useState<string>("")

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === selectedChannel),
    [templates, selectedChannel]
  )

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      if (historyChannel !== "all" && message.channel !== historyChannel) return false
      if (historyStatus !== "all" && message.status !== historyStatus) return false
      return true
    })
  }, [messages, historyChannel, historyStatus])

  useEffect(() => {
    if (selectedTemplateId === "custom") {
      setPreview(customMessage)
      return
    }

    const tmpl = templates.find((t) => t.id === selectedTemplateId)
    if (tmpl) {
      setPreview(expandTemplate(tmpl.content, variables as Record<string, string>))
    }
  }, [selectedTemplateId, variables, templates, customMessage])

  useEffect(() => {
    setSelectedChannel("whatsapp")
    setSelectedTemplateId("custom")
    setCustomMessage("")
    setPreview("")
    setHistoryChannel("all")
    setHistoryStatus("all")
  }, [repair?.id])

  useEffect(() => {
    if (!repair) return

    const hasPhone = Boolean(repair.customer?.phone)
    const hasEmail = Boolean(repair.customer?.email)

    if ((selectedChannel === "whatsapp" || selectedChannel === "sms") && !hasPhone && hasEmail) {
      setSelectedChannel("email")
      setSelectedTemplateId("custom")
    } else if (selectedChannel === "email" && !hasEmail && hasPhone) {
      setSelectedChannel("whatsapp")
      setSelectedTemplateId("custom")
    }
  }, [repair, selectedChannel])

  const isContactMissing = useMemo(() => {
    if (!repair) return false

    if (selectedChannel === "whatsapp" || selectedChannel === "sms") {
      return !repair.customer?.phone
    }
    if (selectedChannel === "email") {
      return !repair.customer?.email
    }
    return false
  }, [repair, selectedChannel])

  const handleSend = async () => {
    if (!repair) {
      toast.error("Selecciona una reparacion primero")
      return
    }
    if (!preview.trim()) {
      toast.error("El mensaje no puede estar vacio")
      return
    }

    if (selectedChannel === "sms" && preview.length > 160) {
      const confirm = window.confirm("El mensaje excede 160 caracteres. Deseas enviarlo de todos modos?")
      if (!confirm) return
    }

    setIsSending(true)
    try {
      const success = await onSendMessage(
        selectedChannel,
        preview,
        selectedTemplateId === "custom" ? undefined : selectedTemplateId
      )

      if (success) {
        toast.success(`Mensaje enviado por ${CHANNEL_LABEL[selectedChannel]}`)
        if (selectedTemplateId !== "custom") setSelectedTemplateId("custom")
        setCustomMessage("")
      }
    } catch (_error) {
      toast.error("Error inesperado al enviar mensaje")
    } finally {
      setIsSending(false)
    }
  }

  const handleRetry = async (message: CommunicationMessage) => {
    if (!repair) return
    setIsSending(true)
    try {
      await onSendMessage(message.channel, message.content)
    } finally {
      setIsSending(false)
    }
  }

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(preview)
      toast.success("Mensaje copiado al portapapeles")
    } catch (error) {
      console.error("Clipboard error:", error)
      toast.error("No se pudo copiar el mensaje")
    }
  }

  const openWhatsAppDirectly = () => {
    if (!repair?.customer?.phone || !preview.trim()) return
    const url = getWhatsAppLink({ phone: repair.customer.phone, message: preview })
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const getChannelIcon = (channel: CommunicationChannel) => {
    if (channel === "whatsapp") return <MessageSquare className="h-4 w-4" />
    if (channel === "email") return <Mail className="h-4 w-4" />
    if (channel === "sms") return <Smartphone className="h-4 w-4" />
    return <MessageSquare className="h-4 w-4" />
  }

  const getChannelColor = (channel: CommunicationChannel) => {
    if (channel === "whatsapp") return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
    if (channel === "email") return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30"
    if (channel === "sms") return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30"
    return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30"
  }

  if (!repair) {
    return (
      <Card className="shadow-lg">
        <CardContent className="flex flex-col items-center justify-center h-96 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40 flex items-center justify-center mb-6">
            <MessageSquare className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Selecciona una reparacion</h3>
          <p className="text-muted-foreground max-w-md">
            Elige una reparacion del selector superior para comenzar a enviar mensajes al cliente.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 shadow-lg border-2 hover:border-primary/30 transition-colors">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nueva comunicacion
          </CardTitle>
          <CardDescription>
            Comunicacion para <strong>{repair.customer?.name || "Cliente sin nombre"}</strong> ({repair.device})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <Tabs
            value={selectedChannel}
            onValueChange={(v) => {
              setSelectedChannel(v as CommunicationChannel)
              setSelectedTemplateId("custom")
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 h-12">
              <TabsTrigger value="whatsapp" className="flex gap-2 items-center data-[state=active]:bg-green-100 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-950/50 dark:data-[state=active]:text-green-400">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </TabsTrigger>
              <TabsTrigger value="email" className="flex gap-2 items-center data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-950/50 dark:data-[state=active]:text-purple-400">
                <Mail className="h-4 w-4" /> Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex gap-2 items-center data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-950/50 dark:data-[state=active]:text-orange-400">
                <Smartphone className="h-4 w-4" /> SMS
              </TabsTrigger>
            </TabsList>

            {isContactMissing && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span>
                  El cliente no tiene {selectedChannel === "email" ? "email" : "telefono"} registrado.
                </span>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Plantilla
                </Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Seleccionar plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Mensaje personalizado</SelectItem>
                    {channelTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplateId === "custom" && (
                <div className="grid gap-2">
                  <Label>Mensaje personalizado</Label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Escribe tu mensaje aqui... Variables: {{customerName}}, {{repairId}}, {{deviceModel}}"
                    className="min-h-[120px] resize-none"
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{customMessage.length} caracteres</span>
                    {selectedChannel === "sms" && customMessage.length > 160 && (
                      <span className="text-orange-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Excede 160 caracteres
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Vista previa</Label>
                  {preview && (
                    <Button variant="ghost" size="sm" onClick={handleCopyPreview} className="h-8 gap-1">
                      <Copy className="h-3 w-3" />
                      Copiar
                    </Button>
                  )}
                </div>
                <div
                  className={cn(
                    "p-4 rounded-lg text-sm whitespace-pre-wrap min-h-[120px] border-2 transition-colors",
                    preview
                      ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800"
                      : "bg-muted border-dashed",
                    isContactMissing && "opacity-50"
                  )}
                >
                  {preview || <span className="text-muted-foreground italic">Selecciona una plantilla o escribe un mensaje para previsualizar...</span>}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                {selectedChannel === "whatsapp" && !isContactMissing && preview.trim() && (
                  <Button variant="outline" onClick={openWhatsAppDirectly} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Abrir WhatsApp
                  </Button>
                )}
                <Button onClick={handleSend} className="gap-2 h-11 px-6" disabled={!preview.trim() || isSending || isContactMissing} size="lg">
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar mensaje
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Tabs>

          <div className="pt-4 border-t">
            <Label className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Variables disponibles
            </Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => selectedTemplateId === "custom" && setCustomMessage((prev) => prev + "{{customerName}}") }>
                {'{{customerName}}'} = {variables.customerName}
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => selectedTemplateId === "custom" && setCustomMessage((prev) => prev + "{{repairId}}") }>
                {'{{repairId}}'} = {variables.repairId}
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => selectedTemplateId === "custom" && setCustomMessage((prev) => prev + "{{deviceModel}}") }>
                {'{{deviceModel}}'} = {variables.deviceModel}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="h-full flex flex-col shadow-lg border-2">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Historial
            </CardTitle>
            <Badge variant="secondary">{filteredMessages.length}</Badge>
          </div>
          <CardDescription>{messages.length} mensajes registrados</CardDescription>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs inline-flex items-center gap-1"><Filter className="h-3 w-3" /> Canal</Label>
              <Select value={historyChannel} onValueChange={(v) => setHistoryChannel(v as "all" | CommunicationChannel)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={historyStatus} onValueChange={(v) => setHistoryStatus(v as "all" | "pending" | "sent" | "failed") }>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="failed">Fallidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[48vh] lg:h-[600px] px-6 pb-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">No hay mensajes para este filtro.</p>
              </div>
            ) : (
              <div className="space-y-3 pt-4">
                {filteredMessages.map((m) => (
                  <div key={m.id} className={cn("flex flex-col gap-2 p-4 rounded-lg border-2 shadow-sm transition-all hover:shadow-md", getChannelColor(m.channel))}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        {getChannelIcon(m.channel)}
                        <span className="capitalize">{CHANNEL_LABEL[m.channel]}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(m.sentAt), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    <div className="flex items-center justify-between gap-2 text-xs mt-1">
                      <div className="flex items-center gap-2">
                        {m.status === "sent" ? (
                          <span className="flex items-center text-green-600 dark:text-green-400 gap-1 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Enviado
                          </span>
                        ) : m.status === "pending" ? (
                          <span className="flex items-center text-amber-600 dark:text-amber-400 gap-1 font-medium">
                            <Loader2 className="h-3 w-3 animate-spin" /> Pendiente
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600 dark:text-red-400 gap-1 font-medium">
                            <AlertCircle className="h-3 w-3" /> Error
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {new Date(m.sentAt).toLocaleString("es", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {m.status === "failed" && (
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => handleRetry(m)} disabled={isSending}>
                          <RefreshCw className="h-3 w-3" /> Reintentar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
