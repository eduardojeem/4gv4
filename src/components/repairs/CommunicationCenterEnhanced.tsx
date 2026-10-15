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

const CHANNELS: {
  value: CommunicationChannel
  label: string
  icon: typeof Mail
  badgeColor: string
  activeTabClass: string
}[] = [
  {
    value: "whatsapp",
    label: "WhatsApp",
    icon: MessageSquare,
    badgeColor: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20",
    activeTabClass: "data-[state=active]:text-emerald-700 data-[state=active]:bg-emerald-500/10 dark:data-[state=active]:text-emerald-400",
  },
  {
    value: "email",
    label: "Email",
    icon: Mail,
    badgeColor: "text-violet-700 bg-violet-500/10 dark:text-violet-400 border-violet-500/20",
    activeTabClass: "data-[state=active]:text-violet-700 data-[state=active]:bg-violet-500/10 dark:data-[state=active]:text-violet-400",
  },
  {
    value: "sms",
    label: "SMS",
    icon: Smartphone,
    badgeColor: "text-amber-700 bg-amber-500/10 dark:text-amber-400 border-amber-500/20",
    activeTabClass: "data-[state=active]:text-amber-700 data-[state=active]:bg-amber-500/10 dark:data-[state=active]:text-amber-400",
  },
]

const CHANNEL_LABEL: Record<CommunicationChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  in_app: "In-app",
}

function channelIcon(channel: CommunicationChannel) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
  if (channel === "sms") return <Smartphone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
  return <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
}

const CHANNEL_ACCENT: Record<CommunicationChannel, string> = {
  whatsapp: "border-l-emerald-500 dark:border-l-emerald-400",
  email: "border-l-violet-500 dark:border-l-violet-400",
  sms: "border-l-amber-500 dark:border-l-amber-400",
  in_app: "border-l-sky-500 dark:border-l-sky-400",
}

const STATUS_META = {
  sent: {
    label: "Enviado",
    icon: CheckCircle2,
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  },
  pending: {
    label: "Pendiente",
    icon: Clock,
    pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  },
  failed: {
    label: "No enviado",
    icon: AlertCircle,
    pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
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
      <Card className="border border-border/70 bg-card/60 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageSquare className="h-8 w-8" />
          </div>
          <div className="max-w-sm space-y-1">
            <h3 className="font-semibold text-base text-foreground">Selecciona una reparación</h3>
            <p className="text-sm text-muted-foreground">
              Elige una orden de trabajo en el selector superior para redactar mensajes y consultar el historial de comunicaciones con el cliente.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Composer */}
      <Card className="lg:col-span-2 border border-border/70 bg-card/60 shadow-sm">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Canal de envío
            </Label>
            <Tabs value={selectedChannel} onValueChange={handleChannelChange}>
              <TabsList className="grid w-full grid-cols-3 h-11 bg-muted/60 p-1">
                {CHANNELS.map(({ value, label, icon: Icon, activeTabClass }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className={cn("gap-2 font-medium transition-all text-xs sm:text-sm", activeTabClass)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {isContactMissing && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs sm:text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                El cliente no tiene <strong>{selectedChannel === "email" ? "correo electrónico" : "número de teléfono"}</strong> registrado para este canal.
              </span>
            </div>
          )}

          {/* Plantilla */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Plantilla rápida
            </Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger className="h-10 bg-background border-border/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">✏️ Redactar mensaje personalizado</SelectItem>
                {channelTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    📄 {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mensaje editable (plantilla o personalizado) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cuerpo del mensaje
              </Label>
              {content.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar texto
                </Button>
              )}
            </div>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                selectedTemplateId === "custom"
                  ? "Escribe tu mensaje para el cliente aquí…"
                  : "Edita el contenido de la plantilla antes de enviar…"
              }
              className="min-h-[160px] resize-none bg-background text-sm leading-relaxed border-border/80 focus-visible:ring-primary/20"
              disabled={isContactMissing}
            />

            {/* Chips de variables y contador */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">Insertar:</span>
                {VARIABLE_CHIPS.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => insertValue(v.value)}
                    disabled={!v.value || isContactMissing}
                    title={v.value ? `Insertar: "${v.value}"` : "Dato no disponible"}
                    className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <span>+</span>
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-xs font-mono font-medium text-muted-foreground",
                    selectedChannel === "sms" && content.length > 160 && "text-amber-600 dark:text-amber-400 font-semibold"
                  )}
                >
                  {selectedChannel === "sms" && content.length > 160 && (
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  )}
                  {content.length}
                  {selectedChannel === "sms" ? " / 160 chars" : " caracteres"}
                </span>
              </div>
            </div>
          </div>

          {/* Acción única por canal */}
          <div className="flex items-center justify-end pt-2 border-t border-border/50">
            <Button
              onClick={handleSend}
              disabled={!content.trim() || isSending || isContactMissing}
              size="lg"
              className={cn(
                "gap-2 font-semibold shadow-sm transition-all",
                selectedChannel === "whatsapp" && "bg-emerald-600 hover:bg-emerald-700 text-white",
                selectedChannel === "email" && "bg-violet-600 hover:bg-violet-700 text-white",
                selectedChannel === "sms" && "bg-amber-600 hover:bg-amber-700 text-white"
              )}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? "Preparando envío…" : sendLabel}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card className="flex flex-col border border-border/70 bg-card/60 shadow-sm">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              <span>Historial del Ticket</span>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {counts.total} {counts.total === 1 ? "mensaje" : "mensajes"}
            </Badge>
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
                  "rounded-xl border p-2.5 text-center transition-all hover:bg-muted/60",
                  historyStatus === s.key
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm"
                    : "border-border/60 bg-background/50"
                )}
              >
                <div className={cn("text-lg font-bold leading-none tracking-tight", s.color)}>{s.value}</div>
                <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">{s.label}</div>
              </button>
            ))}
          </div>

          <Select value={historyChannel} onValueChange={(v) => setHistoryChannel(v as "all" | CommunicationChannel)}>
            <SelectTrigger className="h-9 text-xs bg-background border-border/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🌐 Todos los canales</SelectItem>
              <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
              <SelectItem value="email">✉️ Email</SelectItem>
              <SelectItem value="sms">📱 SMS</SelectItem>
            </SelectContent>
          </Select>

          <ScrollArea className="h-[46vh] lg:h-[460px] pr-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs">Cargando comunicaciones…</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground/40 mb-3">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="font-medium text-xs text-foreground">
                  {historyChannel !== "all" || historyStatus !== "all"
                    ? "Sin mensajes con estos filtros"
                    : "Sin comunicaciones registradas"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Los mensajes enviados quedarán guardados aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMessages.map((m) => {
                  const status = STATUS_META[m.status] ?? STATUS_META.sent
                  const StatusIcon = status.icon
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "space-y-2 rounded-xl border border-l-[4px] bg-background p-3.5 shadow-xs transition-all",
                        CHANNEL_ACCENT[m.channel]
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          {channelIcon(m.channel)}
                          <span>{CHANNEL_LABEL[m.channel]}</span>
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            status.pill
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          <span>{status.label}</span>
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-foreground/90 bg-muted/20 rounded-md p-2 border border-border/40 font-normal">
                        {m.content}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span
                          className="text-[11px] text-muted-foreground"
                          title={formatDistanceToNow(new Date(m.sentAt), { addSuffix: true, locale: es })}
                        >
                          {formatDateTime(m.sentAt)}
                          <span className="ml-1 opacity-70">
                            ({formatDistanceToNow(new Date(m.sentAt), { addSuffix: true, locale: es })})
                          </span>
                        </span>

                        {m.status === "pending" && !m.id.startsWith("temp-") && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px] gap-1 font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/30"
                              onClick={() => onUpdateStatus?.(m.id, "sent")}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Confirmar envío
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => onUpdateStatus?.(m.id, "failed")}
                            >
                              <AlertCircle className="h-3 w-3" /> No enviado
                            </Button>
                          </div>
                        )}

                        {m.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px] gap-1 border-border/70 hover:bg-muted ml-auto"
                            onClick={() => handleRetry(m)}
                            disabled={isSending}
                          >
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
