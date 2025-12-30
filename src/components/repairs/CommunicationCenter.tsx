"use client";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CommunicationChannel, CommunicationMessage, CommunicationTemplate, ReminderRule, Repair } from "@/types/repairs";
import { expandTemplate } from "@/services/communication-service";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Mail, Smartphone, Send, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  repair: Repair | null;
  templates: CommunicationTemplate[];
  reminders?: ReminderRule[];
  messages: CommunicationMessage[];
  onSendMessage: (channel: CommunicationChannel, content: string, templateId?: string) => Promise<boolean>;
}

export function CommunicationCenter({ repair, templates, messages, onSendMessage }: Props) {
  const [selectedChannel, setSelectedChannel] = useState<CommunicationChannel>("whatsapp");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("custom");
  const [customMessage, setCustomMessage] = useState("");
  
  const variables = useMemo(() => ({
    customerName: repair?.customer?.name || "",
    repairId: repair?.id || "",
    deviceModel: repair?.device || "",
  }), [repair]);
  
  const [preview, setPreview] = useState<string>("");

  // Filtrar plantillas por canal seleccionado
  const channelTemplates = useMemo(() => 
    templates.filter(t => t.channel === selectedChannel),
  [templates, selectedChannel]);

  // Actualizar mensaje cuando cambia la plantilla o las variables
  useEffect(() => {
    if (selectedTemplateId === "custom") {
      setPreview(customMessage);
    } else {
      const tmpl = templates.find(t => t.id === selectedTemplateId);
      if (tmpl) {
        setPreview(expandTemplate(tmpl.content, variables));
      }
    }
  }, [selectedTemplateId, variables, templates, customMessage]);

  const handleSend = async () => {
    if (!repair) {
        toast.error("Seleccione una reparación primero");
        return;
    }
    if (!preview.trim()) {
      toast.error("El mensaje no puede estar vacío");
      return;
    }

    try {
      const success = await onSendMessage(selectedChannel, preview, selectedTemplateId === 'custom' ? undefined : selectedTemplateId);
      
      if (success) {
        toast.success(`Mensaje enviado por ${selectedChannel === 'whatsapp' ? 'WhatsApp' : selectedChannel}`);
        // Resetear a custom para permitir escribir otro mensaje
        if (selectedTemplateId !== "custom") {
            setCustomMessage(""); 
            setSelectedTemplateId("custom");
        } else {
            setCustomMessage("");
        }
      }
    } catch (error) {
      toast.error("Error inesperado al enviar mensaje");
    }
  };

  const getChannelIcon = (channel: CommunicationChannel) => {
    switch (channel) {
      case "whatsapp": return <MessageSquare className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "sms": return <Smartphone className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (!repair) {
    return (
        <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-muted/20 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>Selecciona una reparación para iniciar comunicación</p>
        </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Panel de Composición */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Nueva Comunicación</CardTitle>
          <CardDescription>
            Comunicación para {repair.customer.name} ({repair.device})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={selectedChannel} onValueChange={(v) => {
            setSelectedChannel(v as CommunicationChannel);
            setSelectedTemplateId("custom"); 
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="whatsapp" className="flex gap-2 items-center">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </TabsTrigger>
              <TabsTrigger value="email" className="flex gap-2 items-center">
                <Mail className="h-4 w-4" /> Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex gap-2 items-center">
                <Smartphone className="h-4 w-4" /> SMS
              </TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-4">
              <div className="grid gap-2">
                <Label>Plantilla</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Mensaje Personalizado</SelectItem>
                    {channelTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplateId === "custom" && (
                <div className="grid gap-2">
                  <Label>Mensaje Personalizado</Label>
                  <Textarea 
                    value={customMessage} 
                    onChange={(e) => setCustomMessage(e.target.value)} 
                    placeholder="Escribe tu mensaje aquí..."
                    className="min-h-[100px]"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Vista Previa</Label>
                <div className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap min-h-[100px] border">
                  {preview || <span className="text-muted-foreground italic">Selecciona una plantilla o escribe un mensaje para previsualizar...</span>}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSend} className="gap-2" disabled={!preview.trim()}>
                  <Send className="h-4 w-4" /> Enviar Mensaje
                </Button>
              </div>
            </div>
          </Tabs>

          <div className="pt-4 border-t">
             <Label className="mb-2 block">Variables Disponibles</Label>
             <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
               <Badge variant="outline">{'{{customerName}}'}</Badge>
               <Badge variant="outline">{'{{repairId}}'}</Badge>
               <Badge variant="outline">{'{{deviceModel}}'}</Badge>
             </div>
          </div>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Historial
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[500px] px-6 pb-6">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  No hay mensajes enviados aún.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="flex flex-col gap-2 p-3 border rounded-lg bg-card shadow-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 font-medium text-foreground">
                        {getChannelIcon(m.channel)}
                        <span className="capitalize">{m.channel}</span>
                      </div>
                      <span>{new Date(m.sentAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    <div className="flex items-center gap-1 text-xs mt-1">
                        {m.status === 'sent' ? (
                            <span className="flex items-center text-green-600 gap-1"><CheckCircle2 className="h-3 w-3"/> Enviado</span>
                        ) : (
                            <span className="flex items-center text-red-600 gap-1"><AlertCircle className="h-3 w-3"/> Error</span>
                        )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
