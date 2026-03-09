'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Send, User, Phone, MessageSquare, RefreshCw } from 'lucide-react'
import { formatWhatsAppPhone, getWhatsAppLink, WhatsAppTemplates as Templates } from '@/lib/whatsapp'
import { toast } from 'sonner'
import { useCustomers } from '@/hooks/use-customers'
import {
  notifyDashboardWhatsAppUpdated,
  sendDashboardWhatsAppMessage,
  updateDashboardWhatsAppMessage,
} from '@/lib/dashboard-whatsapp-api'

interface ContactOption {
  id: string
  name: string
  phone: string
}

function normalizePhone(phone: string): string {
  if (!phone.trim()) return ''
  return formatWhatsAppPhone(phone).replace(/\D/g, '')
}

export function WhatsAppSendMessage() {
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('none')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('none')
  const [sending, setSending] = useState(false)

  const { allCustomers, isLoading: customersLoading, actions } = useCustomers({ autoRefresh: false })

  const contacts = useMemo<ContactOption[]>(() => {
    return (allCustomers || [])
      .map((customer: any) => {
        const id = String(customer?.id || '')
        const name = String(customer?.name || 'Cliente')
        const rawPhone = String(customer?.whatsapp || customer?.phone || '').trim()
        const normalized = normalizePhone(rawPhone)

        if (!id || !normalized) {
          return null
        }

        return {
          id,
          name,
          phone: normalized,
        } as ContactOption
      })
      .filter((contact): contact is ContactOption => Boolean(contact))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allCustomers])

  const selectedContact = useMemo(() => {
    if (selectedCustomerId === 'none') return null
    return contacts.find((contact) => contact.id === selectedCustomerId) || null
  }, [contacts, selectedCustomerId])

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone])
  const isPhoneValid = normalizedPhone.length >= 10

  const openManualWhatsApp = (targetPhone: string, targetMessage: string): boolean => {
    const link = getWhatsAppLink({ phone: targetPhone, message: targetMessage })
    const popup = window.open(link, '_blank', 'noopener,noreferrer')
    if (popup) return true

    window.location.href = link
    return true
  }

  const applyTemplate = (template: string, customerName: string) => {
    switch (template) {
      case 'welcome':
        setMessage(Templates.welcomeMessage(customerName || 'Cliente'))
        break
      case 'general':
        setMessage(Templates.generalInquiry())
        break
      case 'repair_status':
        setMessage('Hola! Tu reparacion #[ID] ha cambiado de estado a: [ESTADO]\n\nNecesitas mas informacion?')
        break
      case 'repair_ready':
        setMessage('Buenas noticias!\n\nTu [DISPOSITIVO] (Reparacion #[ID]) ya esta listo para retirar.\n\nPuedes pasar por nuestro local.')
        break
      case 'payment_reminder':
        setMessage('Hola,\n\nTe recordamos que tienes un saldo pendiente de Gs. [MONTO] por la reparacion #[ID].\n\nPodemos coordinar el pago?')
        break
      default:
        setMessage('')
        break
    }
  }

  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template)
    applyTemplate(template, selectedContact?.name || 'Cliente')
  }

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId)
    if (customerId === 'none') {
      return
    }

    const contact = contacts.find((item) => item.id === customerId)
    if (!contact) {
      return
    }

    setPhone(contact.phone)

    if (selectedTemplate !== 'none') {
      applyTemplate(selectedTemplate, contact.name)
    }
  }

  const handleSend = async () => {
    if (!normalizedPhone) {
      toast.error('Ingresa un numero de telefono')
      return
    }
    if (!isPhoneValid) {
      toast.error('El numero de telefono no es valido')
      return
    }
    if (!message.trim()) {
      toast.error('Escribe un mensaje')
      return
    }

    setSending(true)
    try {
      const result = await sendDashboardWhatsAppMessage({
        phone: normalizedPhone,
        message,
        source: 'manual',
        transport: 'cloud',
        customerId: selectedContact?.id || null,
        recipientName: selectedContact?.name || null,
      })

      if (result.sent) {
        toast.success('Mensaje enviado por WhatsApp Cloud')
        setMessage('')
        notifyDashboardWhatsAppUpdated()
        return
      }

      const canFallback = ['not_configured', 'provider_error', 'network_error'].includes(result.reason || '')
      if (!canFallback) {
        toast.error('No se pudo enviar el mensaje')
        return
      }

      const opened = openManualWhatsApp(normalizedPhone, message)
      if (!opened) {
        toast.error('No se pudo abrir WhatsApp manualmente')
        return
      }

      if (result.message?.id) {
        await updateDashboardWhatsAppMessage({
          id: result.message.id,
          status: 'sent',
          provider: 'wa.me',
          providerReason: 'manual_fallback',
        })
      } else {
        await sendDashboardWhatsAppMessage({
          phone: normalizedPhone,
          message,
          source: 'manual',
          transport: 'manual',
          customerId: selectedContact?.id || null,
          recipientName: selectedContact?.name || null,
        })
      }

      toast.success('Cloud no disponible. Se abrio WhatsApp manualmente')
      setMessage('')
      notifyDashboardWhatsAppUpdated()
    } catch (error) {
      console.error('WhatsApp send error:', error)
      toast.error('No se pudo enviar el mensaje')
    } finally {
      setSending(false)
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
            Envia un mensaje directo a un cliente por WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="customer">Cliente (Opcional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={actions.refresh}
                disabled={customersLoading || sending}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Actualizar
              </Button>
            </div>
            <Select value={selectedCustomerId} onValueChange={handleCustomerSelect}>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cliente</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name} - {contact.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {customersLoading ? 'Cargando clientes...' : `${contacts.length} clientes con telefono disponible`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Numero de Telefono</Label>
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
              Formato internacional (ej: 595981123456). Normalizado: {normalizedPhone || '-'}
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
                <SelectItem value="repair_status">Estado de Reparacion</SelectItem>
                <SelectItem value="repair_ready">Reparacion Lista</SelectItem>
                <SelectItem value="payment_reminder">Recordatorio de Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              placeholder="Escribe tu mensaje aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">{message.length} caracteres</p>
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !message.trim() || !isPhoneValid}
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
                Enviar por WhatsApp
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Vista Previa
          </CardTitle>
          <CardDescription>Asi se vera tu mensaje en WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="rounded-lg rounded-tl-none bg-white dark:bg-gray-800 p-3 shadow-sm">
                    <p className="text-xs text-muted-foreground mb-1">
                      {selectedContact?.name || 'Cliente'}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{message || 'Tu mensaje aparecera aqui...'}</p>
                    <p className="mt-2 text-xs text-muted-foreground text-right">
                      {new Date().toLocaleTimeString('es-PY', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Tips para mensajes efectivos:</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>* Usa *texto* para negrita</li>
                  <li>* Usa _texto_ para cursiva</li>
                  <li>* Usa ~texto~ para tachado</li>
                  <li>* Se claro y conciso</li>
                  <li>* Incluye informacion clave y accion siguiente</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
