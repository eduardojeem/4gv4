'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Palette, Bell, Globe, Sun, Moon, Monitor, Mail, Smartphone } from 'lucide-react'
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

  const notificationItems: { key: NotificationKey; label: string; icon: typeof Bell; color: string }[] = [
    { key: 'notifications', label: 'Notificaciones en la app', icon: Bell, color: 'text-blue-600' },
    { key: 'emailNotifications', label: 'Recibir emails', icon: Mail, color: 'text-green-600' },
    { key: 'pushNotifications', label: 'Notificaciones push', icon: Smartphone, color: 'text-purple-600' },
    { key: 'marketingEmails', label: 'Correos de marketing', icon: Mail, color: 'text-orange-600' }
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-violet-600" />
            <div>
              <CardTitle className="text-xl">Apariencia</CardTitle>
              <CardDescription>Personaliza como se ve la aplicacion.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Tema</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', icon: Sun, label: 'Claro', color: 'from-yellow-400 to-orange-400' },
                  { value: 'dark', icon: Moon, label: 'Oscuro', color: 'from-indigo-600 to-purple-600' },
                  { value: 'system', icon: Monitor, label: 'Auto', color: 'from-blue-500 to-cyan-500' }
                ].map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setTheme(m.value as 'light' | 'dark' | 'system')}
                    className={cn(
                      'group relative overflow-hidden rounded-xl border-2 p-4 text-sm font-medium transition-all duration-200',
                      theme === m.value ? 'border-primary shadow-lg shadow-primary/25' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className={cn('absolute inset-0 bg-gradient-to-br opacity-10 transition-opacity group-hover:opacity-20', m.color)} />
                    <div className="relative flex flex-col items-center gap-2">
                      <m.icon className={cn('h-6 w-6', theme === m.value ? 'text-primary' : 'text-muted-foreground')} />
                      <span className={cn('text-xs', theme === m.value ? 'text-primary font-bold' : 'text-muted-foreground')}>{m.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Color de enfasis</Label>
              <Select value={colorScheme} onValueChange={(v: ColorScheme) => setColorScheme(v)}>
                <SelectTrigger className="h-12 border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Por defecto</SelectItem>
                  <SelectItem value="blue">Azul</SelectItem>
                  <SelectItem value="green">Verde</SelectItem>
                  <SelectItem value="purple">Violeta</SelectItem>
                  <SelectItem value="orange">Naranja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-xl">Notificaciones</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {notificationItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-xl border border-transparent p-4 transition-colors hover:border-border hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={cn('rounded-lg bg-muted p-2', item.color)}>
                  <item.icon className="h-4 w-4" />
                </div>
                <Label className="cursor-pointer font-medium" htmlFor={item.key}>{item.label}</Label>
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-xl">Regional</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Idioma</Label>
            <Select value={prefs.language} onValueChange={(v) => setPrefs((p) => ({ ...p, language: v }))}>
              <SelectTrigger className="h-11 border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Espanol</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pt">Portugues</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Zona horaria</Label>
            <Select value={profile.timezone || ''} onValueChange={(v) => setProfile((p) => ({ ...p, timezone: v }))}>
              <SelectTrigger className="h-11 border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Asuncion">Asuncion (GMT-4)</SelectItem>
                <SelectItem value="America/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value={Intl.DateTimeFormat().resolvedOptions().timeZone}>Local ({Intl.DateTimeFormat().resolvedOptions().timeZone})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
