'use client'

import { MessageCircle, Phone } from 'lucide-react'
import { WhatsAppButton, WhatsAppLink } from '@/components/ui/whatsapp-button'
import { WhatsAppTemplates } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

interface CustomerWhatsAppContactProps {
  customerName: string
  customerPhone: string
  variant?: 'button' | 'link' | 'inline'
  className?: string
}

export function CustomerWhatsAppContact({
  customerName,
  customerPhone,
  variant = 'button',
  className
}: CustomerWhatsAppContactProps) {
  if (!customerPhone) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        <Phone className="inline h-3 w-3 mr-1" />
        Sin teléfono
      </div>
    )
  }

  const message = WhatsAppTemplates.welcomeMessage(customerName)

  // Variant: Link (texto con icono)
  if (variant === 'link') {
    return (
      <WhatsAppLink
        phone={customerPhone}
        message={message}
        className={className}
      >
        {customerPhone}
      </WhatsAppLink>
    )
  }

  // Variant: Inline (teléfono + botón pequeño)
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Phone className="h-3 w-3" />
          {customerPhone}
        </span>
        <WhatsAppButton
          phone={customerPhone}
          message={message}
          variant="ghost"
          size="sm"
          className="h-7 px-2"
        >
          <MessageCircle className="h-3 w-3" />
        </WhatsAppButton>
      </div>
    )
  }

  // Variant: Button (botón completo)
  return (
    <WhatsAppButton
      phone={customerPhone}
      message={message}
      variant="outline"
      size="sm"
      className={className}
    >
      Contactar
    </WhatsAppButton>
  )
}
