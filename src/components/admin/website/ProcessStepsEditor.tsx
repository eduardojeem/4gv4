'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2, Save, ArrowUp, ArrowDown, Plus, Trash2, Footprints, Check } from 'lucide-react'
import { ProcessStep } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

export function ProcessStepsEditor() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [stepsDraft, setStepsDraft] = useState<ProcessStep[] | null>(null)
  const [processEnabledDraft, setProcessEnabledDraft] = useState<boolean | null>(null)
  
  const steps = stepsDraft ?? settings?.process_steps ?? getWebsiteSettingsDefaults().process_steps
  const processEnabled = processEnabledDraft ?? settings?.company_info?.processSectionEnabled ?? getWebsiteSettingsDefaults().company_info.processSectionEnabled
  const hasChanges = stepsDraft !== null || processEnabledDraft !== null

  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  const handleSave = async () => {
    const invalid = steps.find(s => !s.title.trim() || s.title.trim().length < 2 || !s.description.trim() || s.description.trim().length < 5)
    if (invalid) {
      toast.error('Pasos incompletos', { description: 'Cada paso debe tener título (mín. 2 chars) y descripción (mín. 5 chars).' })
      return
    }

    if (processEnabledDraft !== null) {
      const newCompanyInfo = {
        ...getWebsiteSettingsDefaults().company_info,
        ...settings?.company_info,
        processSectionEnabled: processEnabledDraft
      }
      const resultCi = await updateSetting('company_info', newCompanyInfo)
      if (!resultCi.success) {
        toast.error(resultCi.error || 'Error al guardar estado de la sección')
        return
      }
      setProcessEnabledDraft(null)
    }

    if (stepsDraft !== null) {
      const normalized = steps.map((s, i) => ({ ...s, number: i + 1 }))
      const result = await updateSetting('process_steps', normalized)
      if (result.success) {
        toast.success('Pasos del proceso actualizados', { icon: <Check className="h-4 w-4" /> })
        setStepsDraft(null)
      } else {
        toast.error(result.error || 'Error al guardar')
      }
    } else {
      toast.success('Configuración guardada correctamente', { icon: <Check className="h-4 w-4" /> })
    }
  }

  const handleAdd = () => {
    if (steps.length >= 8) {
      toast.error('Máximo 8 pasos')
      return
    }
    const newStep: ProcessStep = {
      id: `step-${Date.now()}`,
      number: steps.length + 1,
      title: '',
      description: ''
    }
    setStepsDraft([...(stepsDraft ?? steps), newStep])
  }

  const handleDelete = (id: string) => {
    if (steps.length <= 1) { toast.error('Debe haber al menos un paso'); return }
    setStepsDraft(steps.filter(s => s.id !== id).map((s, i) => ({ ...s, number: i + 1 })))
  }

  const handleMove = (index: number, dir: 'up' | 'down') => {
    const newIndex = dir === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= steps.length) return
    const updated = [...steps]
    const [moved] = updated.splice(index, 1)
    updated.splice(newIndex, 0, moved)
    setStepsDraft(updated.map((s, i) => ({ ...s, number: i + 1 })))
  }

  const handleUpdate = (id: string, field: 'title' | 'description', value: string) => {
    setStepsDraft(steps.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  if (isLoading && !stepsDraft && !settings) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }
  if (error && !stepsDraft && !settings) {
    return <div className="rounded-lg border p-6 text-center text-sm text-destructive">Error: {error}</div>
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            <Footprints className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Pasos del proceso</h3>
            <p className="text-xs text-muted-foreground">
              Cómo se muestra tu flujo de trabajo en el sitio público · {steps.length} paso{steps.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Label htmlFor="enable-process" className="text-sm font-medium">Mostrar sección</Label>
            <Switch
              id="enable-process"
              checked={processEnabled !== false}
              onCheckedChange={(checked) => setProcessEnabledDraft(checked)}
            />
          </div>
          <Button onClick={handleAdd} size="sm" className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Agregar paso</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <Card key={step.id}>
            <CardHeader className="border-b bg-muted/30 p-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {step.number}
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Paso {step.number}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMove(index, 'up')} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMove(index, 'down')} disabled={index === steps.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(step.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Título</Label>
                <Input
                  value={step.title}
                  onChange={e => handleUpdate(step.id, 'title', e.target.value)}
                  placeholder="Ej: Diagnóstico gratuito"
                  maxLength={60}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descripción</Label>
                <Textarea
                  value={step.description}
                  onChange={e => handleUpdate(step.id, 'description', e.target.value)}
                  placeholder="Ej: Evaluamos tu dispositivo sin costo"
                  rows={2}
                  maxLength={150}
                  className="resize-none text-sm"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 md:sticky md:bottom-6 md:justify-end">
        {hasChanges && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setStepsDraft(null); setProcessEnabledDraft(null); }}
            className="h-14 rounded-full px-6 shadow-2xl bg-background/80 backdrop-blur border md:h-12 md:rounded-xl md:px-4"
          >
            Descartar
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="lg" className="h-14 rounded-full px-8 shadow-2xl md:h-12 md:rounded-xl md:px-6">
          {isSaving ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span className="hidden md:inline">Guardando...</span></>
          ) : (
            <><Save className="mr-2 h-5 w-5" /><span className="hidden md:inline">Guardar pasos</span><span className="md:hidden">Guardar</span></>
          )}
        </Button>
      </div>
    </div>
  )
}
