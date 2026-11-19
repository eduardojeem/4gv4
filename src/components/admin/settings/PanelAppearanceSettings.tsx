'use client'

import { useState } from 'react'
import { Check, LayoutDashboard, List, Monitor, Moon, Palette, RotateCcw, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/contexts/theme-context'
import { getSystemColorSchemeOption, isSystemColorScheme, DEFAULT_SYSTEM_COLOR_SCHEME } from '@/lib/theme/color-schemes'
import { PANEL_STYLES } from '@/lib/theme/panel-appearance'
import { SystemColorSchemePicker } from '@/components/system/system-color-scheme-picker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const MODES = [
  { value: 'light', label: 'Modo claro', description: 'Fondos claros y texto oscuro.', icon: Sun },
  { value: 'dark', label: 'Modo oscuro', description: 'Superficies oscuras con contraste legible.', icon: Moon },
  { value: 'system', label: 'Según el dispositivo', description: 'Se adapta al modo de tu equipo.', icon: Monitor },
] as const
const FINISHES = {
  neutral: { label: 'Neutro', description: 'Superficies discretas. El color destaca acciones y selecciones.' },
  tinted: { label: 'Con color', description: 'Tu paleta también acompaña fondos, tarjetas, tablas y pestañas.' },
  contrast: { label: 'Contraste marcado', description: 'Bordes y separadores más definidos para distinguir las secciones.' },
}

export function PanelAppearanceSettings() {
  const { theme, colorScheme, setTheme, setColorScheme, panelStyle = 'neutral', setPanelStyle, resetAppearance, isDark } = useTheme()
  const [tab, setTab] = useState('resumen')
  const [dialogOpen, setDialogOpen] = useState(false)
  const palette = getSystemColorSchemeOption(isSystemColorScheme(colorScheme) ? colorScheme : DEFAULT_SYSTEM_COLOR_SCHEME)
  const paletteLabel = colorScheme === 'custom' ? 'Personalizada' : palette.label
  return <div className="space-y-5">
    <Card>
      <CardHeader className="border-b pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Palette className="size-5" /></span><div><CardTitle><h2>Apariencia del panel</h2></CardTitle><CardDescription className="mt-2 max-w-xl leading-relaxed">Personalizá administración y dashboard. Los cambios se aplican al instante en este navegador; no hace falta guardar los datos del negocio. Solo cambia el panel: el marketplace y tu tienda online tienen su propio aspecto.</CardDescription></div></div>
          <Button type="button" variant="outline" size="sm" onClick={resetAppearance}><RotateCcw className="mr-2 size-4" />Restablecer apariencia</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">El acabado del panel no modifica la marca ni la plantilla de tu tienda pública.</p>
      </CardHeader>
      <CardContent className="space-y-7 pt-6">
        <fieldset><legend className="mb-3 text-sm font-semibold">1. Modo de visualización</legend><div className="grid gap-3 sm:grid-cols-3">{MODES.map(mode => <button type="button" key={mode.value} aria-pressed={theme === mode.value} onClick={() => setTheme(mode.value as Theme)} className={cn('min-w-0 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', theme === mode.value && 'border-primary bg-primary/5 ring-1 ring-primary/20')}><div className="mb-3 flex items-center justify-between"><mode.icon className="size-5 text-primary" />{theme === mode.value && <Check className="size-4 text-primary" />}</div><span className="block text-sm font-semibold">{mode.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{mode.description}</span></button>)}</div></fieldset>
        <fieldset><legend className="mb-3 text-sm font-semibold">2. Paleta del panel</legend><SystemColorSchemePicker compact value={colorScheme} onChange={setColorScheme} footerText="El color se usa en navegación, acciones, enlaces y selecciones. Combiná la paleta con el acabado de abajo para ampliar su presencia." /></fieldset>
        <fieldset><legend className="mb-3 text-sm font-semibold">3. Acabado de las secciones</legend><div className="grid gap-3 sm:grid-cols-3">{PANEL_STYLES.map(style => <button type="button" key={style} aria-pressed={panelStyle === style} onClick={() => setPanelStyle(style)} className={cn('min-w-0 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', panelStyle === style && 'border-primary bg-primary/5 ring-1 ring-primary/20')}><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{FINISHES[style].label}</span>{panelStyle === style && <Check className="size-4 shrink-0 text-primary" />}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{FINISHES[style].description}</p></button>)}</div></fieldset>
      </CardContent>
    </Card>
    <section aria-label="Vista previa del panel" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Vista previa del panel</h3><p className="mt-1 text-xs text-muted-foreground">Ejemplo de diseño; no son datos reales del negocio.</p></div><Badge variant="secondary" role="status">{paletteLabel} · {FINISHES[panelStyle].label} · {isDark ? 'Oscuro' : 'Claro'}</Badge></div>
      <div data-panel-shell className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] overflow-hidden rounded-2xl border bg-background sm:grid-cols-[8rem_minmax(0,1fr)]">
        <aside className="space-y-2 border-r bg-card p-2 sm:p-3" aria-label="Menú de ejemplo"><span className="mb-4 hidden px-2 text-xs font-semibold sm:block">Mi panel</span>{[{ value: 'resumen', label: 'Resumen', icon: LayoutDashboard }, { value: 'actividad', label: 'Actividad', icon: List }].map(item => <button type="button" key={item.value} aria-label={`${item.label} de ejemplo`} aria-pressed={tab === item.value} onClick={() => setTab(item.value)} className={cn('flex min-h-10 w-full items-center justify-center gap-2 rounded-lg p-2 text-xs sm:justify-start', tab === item.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}><item.icon className="size-4 shrink-0" /><span className="hidden sm:inline">{item.label}</span></button>)}</aside>
        <div className="min-w-0 space-y-4 p-3 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-semibold">Tu espacio de trabajo</span><Button type="button" size="sm" onClick={() => setDialogOpen(true)}>Probar un diálogo</Button></div>
          <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="resumen">Resumen</TabsTrigger><TabsTrigger value="actividad">Actividad</TabsTrigger></TabsList><TabsContent value="resumen" className="space-y-3"><Card><CardHeader className="pb-3"><CardTitle className="text-sm">Tarjeta de ejemplo</CardTitle><CardDescription>El fondo, el borde y el encabezado siguen tu elección.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2 pt-3"><Badge className="bg-primary text-primary-foreground">Selección activa</Badge><Badge variant="secondary">Estado neutral</Badge></CardContent></Card></TabsContent><TabsContent value="actividad"><div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-xs"><thead data-slot="table-header"><tr><th className="p-3">Elemento</th><th className="p-3">Estado</th></tr></thead><tbody><tr className="border-t"><td className="p-3">Registro de ejemplo</td><td className="p-3"><span className="font-medium text-success">Completado</span></td></tr></tbody></table></div></TabsContent></Tabs>
          <p className="text-xs leading-relaxed text-muted-foreground">Los estados de cobro, las alertas y los errores conservan sus colores para que puedas reconocerlos.</p>
        </div>
      </div>
    </section>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>Así se verá un diálogo</DialogTitle><DialogDescription>Vista de ejemplo de la apariencia del panel.</DialogDescription></DialogHeader><div className="flex justify-end"><Button type="button" onClick={() => setDialogOpen(false)}>Cerrar ejemplo</Button></div></DialogContent></Dialog>
  </div>
}
