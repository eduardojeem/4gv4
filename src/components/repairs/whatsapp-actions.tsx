'use client'

import { useState } from 'react'
import { MessageCircle, Send, Clock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWhatsApp } from '@/hooks/useWhatsApp'
import { WhatsAppTemplates } from '@/lib/whatsapp'
import { toast } from 'sonner'

interface Repair {
  id: string
  customer: {
    name: string
    phone: string
  }
  device: string
  status: string
  final_cost?: number
  paid_amount?: number
}

interface WhatsAppRepairActionsProps {
  repair: Repair
}

export function WhatsAppRepairActions({ repair }: WhatsAppRepairActionsProps) {
  const { sendMessage } = useWhatsApp()
  const [isSending, setIsSending] = useState(false)

  const handleSendMessage = async (message: string, actionName: string) => {
    if (!repair.customer.phone) {
      toast.error('El cliente no tiene número de teléfono registrado')
      return
    }

    setIsSending(true)
    try {
      sendMessage({
        phone: repair.customer.phone,
        message
      })
      toast.success(`${actionName} enviado correctamente`)
    } catch (error) {
      toast.error('Error al abrir WhatsApp')
    } finally {
      setIsSending(false)
    }
  }

  const pendingAmount = (repair.final_cost || 0) - (repair.paid_amount || 0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isSending || !repair.customer.phone}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Acciones de WhatsApp</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleSendMessage(
            WhatsAppTemplates.repairStatus(
              repair.id,
              repair.customer.name,
              repair.status
            ),
            'Estado de reparación'
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          Enviar Estado Actual
        </DropdownMenuItem>

        {repair.status === 'listo' && (
          <DropdownMenuItem
            onClick={() => handleSendMessage(
              WhatsAppTemplates.repairReady(
                repair.id,
                repair.customer.name,
                repair.device
              ),
              'Notificación de reparación lista'
            )}
          >
            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
            Notificar Listo para Retirar
          </DropdownMenuItem>
        )}

        {pendingAmount > 0 && (
          <DropdownMenuItem
            onClick={() => handleSendMessage(
              WhatsAppTemplates.paymentReminder(
                repair.customer.name,
                pendingAmount,
                repair.id
              ),
              'Recordatorio de pago'
            )}
          >
            <Send className="mr-2 h-4 w-4 text-amber-600" />
            Recordatorio de Pago
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleSendMessage(
            `Hola ${repair.customer.name}! 👋\n\nEscríbeme sobre tu reparación #${repair.id}`,
            'Mensaje personalizado'
          )}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Mensaje Personalizado
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
