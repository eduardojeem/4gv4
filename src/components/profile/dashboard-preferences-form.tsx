'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
  Sparkles,
  LayoutGrid,
  Save,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react'
import type { ProfilePreferences, UserProfile, NotificationKey } from '@/app/dashboard/profile/page'
import type { ColorScheme } from '@/contexts/theme-context'
import { useTheme } from '@/contexts/theme-context'

export interface DashboardPreferencesFormProps {
  prefs: ProfilePreferences
  profile: UserProfile
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>
  onSave?: () => void
  isSaving?: boolean
  isDirty?: boolean
  isSynced?: boolean
}

export function DashboardPreferencesForm({
  prefs,
  profile,
  setProfile,
  onSave,
  isSaving = false,
  isDirty = false,
  isSynced = false
}: DashboardPreferencesFormProps) {
  const { theme, colorScheme, setTheme, setColorScheme } = useTheme()

  const notificationItems: {
    key: NotificationKey
    label: string
    description: string
    icon: typeof Bell
    iconColor: string
    disclaimer?: string
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
      iconColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
      disclaimer: 'La entrega de emails depende también de la configuración del servidor de correo de tu organización.'
    },
    {
      key: 'pushNotifications',
      label: 'Notificaciones push en navegador',
      description: 'Avisos de inventario crítico y mensajes de clientes',
      icon: Smartphone,
      iconColor: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40',
      disclaimer: 'Próximamente. Las notificaciones push están en desarrollo y aún no están activas en esta versión.'
    },
    {
      key: 'marketingEmails',
      label: 'Novedades y ofertas comerciales',
      description: 'Boletines mensuales y lanzamientos de nuevas herramientas',
      icon: Sparkles,
      iconColor: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
      disclaimer: 'La baja de marketing tarda hasta 48 h en aplicarse en todos los canales.'
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
              
              {/* Mini Preview del Color Seleccionado */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
                <span className="text-muted-foreground font-medium">Vista previa de acento:</span>
                <Button size="sm" className="h-6 text-[11px] px-2.5 pointer-events-none shadow-sm">
                  Botón
                </Button>
                <Badge variant="default" className="text-[10px] pointer-events-none">
                  Activo
                </Badge>
              </div>
            </div>
          </div>

          {/* Opciones de Fluidez y Pantalla */}
          <div className="space-y-3 pt-4 border-t border-border/60">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">Opciones de Espaciado y Automatización</Label>
            </div>
            
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Modo Compacto */}
              <div className="rounded-xl border border-border/50 p-3.5 transition-colors hover:border-border hover:bg-muted/30 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg p-2 mt-0.5 text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <div>
                    <Label className="cursor-pointer text-sm font-medium" htmlFor="pref-compactMode">
                      Modo compacto
                      <Badge variant="secondary" className="ml-2 text-[10px]">Próximamente</Badge>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Reduce el espaciado en tablas para visualizar más datos.
                    </p>
                  </div>
                </div>
                <Switch
                  id="pref-compactMode"
                  checked={prefs.compactMode}
                  disabled
                />
              </div>

              {/* Guardado Automático */}
              <div className="rounded-xl border border-border/50 p-3.5 transition-colors hover:border-border hover:bg-muted/30 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg p-2 mt-0.5 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40">
                    <Save className="h-4 w-4" />
                  </div>
                  <div>
                    <Label className="cursor-pointer text-sm font-medium" htmlFor="pref-autoSave">
                      Guardado automático
                      <Badge variant="secondary" className="ml-2 text-[10px]">Próximamente</Badge>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Guarda borradores y cambios sin requerir confirmación.
                    </p>
                  </div>
                </div>
                <Switch
                  id="pref-autoSave"
                  checked={prefs.autoSave}
                  disabled
                />
              </div>
            </div>
          </div>
        </CardContent>
        {isDirty && onSave && (
          <CardFooter className="flex justify-end border-t border-border/50 py-3 bg-muted/20">
            <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5 text-xs shadow-sm">
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar preferencias
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Notificaciones */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl">Notificaciones y Alertas</CardTitle>
                {isSynced && (
                  <Badge variant="outline" className="text-[10px] font-medium gap-1 border-emerald-400/60 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30">
                    <Check className="h-3 w-3" />
                    Sincronizado en la nube
                  </Badge>
                )}
              </div>
              <CardDescription>Configura los canales y la frecuencia de comunicaciones que deseas recibir.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {notificationItems.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-border/50 p-3.5 transition-colors hover:border-border hover:bg-muted/30 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn('rounded-lg p-2 mt-0.5', item.iconColor)}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <Label className="cursor-pointer text-sm font-medium" htmlFor={item.key}>
                      {item.label}
                      <Badge variant="secondary" className="ml-2 text-[10px]">Próximamente</Badge>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={item.key}
                  checked={prefs[item.key]}
                  disabled
                />
              </div>
              {item.disclaimer && (
                <p className="text-[11px] text-muted-foreground/80 pl-11 leading-snug italic">
                  ℹ️ {item.disclaimer}
                </p>
              )}
            </div>
          ))}
        </CardContent>
        {isDirty && onSave && (
          <CardFooter className="flex justify-end border-t border-border/50 py-3 bg-muted/20">
            <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5 text-xs shadow-sm">
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar preferencias
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Configuracion Regional */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Configuración Regional e Idioma</CardTitle>
              <CardDescription>Ajusta formatos de hora, calendario y localización geográfica.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Idioma de la interfaz</Label>
            <Select value={prefs.language} disabled>
              <SelectTrigger className="h-11 border-border/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español (Latinoamérica)</SelectItem>
                <SelectItem value="en">English (US)</SelectItem>
                <SelectItem value="pt">Português (Brasil)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Próximamente: el cambio de idioma se habilitará cuando toda la interfaz esté internacionalizada.</p>
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
        {isDirty && onSave && (
          <CardFooter className="flex justify-end border-t border-border/50 py-3 bg-muted/20">
            <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5 text-xs shadow-sm">
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar preferencias
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
