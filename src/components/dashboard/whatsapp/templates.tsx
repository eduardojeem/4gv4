'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, Copy, Check } from 'lucide-react'
import { WhatsAppTemplates as Templates } from '@/lib/whatsapp'
import { useState } from 'react'
import { toast } from 'sonner'

const templatesList = [
  {
    id: 'repair_status',
    name: 'Estado de Reparación',
    description: 'Notifica cambios en el estado de una reparación',
    example: Templates.repairStatus('REP-001', 'Juan Pérez', 'En reparación'),
    variables: ['repairId', 'customerName', 'status']
  },
  {
    id: 'repair_ready',
    name: 'Reparación Lista',
    description: 'Notifica que una reparación está lista para retirar',
    example: Templates.repairReady('REP-001', 'Juan Pérez', 'iPhone 12'),
    variables: ['repairId', 'customerName', 'device']
  },
  {
    id: 'payment_reminder',
    name: 'Recordatorio de Pago',
    description: 'Recuerda al cliente sobre un pago pendiente',
    example: Templates.paymentReminder('Juan Pérez', 500000, 'REP-001'),
    variables: ['customerName', 'amount', 'repairId']
  },
  {
    id: 'welcome',
    name: 'Mensaje de Bienvenida',
    description: 'Saluda a un nuevo cliente',
    example: Templates.welcomeMessage('Juan Pérez'),
    variables: ['customerName']
  },
  {
    id: 'track_repair',
    name: 'Rastrear Reparación',
    description: 'Cliente consulta sobre su reparación',
    example: Templates.trackRepair('REP-001'),
    variables: ['repairId']
  },
  {
    id: 'price_inquiry',
    name: 'Consulta de Precio',
    description: 'Cliente consulta precio de un producto/servicio',
    example: Templates.priceInquiry('Cambio de pantalla iPhone'),
    variables: ['productOrService']
  }
]

export function WhatsAppTemplates() {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyTemplate = (template: string, id: string) => {
    navigator.clipboard.writeText(template)
    setCopiedId(id)
    toast.success('Plantilla copiada al portapapeles')
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Plantillas de Mensajes
          </CardTitle>
          <CardDescription>
            Plantillas predefinidas para diferentes situaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {templatesList.map((template) => (
              <Card key={template.id} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyTemplate(template.example, template.id)}
                    >
                      {copiedId === template.id ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm whitespace-pre-wrap">{template.example}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {template.variables.map((variable) => (
                      <Badge key={variable} variant="secondary" className="text-xs">
                        {variable}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
