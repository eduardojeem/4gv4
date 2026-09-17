'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Palette,
  Bell,
  Globe,
  Sun,
  Moon,
  Monitor,
  Mail,
  Smartphone,
  Clock,
  Check,
  Sparkles
} from 'lucide-react'
import type { ProfilePreferences, UserProfile, NotificationKey } from '@/app/dashboard/profile/page'
import type { ColorScheme } from '@/contexts/theme-context'
import { useTheme } from '@/contexts/theme-context'

export interface DashboardPreferencesFormProps {
  prefs: ProfilePreferences
  setPrefs: React.Dispatch<React.SetStateAction<ProfilePreferences>>
  profile: UserProfile
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>
}

export function DashboardPreferencesForm({ prefs, setPrefs, profile, setProfile }: DashboardPreferencesFormProps) {
  const { theme, colorScheme, setTheme, setColorScheme } = useTheme()

  const notificationItems: {
    key: NotificationKey
    label: string
    description: string
    icon: typeof Bell
    iconColor: string
    badgeText?: string
  }[] = [
    {
      key: 'notifications',
      label: 'Notificaciones en la app',
      description: 'Alertas en tiempo real dentro del panel de control',
      icon: Bell,
      iconColor: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40'
    },
    {
      key: 'emailNotifications',
      label: 'Recibir emails del sistema',
      description: 'Facturas, cotizaciones y resúmenes de órdenes',
      icon: Mail,
      iconColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
    },
    {
      key: 'pushNotifications',
      label: 'Notificaciones push en navegador',
      description: 'Avisos de inventario crítico y mensajes de clientes',
      icon: Smartphone,
      iconColor: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40'
    },
    {
      key: 'marketingEmails',
      label: 'Novedades y ofertas comerciales',
      description: 'Boletines mensuales y lanzamientos de nuevas herramientas',
      icon: Sparkles,
      iconColor: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
    }
  ]

  const handleDetectTimezone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) {
        setProfile((prev) => ({ ...prev, timezone: tz }))
        toast.success(`Zona horaria detectada: ${tz}`)
      } else {
        toast.error('No se pudo resolver la zona horaria del navegador')
      }
    } catch {
      toast.error('Error al detectar la zona horaria')
    }
  }

  const colorOptions: { value: ColorScheme; label: string; dot: string }[] = [
    { value: 'default', label: 'Por defecto (Zinc)', dot: 'bg-zinc-600' },
    { value: 'blue', label: 'Azul Corporativo', dot: 'bg-blue-600' },
    { value: 'green', label: 'Verde Esmeralda', dot: 'bg-emerald-600' },
    { value: 'purple', label: 'Violeta Tecnológico', dot: 'bg-purple-600' },
    { value: 'orange', label: 'Naranja Comercial', dot: 'bg-orange-500' }
  ]

  return (
    <div className="space-y-6">
      {/* Apariencia e Interfaz */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Apariencia y Visualización</CardTitle>
              <CardDescription>Personaliza el estilo visual, modo de color y contraste del sistema.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Modo de Tema */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Tema de la interfaz</Label>
                <Badge variant="outline" className="text-[11px] capitalize">
                  {theme === 'system' ? 'Automático' : theme === 'dark' ? 'Oscuro' : 'Claro'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', icon: Sun, label: 'Claro', color: 'from-amber-400 to-orange-400' },
                  { value: 'dark', icon: Moon, label: 'Oscuro', color: 'from-indigo-600 to-purple-600' },
                  { value: 'system', icon: Monitor, label: 'Sistema', color: 'from-blue-500 to-cyan-500' }
                ].map((m) => {
                  const isActive = theme === m.value
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setTheme(m.value as 'light' | 'dark' | 'system')}
                      className={cn(
                        'group relative overflow-hidden rounded-xl border-2 p-3 text-sm font-medium transition-all duration-200 text-center',
                        isActive
                          ? 'border-primary shadow-md shadow-primary/20 bg-primary/5'
                          : 'border-border/60 hover:border-primary/40 bg-card'
                      )}
                    >
                      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-5 transition-opacity group-hover:opacity-15', m.color)} />
                      <div className="relative flex flex-col items-center gap-1.5">
                        <div className={cn('p-1.5 rounded-lg transition-transform group-hover:scale-110', isActive ? 'text-primary' : 'text-muted-foreground')}>
                          <m.icon className="h-5 w-5" />
                        </div>
                        <span className={cn('text-xs font-medium', isActive ? 'text-primary font-bold' : 'text-muted-foreground')}>
                          {m.label}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Color de Enfasis */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Color de énfasis</Label>
              <Select value={colorScheme} onValueChange={(v: ColorScheme) => setColorScheme(v)}>
                <SelectTrigger className="h-12 border-border/70">
                  <SelectValue placeholder="Selecciona un color de énfasis" />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2.5">
                        <span className={cn('h-3.5 w-3.5 rounded-full shadow-sm', opt.dot)} />
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define el tinte de los botones principales, estados activos y acentos del panel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notificaciones */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Notificaciones y Alertas</CardTitle>
              <CardDescription>Configura los canales y la frecuencia de comunicaciones que deseas recibir.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {notificationItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl border border-border/50 p-3.5 transition-colors hover:border-border hover:bg-muted/30"
            >
              <div className="flex items-start gap-3">
                <div className={cn('rounded-lg p-2 mt-0.5', item.iconColor)}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <Label className="cursor-pointer text-sm font-medium" htmlFor={item.key}>
                    {item.label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
              <Switch
                id={item.key}
                checked={prefs[item.key]}
                onCheckedChange={(c) => setPrefs((p) => ({ ...p, [item.key]: c }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Configuracion Regional */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Configuracion Regional e Idioma</CardTitle>
              <CardDescription>Ajusta formatos de hora, calendario y localización geográfica.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Idioma de la interfaz</Label>
            <Select value={prefs.language} onValueChange={(v) => setPrefs((p) => ({ ...p, language: v }))}>
              <SelectTrigger className="h-11 border-border/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español (Latinoamérica)</SelectItem>
                <SelectItem value="en">English (US)</SelectItem>
                <SelectItem value="pt">Português (Brasil)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Idioma utilizado para tablas, reportes y correos del sistema.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Zona horaria
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
                onClick={handleDetectTimezone}
              >
                <Sparkles className="h-3 w-3" />
                Detectar automáticamente
              </Button>
            </div>
            <Select
              value={profile.timezone || 'America/Asuncion'}
              onValueChange={(v) => setProfile((p) => ({ ...p, timezone: v }))}
            >
              <SelectTrigger className="h-11 border-border/70">
                <SelectValue placeholder="Seleccionar zona horaria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Asuncion">Asunción (GMT-4 / GMT-3)</SelectItem>
                <SelectItem value="America/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                <SelectItem value="America/Santiago">Santiago de Chile (GMT-4)</SelectItem>
                <SelectItem value="America/Bogota">Bogotá (GMT-5)</SelectItem>
                <SelectItem value="America/Mexico_City">Ciudad de México (GMT-6)</SelectItem>
                <SelectItem value="America/New_York">Nueva York (EST/EDT)</SelectItem>
                <SelectItem value="America/Montevideo">Montevideo (GMT-3)</SelectItem>
                <SelectItem value="America/Lima">Lima (GMT-5)</SelectItem>
                <SelectItem value="UTC">UTC (Universal)</SelectItem>
                {typeof window !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone && (
                  <SelectItem value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                    Navegador ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Asegura que los registros de auditoría y facturas se emitan con tu hora local exacta.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
