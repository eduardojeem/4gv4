'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Send, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCustomers } from '@/hooks/use-customers'
import {
  notifyDashboardWhatsAppUpdated,
  sendDashboardWhatsAppMessage,
} from '@/lib/dashboard-whatsapp-api'

type BulkFilter = 'all' | 'active_repairs' | 'pending_payment' | 'recent'

interface Recipient {
  id: string
  name: string
  phone: string
  totalRepairs: number
  pendingAmount: number
  createdAt: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function personalizeMessage(template: string, recipient: Recipient): string {
  return template
    .replace(/\{nombre\}/gi, recipient.name)
    .replace(/\{telefono\}/gi, recipient.phone)
}

export function WhatsAppBulkSend() {
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<BulkFilter>('all')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState({ sent: 0, failed: 0, processed: 0, total: 0 })

  const { allCustomers, isLoading } = useCustomers({ autoRefresh: false })

  const recipients = useMemo<Recipient[]>(() => {
    const now = Date.now()

    const base = (allCustomers || [])
      .map((customer: any) => {
        const phone = String(customer?.whatsapp || customer?.phone || '').trim()
        if (!phone) return null

        return {
          id: String(customer?.id || ''),
          name: String(customer?.name || 'Cliente'),
          phone,
          totalRepairs: Number(customer?.total_repairs || 0),
          pendingAmount: Number(customer?.pending_amount || customer?.current_balance || 0),
          createdAt: String(customer?.created_at || customer?.registration_date || ''),
        } as Recipient
      })
      .filter((customer): customer is Recipient => Boolean(customer && customer.id && customer.phone))

    return base.filter((customer) => {
      if (filter === 'all') return true

      if (filter === 'active_repairs') {
        return customer.totalRepairs > 0
      }

      if (filter === 'pending_payment') {
        return customer.pendingAmount > 0
      }

      if (filter === 'recent') {
        if (!customer.createdAt) return false
        const createdAt = new Date(customer.createdAt).getTime()
        if (!Number.isFinite(createdAt)) return false
        return now - createdAt <= 30 * 24 * 60 * 60 * 1000
      }

      return true
    })
  }, [allCustomers, filter])

  const handleBulkSend = async () => {
    if (!message.trim()) {
      toast.error('Escribe un mensaje')
      return
    }

    if (recipients.length === 0) {
      toast.error('No hay clientes para el filtro seleccionado')
      return
    }

    if (!confirm(`Vas a enviar ${recipients.length} mensajes. Deseas continuar?`)) {
      return
    }

    setSending(true)
    setProgress({ sent: 0, failed: 0, processed: 0, total: recipients.length })

    let sentCount = 0
    let failedCount = 0

    for (let i = 0; i < recipients.length; i += 1) {
      const recipient = recipients[i]
      const personalized = personalizeMessage(message, recipient)

      try {
        const result = await sendDashboardWhatsAppMessage({
          phone: recipient.phone,
          message: personalized,
          source: 'bulk',
          transport: 'cloud',
          customerId: recipient.id,
          recipientName: recipient.name,
          metadata: {
            bulkFilter: filter,
            index: i,
            total: recipients.length,
          },
        })

        if (result.sent) {
          sentCount += 1
        } else {
          failedCount += 1
        }
      } catch (error) {
        failedCount += 1
        console.error('Bulk send error:', recipient.phone, error)
      }

      setProgress({
        sent: sentCount,
        failed: failedCount,
        processed: i + 1,
        total: recipients.length,
      })

      await sleep(600)
    }

    setSending(false)

    if (failedCount > 0) {
      toast.warning(`Enviados: ${sentCount} | Fallidos: ${failedCount}`)
    } else {
      toast.success(`Mensajes enviados a ${sentCount} clientes`)
    }

    if (sentCount > 0 || failedCount > 0) {
      notifyDashboardWhatsAppUpdated()
    }

    setMessage('')
  }

  const preview = personalizeMessage(message || 'Tu mensaje aparecera aqui...', {
    id: 'preview',
    name: 'Juan Perez',
    phone: '595981123456',
    totalRepairs: 0,
    pendingAmount: 0,
    createdAt: '',
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Envio Masivo
          </CardTitle>
          <CardDescription>
            Envia un mensaje a multiples clientes a la vez
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Usa esta funcion con responsabilidad. Envia solo mensajes relevantes y utiles.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="filter">Filtrar Clientes</Label>
            <Select value={filter} onValueChange={(value) => setFilter(value as BulkFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                <SelectItem value="active_repairs">Con reparaciones activas</SelectItem>
                <SelectItem value="pending_payment">Con pagos pendientes</SelectItem>
                <SelectItem value="recent">Clientes recientes (30 dias)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Cargando clientes...' : `${recipients.length} clientes con telefono`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-message">Mensaje</Label>
            <Textarea
              id="bulk-message"
              placeholder="Escribe tu mensaje aqui... Usa {nombre} para personalizar"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Variables disponibles: {'{nombre}'}, {'{telefono}'}
            </p>
          </div>

          {sending && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">
                Progreso: {progress.processed}/{progress.total}
              </p>
              <p className="text-muted-foreground">
                Enviados: {progress.sent} | Fallidos: {progress.failed}
              </p>
            </div>
          )}

          <Button
            onClick={handleBulkSend}
            disabled={sending || !message.trim() || recipients.length === 0}
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
            Ejemplo de como se vera el mensaje
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="rounded-lg rounded-tl-none bg-white dark:bg-gray-800 p-3 shadow-sm">
                <p className="text-sm whitespace-pre-wrap">{preview}</p>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Personalizacion automatica por cliente</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Registro centralizado en historial</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Estado sent/failed por cada envio</span>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Importante:</strong> WhatsApp puede limitar envios masivos. Usa mensajes relevantes y con consentimiento del cliente.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

