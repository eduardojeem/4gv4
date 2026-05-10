'use client'

import { useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Save, ArrowUp, ArrowDown, Plus, Trash2, Footprints, Check } from 'lucide-react'
import { ProcessStep } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

export function ProcessStepsEditor() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [stepsDraft, setStepsDraft] = useState<ProcessStep[] | null>(null)
  const steps = stepsDraft ?? settings?.process_steps ?? getWebsiteSettingsDefaults().process_steps
  const hasChanges = stepsDraft !== null

  const handleSave = async () => {
    const invalid = steps.find(s => !s.title.trim() || s.title.trim().length < 2 || !s.description.trim() || s.description.trim().length < 5)
    if (invalid) {
      toast.error('Pasos incompletos', { description: 'Cada paso debe tener título (mín. 2 chars) y descripción (mín. 5 chars).' })
      return
    }
    const normalized = steps.map((s, i) => ({ ...s, number: i + 1 }))
    const result = await updateSetting('process_steps', normalized)
    if (result.success) {
      toast.success('Pasos del proceso actualizados', { icon: <Check className="h-4 w-4" /> })
      setStepsDraft(null)
    } else {
      toast.error(result.error || 'Error al guardar')
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
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }
  if (error && !stepsDraft && !settings) {
    return <div className="rounded-lg border p-6 text-center text-sm text-red-600">Error: {error}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 p-6">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Footprints className="h-5 w-5 text-violet-600" />
            Pasos del Proceso
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cómo se muestra el flujo de trabajo en el sitio público ({steps.length} pasos)
          </p>
        </div>
        <Button
          onClick={handleAdd}
          size="sm"
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Paso
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <Card key={step.id} className="border-none shadow-lg">
            <CardHeader className="bg-gradient-to-r from-violet-50/60 to-indigo-50/60 dark:from-violet-950/10 dark:to-indigo-950/10 p-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 text-sm font-bold shrink-0">
                    {step.number}
                  </div>
                  <span className="text-sm font-medium text-gray-500">Paso {step.number}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMove(index, 'up')} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMove(index, 'down')} disabled={index === steps.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(step.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Título</Label>
                <Input
                  value={step.title}
                  onChange={e => handleUpdate(step.id, 'title', e.target.value)}
                  placeholder="Ej: Diagnóstico Gratuito"
                  maxLength={60}
                  className="h-10 border-gray-100 bg-gray-50/50 focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Descripción</Label>
                <Textarea
                  value={step.description}
                  onChange={e => handleUpdate(step.id, 'description', e.target.value)}
                  placeholder="Ej: Evaluamos tu dispositivo sin costo"
                  rows={2}
                  maxLength={150}
                  className="resize-none border-gray-100 bg-gray-50/50 focus:bg-white text-sm"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="fixed bottom-6 right-6 md:sticky md:bottom-6 md:flex md:justify-end z-50">
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          size="lg"
          className="shadow-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 transition-all duration-300 rounded-full md:rounded-xl px-8 md:px-6 h-14 md:h-12"
        >
          {isSaving ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span className="hidden md:inline">Guardando...</span></>
          ) : (
            <><Save className="mr-2 h-5 w-5" /><span className="hidden md:inline">Guardar Pasos</span><span className="md:hidden">Guardar</span></>
          )}
        </Button>
      </div>
    </div>
  )
}
