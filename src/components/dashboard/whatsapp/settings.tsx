'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Settings, Save, Phone, Bell, Clock } from 'lucide-react'
import { toast } from 'sonner'

export function WhatsAppSettings() {
  const [settings, setSettings] = useState({
    businessPhone: process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS || '',
    autoNotifyRepairReady: true,
    autoNotifyStatusChange: false,
    autoPaymentReminders: false,
    reminderDays: 3,
    businessHoursStart: '09:00',
    businessHoursEnd: '18:00'
  })

  useEffect(() => {
    const saved = localStorage.getItem('whatsapp_settings')
    if (saved) {
      setSettings({ ...settings, ...JSON.parse(saved) })
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem('whatsapp_settings', JSON.stringify(settings))
    toast.success('Configuración guardada correctamente')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración General
          </CardTitle>
          <CardDescription>
            Configura los ajustes de WhatsApp Business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessPhone">Número de Negocio</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="businessPhone"
                value={settings.businessPhone}
                onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })}
                placeholder="595981123456"
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Este número se usa para el botón flotante y consultas generales
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones Automáticas
          </CardTitle>
          <CardDescription>
            Configura qué notificaciones se envían automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificar Reparación Lista</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensaje cuando el estado cambie a "Listo"
              </p>
            </div>
            <Switch
              checked={settings.autoNotifyRepairReady}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, autoNotifyRepairReady: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificar Cambios de Estado</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensaje en cada cambio de estado
              </p>
            </div>
            <Switch
              checked={settings.autoNotifyStatusChange}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, autoNotifyStatusChange: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Recordatorios de Pago Automáticos</Label>
              <p className="text-sm text-muted-foreground">
                Enviar recordatorios de pagos pendientes
              </p>
            </div>
            <Switch
              checked={settings.autoPaymentReminders}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, autoPaymentReminders: checked })
              }
            />
          </div>

          {settings.autoPaymentReminders && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label htmlFor="reminderDays">Días para recordatorio</Label>
              <Input
                id="reminderDays"
                type="number"
                min="1"
                max="30"
                value={settings.reminderDays}
                onChange={(e) => 
                  setSettings({ ...settings, reminderDays: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Enviar recordatorio después de X días de pago pendiente
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horario Comercial
          </CardTitle>
          <CardDescription>
            Define el horario para envío de mensajes automáticos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hoursStart">Hora de Inicio</Label>
              <Input
                id="hoursStart"
                type="time"
                value={settings.businessHoursStart}
                onChange={(e) => 
                  setSettings({ ...settings, businessHoursStart: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hoursEnd">Hora de Fin</Label>
              <Input
                id="hoursEnd"
                type="time"
                value={settings.businessHoursEnd}
                onChange={(e) => 
                  setSettings({ ...settings, businessHoursEnd: e.target.value })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Los mensajes automáticos solo se enviarán dentro de este horario
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" className="gap-2">
          <Save className="h-4 w-4" />
          Guardar Configuración
        </Button>
      </div>
    </div>
  )
}
