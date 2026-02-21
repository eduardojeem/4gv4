'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Send, User, Phone, MessageSquare } from 'lucide-react'
import { useWhatsApp } from '@/hooks/useWhatsApp'
import { WhatsAppTemplates as Templates } from '@/lib/whatsapp'
import { toast } from 'sonner'

export function WhatsAppSendMessage() {
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const { sendMessage } = useWhatsApp()

  const handleSend = () => {
    if (!phone) {
      toast.error('Ingresa un número de teléfono')
      return
    }
    if (!message) {
      toast.error('Escribe un mensaje')
      return
    }

    sendMessage({ phone, message })
    toast.success('Mensaje enviado por WhatsApp')
    
    // Guardar en historial (localStorage por ahora)
    const history = JSON.parse(localStorage.getItem('whatsapp_history') || '[]')
    history.unshift({
      id: Date.now(),
      phone,
      message,
      timestamp: new Date().toISOString(),
      type: 'manual'
    })
    localStorage.setItem('whatsapp_history', JSON.stringify(history.slice(0, 100)))
    
    // Limpiar formulario
    setMessage('')
  }

  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template)
    
    // Ejemplos de uso de plantillas
    switch (template) {
      case 'welcome':
        setMessage(Templates.welcomeMessage('Cliente'))
        break
      case 'general':
        setMessage(Templates.generalInquiry())
        break
      case 'repair_status':
        setMessage('Hola! Tu reparación #[ID] ha cambiado de estado a: [ESTADO]\n\n¿Necesitas más información?')
        break
      case 'repair_ready':
        setMessage('¡Buenas noticias! 🎉\n\nTu [DISPOSITIVO] (Reparación #[ID]) ya está listo para retirar.\n\nPuedes pasar por nuestro local.')
        break
      case 'payment_reminder':
        setMessage('Hola,\n\nTe recordamos que tienes un saldo pendiente de Gs. [MONTO] por la reparación #[ID].\n\n¿Podemos coordinar el pago?')
        break
      default:
        setMessage('')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Mensaje
          </CardTitle>
          <CardDescription>
            Envía un mensaje directo a un cliente por WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Número de Teléfono</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="595981123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Formato: código de país + número (ej: 595981123456)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Plantilla (Opcional)</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una plantilla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin plantilla</SelectItem>
                <SelectItem value="welcome">Mensaje de Bienvenida</SelectItem>
                <SelectItem value="general">Consulta General</SelectItem>
                <SelectItem value="repair_status">Estado de Reparación</SelectItem>
                <SelectItem value="repair_ready">Reparación Lista</SelectItem>
                <SelectItem value="payment_reminder">Recordatorio de Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              placeholder="Escribe tu mensaje aquí..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {message.length} caracteres
            </p>
          </div>

          <Button 
            onClick={handleSend} 
            className="w-full bg-[#25D366] hover:bg-[#20BA5A]"
            size="lg"
          >
            <Send className="mr-2 h-4 w-4" />
            Enviar por WhatsApp
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Vista Previa
          </CardTitle>
          <CardDescription>
            Así se verá tu mensaje en WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="space-y-4">
              {/* Simulación de chat de WhatsApp */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="rounded-lg rounded-tl-none bg-white dark:bg-gray-800 p-3 shadow-sm">
                    <p className="text-sm whitespace-pre-wrap">
                      {message || 'Tu mensaje aparecerá aquí...'}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground text-right">
                      {new Date().toLocaleTimeString('es-PY', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">💡 Tips para mensajes efectivos:</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Usa *texto* para negrita</li>
                  <li>• Usa _texto_ para cursiva</li>
                  <li>• Usa ~texto~ para tachado</li>
                  <li>• Usa emojis para hacer el mensaje más amigable 😊</li>
                  <li>• Sé claro y conciso</li>
                  <li>• Incluye información de contacto si es necesario</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
