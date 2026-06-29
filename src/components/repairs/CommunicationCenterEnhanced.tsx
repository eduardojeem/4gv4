"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  Loader2,
  Mail,
  MessageSquare,
  Send,
  Smartphone,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  repair: Repair | null
  templates: CommunicationTemplate[]
  messages: CommunicationMessage[]
  onSendMessage: (
    channel: CommunicationChannel,
    content: string,
    templateId?: string
  ) => Promise<boolean>
  onUpdateStatus?: (id: string, status: CommunicationMessage["status"]) => Promise<void>
  loading?: boolean
}

const CHANNELS: { value: CommunicationChannel; label: string; icon: typeof Mail }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: Smartphone },
]

const CHANNEL_LABEL: Record<CommunicationChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  in_app: "In-app",
}

function channelIcon(channel: CommunicationChannel) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5" />
  if (channel === "sms") return <Smartphone className="h-3.5 w-3.5" />
  return <MessageSquare className="h-3.5 w-3.5" />
}

const CHANNEL_ACCENT: Record<CommunicationChannel, string> = {
  whatsapp: "border-l-emerald-400 dark:border-l-emerald-500",
  email: "border-l-violet-400 dark:border-l-violet-500",
  sms: "border-l-amber-400 dark:border-l-amber-500",
  in_app: "border-l-sky-400 dark:border-l-sky-500",
}

const STATUS_META = {
  sent: {
    label: "Enviado",
    icon: CheckCircle2,
    pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  pending: {
    label: "Pendiente",
    icon: Clock,
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  },
  failed: {
    label: "No enviado",
    icon: AlertCircle,
    pill: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  },
} as const

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function CommunicationCenterEnhanced({
  repair,
  templates,
  messages,
  onSendMessage,
  onUpdateStatus,
  loading = false,
}: Props) {
  const [selectedChannel, setSelectedChannel] = useState<CommunicationChannel>("whatsapp")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("custom")
  const [content, setContent] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [historyChannel, setHistoryChannel] = useState<"all" | CommunicationChannel>("all")
  const [historyStatus, setHistoryStatus] = useState<"all" | "pending" | "sent" | "failed">("all")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const variables = useMemo(
    () => ({
      customerName: repair?.customer?.name || "",
      repairId: repair?.ticketNumber || repair?.id?.slice(0, 8) || "",
      deviceModel: repair?.device || "",
    }),
    [repair]
  )

  const VARIABLE_CHIPS = useMemo(
    () => [
      { label: "Cliente", value: variables.customerName },
      { label: "Ticket", value: variables.repairId },
      { label: "Equipo", value: variables.deviceModel },
    ],
    [variables]
  )

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === selectedChannel),
    [templates, selectedChannel]
  )

  const filteredMessages = useMemo(
    () =>
      messages.filter((m) => {
        if (historyChannel !== "all" && m.channel !== historyChannel) return false
        if (historyStatus !== "all" && m.status !== historyStatus) return false
        return true
      }),
    [messages, historyChannel, historyStatus]
  )

  const counts = useMemo(
    () => ({
      total: messages.length,
      sent: messages.filter((m) => m.status === "sent").length,
      pending: messages.filter((m) => m.status === "pending").length,
      failed: messages.filter((m) => m.status === "failed").length,
    }),
    [messages]
  )

  // Reset al cambiar de reparación
  useEffect(() => {
    setSelectedChannel("whatsapp")
    setSelectedTemplateId("custom")
    setContent("")
    setHistoryChannel("all")
    setHistoryStatus("all")
  }, [repair?.id])

  // Auto-seleccionar un canal con datos de contacto disponibles
  useEffect(() => {
    if (!repair) return
    const hasPhone = Boolean(repair.customer?.phone)
    const hasEmail = Boolean(repair.customer?.email)
    if ((selectedChannel === "whatsapp" || selectedChannel === "sms") && !hasPhone && hasEmail) {
      setSelectedChannel("email")
    } else if (selectedChannel === "email" && !hasEmail && hasPhone) {
      setSelectedChannel("whatsapp")
    }
  }, [repair, selectedChannel])

  const isContactMissing = useMemo(() => {
    if (!repair) return false
    if (selectedChannel === "whatsapp" || selectedChannel === "sms") return !repair.customer?.phone
    if (selectedChannel === "email") return !repair.customer?.email
    return false
  }, [repair, selectedChannel])

  // Al elegir una plantilla, cargamos su texto con las variables ya resueltas
  // en el cuadro editable. El usuario puede modificarlo libremente antes de enviar.
  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id)
    if (id === "custom") {
      setContent("")
      return
    }
    const tmpl = templates.find((t) => t.id === id)
    if (tmpl) setContent(expandTemplate(tmpl.content, variables as Record<string, string>))
  }

  const handleChannelChange = (value: string) => {
    setSelectedChannel(value as CommunicationChannel)
    setSelectedTemplateId("custom")
    setContent("")
  }

  // Inserta el valor real (cliente/ticket/equipo) en la posición del cursor.
  const insertValue = (value: string) => {
    if (!value) return
    const el = textareaRef.current
    if (!el) {
      setContent((p) => p + value)
      return
    }
    const start = el.selectionStart ?? content.length
    const end = el.selectionEnd ?? content.length
    setContent(content.slice(0, start) + value + content.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + value.length
      el.setSelectionRange(pos, pos)
    })
  }

  const handleSend = async () => {
    if (!repair) return toast.error("Selecciona una reparacion primero")
    const finalContent = content.trim()
    if (!finalContent) return toast.error("El mensaje no puede estar vacio")
    if (selectedChannel === "sms" && finalContent.length > 160) {
      if (!window.confirm("El mensaje excede 160 caracteres. ¿Enviarlo de todos modos?")) return
    }
    setIsSending(true)
    try {
      const ok = await onSendMessage(
        selectedChannel,
        finalContent,
        selectedTemplateId === "custom" ? undefined : selectedTemplateId
      )
      if (ok) {
        setSelectedTemplateId("custom")
        setContent("")
      }
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success("Mensaje copiado")
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  const sendLabel = `Enviar por ${CHANNEL_LABEL[selectedChannel]}`

  if (!repair) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Selecciona una reparación</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige una reparación arriba para enviar mensajes al cliente.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Composer */}
      <Card className="lg:col-span-2">
        <CardContent className="space-y-5 p-5">
          <Tabs value={selectedChannel} onValueChange={handleChannelChange}>
            <TabsList className="grid w-full grid-cols-3">
              {CHANNELS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {isContactMissing && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              El cliente no tiene {selectedChannel === "email" ? "email" : "teléfono"} registrado.
            </div>
          )}

          {/* Plantilla */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Plantilla</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue />
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

          {/* Mensaje editable (plantilla o personalizado) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Mensaje</Label>
              {content.trim() && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
                  <Copy className="h-3 w-3" />
                  Copiar
                </Button>
              )}
            </div>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                selectedTemplateId === "custom"
                  ? "Escribe tu mensaje…"
                  : "Edita el texto de la plantilla…"
              }
              className="min-h-[140px] resize-none"
              disabled={isContactMissing}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_CHIPS.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => insertValue(v.value)}
                    disabled={!v.value || isContactMissing}
                    className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40 disabled:hover:bg-muted/40 disabled:hover:text-muted-foreground"
                  >
                    + {v.label}
                  </button>
                ))}
              </div>
              <span
                className={cn(
                  "text-xs text-muted-foreground",
                  selectedChannel === "sms" && content.length > 160 && "text-amber-600 dark:text-amber-400"
                )}
              >
                {selectedChannel === "sms" && content.length > 160 && (
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                )}
                {content.length}
                {selectedChannel === "sms" ? "/160" : ""}
              </span>
            </div>
          </div>

          {/* Acción única por canal */}
          <div className="flex justify-end">
            <Button
              onClick={handleSend}
              disabled={!content.trim() || isSending || isContactMissing}
              className="gap-2"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? "Enviando…" : sendLabel}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card className="flex flex-col">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Historial
            </div>
            <Badge variant="secondary">{counts.total}</Badge>
          </div>

          {/* Resumen por estado (clickeable para filtrar) */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: "sent", label: "Enviados", value: counts.sent, color: "text-emerald-600 dark:text-emerald-400" },
              { key: "pending", label: "Pendientes", value: counts.pending, color: "text-amber-600 dark:text-amber-400" },
              { key: "failed", label: "No enviados", value: counts.failed, color: "text-red-600 dark:text-red-400" },
            ] as const).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setHistoryStatus(historyStatus === s.key ? "all" : s.key)}
                className={cn(
                  "rounded-lg border p-2 text-center transition-colors hover:bg-muted/50",
                  historyStatus === s.key && "border-primary bg-primary/5 ring-1 ring-primary/30"
                )}
              >
                <div className={cn("text-lg font-bold leading-none", s.color)}>{s.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{s.label}</div>
              </button>
            ))}
          </div>

          <Select value={historyChannel} onValueChange={(v) => setHistoryChannel(v as "all" | CommunicationChannel)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los canales</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>

          <ScrollArea className="h-[42vh] lg:h-[480px] pr-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-20" />
                {historyChannel !== "all" || historyStatus !== "all"
                  ? "No hay mensajes con este filtro."
                  : "Sin mensajes todavía."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredMessages.map((m) => {
                  const status = STATUS_META[m.status] ?? STATUS_META.sent
                  const StatusIcon = status.icon
                  return (
                    <div
                      key={m.id}
                      className={cn("space-y-2 rounded-lg border border-l-[3px] p-3", CHANNEL_ACCENT[m.channel])}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {channelIcon(m.channel)}
                          {CHANNEL_LABEL[m.channel]}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                            status.pill
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                        <span
                          className="text-xs text-muted-foreground"
                          title={formatDistanceToNow(new Date(m.sentAt), { addSuffix: true, locale: es })}
                        >
                          {formatDateTime(m.sentAt)}
                          <span className="ml-1.5 opacity-60">
                            · {formatDistanceToNow(new Date(m.sentAt), { addSuffix: true, locale: es })}
                          </span>
                        </span>

                        {m.status === "pending" && !m.id.startsWith("temp-") && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                              onClick={() => onUpdateStatus?.(m.id, "sent")}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Lo envié
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs text-muted-foreground hover:text-red-600"
                              onClick={() => onUpdateStatus?.(m.id, "failed")}
                            >
                              <AlertCircle className="h-3 w-3" /> No
                            </Button>
                          </div>
                        )}

                        {m.status === "failed" && (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => handleRetry(m)} disabled={isSending}>
                            <RefreshCw className="h-3 w-3" /> Reintentar
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
