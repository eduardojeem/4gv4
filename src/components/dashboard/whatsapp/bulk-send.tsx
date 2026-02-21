'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Send, AlertCircle, CheckCircle } from 'lucide-react'
import { useWhatsApp } from '@/hooks/useWhatsApp'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function WhatsAppBulkSend() {
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('all')
  const [sending, setSending] = useState(false)
  const { sendMessage } = useWhatsApp()

  const handleBulkSend = async () => {
    if (!message) {
      toast.error('Escribe un mensaje')
      return
    }

    if (!confirm('¿Estás seguro de enviar este mensaje a múltiples clientes?')) {
      return
    }

    setSending(true)
    
    // Aquí deberías obtener los clientes de tu base de datos
    // Por ahora, simulamos con datos de ejemplo
    const mockClients = [
      { phone: '595981123456', name: 'Cliente 1' },
      { phone: '595981234567', name: 'Cliente 2' },
    ]

    let sent = 0
    for (const client of mockClients) {
      try {
        sendMessage({ 
          phone: client.phone, 
          message: message.replace('{nombre}', client.name)
        })
        sent++
        
        // Guardar en historial
        const history = JSON.parse(localStorage.getItem('whatsapp_history') || '[]')
        history.unshift({
          id: Date.now() + sent,
          phone: client.phone,
          message: message.replace('{nombre}', client.name),
          timestamp: new Date().toISOString(),
          type: 'bulk'
        })
        localStorage.setItem('whatsapp_history', JSON.stringify(history.slice(0, 100)))
        
        // Pequeña pausa entre mensajes
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error('Error sending to', client.phone, error)
      }
    }

    setSending(false)
    toast.success(`Mensajes enviados a ${sent} clientes`)
    setMessage('')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Envío Masivo
          </CardTitle>
          <CardDescription>
            Envía un mensaje a múltiples clientes a la vez
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Usa esta función con responsabilidad. Envía solo mensajes relevantes y útiles para tus clientes.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="filter">Filtrar Clientes</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                <SelectItem value="active_repairs">Con reparaciones activas</SelectItem>
                <SelectItem value="pending_payment">Con pagos pendientes</SelectItem>
                <SelectItem value="recent">Clientes recientes (30 días)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-message">Mensaje</Label>
            <Textarea
              id="bulk-message"
              placeholder="Escribe tu mensaje aquí... Usa {nombre} para personalizar"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Variables disponibles: {'{nombre}'}, {'{telefono}'}
            </p>
          </div>

          <Button 
            onClick={handleBulkSend}
            disabled={sending || !message}
            className="w-full bg-[#25D366] hover:bg-[#20BA5A]"
            size="lg"
          >
            {sending ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar a Todos
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vista Previa</CardTitle>
          <CardDescription>
            Ejemplo de cómo se verá el mensaje
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="rounded-lg rounded-tl-none bg-white dark:bg-gray-800 p-3 shadow-sm">
                <p className="text-sm whitespace-pre-wrap">
                  {message.replace('{nombre}', 'Juan Pérez') || 'Tu mensaje aparecerá aquí...'}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Personalización automática por cliente</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Pausa de 1 segundo entre mensajes</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Registro en historial automático</span>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Importante:</strong> WhatsApp puede limitar el envío masivo de mensajes. 
                Usa esta función solo cuando sea necesario y con mensajes relevantes.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
