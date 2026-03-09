'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Settings, Save, Phone, Bell, Clock } from 'lucide-react'
import { toast } from 'sonner'
import {
  DashboardWhatsAppSettings,
  fetchDashboardWhatsAppSettings,
  saveDashboardWhatsAppSettings,
} from '@/lib/dashboard-whatsapp-api'

const DEFAULT_SETTINGS: DashboardWhatsAppSettings = {
  businessPhone: '',
  autoNotifyRepairReady: true,
  autoNotifyStatusChange: false,
  autoPaymentReminders: false,
  reminderDays: 3,
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00',
}

export function WhatsAppSettings() {
  const [settings, setSettings] = useState<DashboardWhatsAppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchDashboardWhatsAppSettings()
        setSettings(data)
      } catch (error) {
        console.error('WhatsApp settings load error:', error)
        toast.error('No se pudo cargar la configuracion')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const handleSave = async () => {
    if (!settings.businessHoursStart || !settings.businessHoursEnd) {
      toast.error('Completa el horario comercial')
      return
    }

    setSaving(true)
    try {
      const saved = await saveDashboardWhatsAppSettings(settings)
      setSettings(saved)
      toast.success('Configuracion guardada correctamente')
    } catch (error) {
      console.error('WhatsApp settings save error:', error)
      toast.error('No se pudo guardar la configuracion')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuracion General
          </CardTitle>
          <CardDescription>
            Configura los ajustes de WhatsApp Business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessPhone">Numero de Negocio</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="businessPhone"
                value={settings.businessPhone}
                onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })}
                placeholder="595981123456"
                className="pl-10"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Este numero se usa para boton flotante y consultas generales
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones Automaticas
          </CardTitle>
          <CardDescription>
            Configura que notificaciones se envian automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificar Reparacion Lista</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensaje cuando el estado cambie a "Listo"
              </p>
            </div>
            <Switch
              checked={settings.autoNotifyRepairReady}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, autoNotifyRepairReady: checked })
              }
              disabled={loading}
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
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Recordatorios de Pago Automaticos</Label>
              <p className="text-sm text-muted-foreground">
                Enviar recordatorios de pagos pendientes
              </p>
            </div>
            <Switch
              checked={settings.autoPaymentReminders}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, autoPaymentReminders: checked })
              }
              disabled={loading}
            />
          </div>

          {settings.autoPaymentReminders && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label htmlFor="reminderDays">Dias para recordatorio</Label>
              <Input
                id="reminderDays"
                type="number"
                min="1"
                max="30"
                value={settings.reminderDays}
                onChange={(e) =>
                  setSettings({ ...settings, reminderDays: Number(e.target.value || 3) })
                }
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Enviar recordatorio despues de X dias de pago pendiente
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
            Define el horario para envio de mensajes automaticos
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
                disabled={loading}
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
                disabled={loading}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Los mensajes automaticos solo se enviaran dentro de este horario
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" className="gap-2" disabled={saving || loading}>
          <Save className="h-4 w-4" />
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </Button>
      </div>
    </div>
  )
}

