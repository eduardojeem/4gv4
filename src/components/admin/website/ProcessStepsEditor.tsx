'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Footprints,
  Landmark,
  Loader2,
  MessagesSquare,
  Plus,
  RotateCcw,
  Save,
  ShoppingBag,
  Trash2,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionHowItWorks } from '@/components/admin/website/SectionHowItWorks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ProcessFlow } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import {
  createProcessStepsFromTemplate,
  getConfiguredProcessFlows,
  PROCESS_STEP_TEMPLATES,
  type ProcessStepTemplateId,
} from '@/lib/website/process-steps'

const TEMPLATE_ICONS = {
  repairs: Wrench,
  purchase: ShoppingBag,
  payments: Landmark,
  personalized: MessagesSquare,
} satisfies Record<ProcessStepTemplateId, typeof Wrench>

let entityIdSequence = 0

function createEntityId(prefix: 'process' | 'step'): string {
  entityIdSequence += 1
  return `${prefix}-${Date.now()}-${entityIdSequence}`
}

function normalizeFlows(flows: ProcessFlow[]): ProcessFlow[] {
  return flows.map((flow) => ({
    ...flow,
    title: flow.title.trim(),
    description: flow.description?.trim() || '',
    steps: flow.steps.map((step, index) => ({
      ...step,
      number: index + 1,
      title: step.title.trim(),
      description: step.description.trim(),
    })),
  }))
}

export function ProcessStepsEditor() {
  const {
    settings,
    isLoading,
    error,
    isSaving,
    updateSettings,
  } = useAdminWebsiteSettings()
  const [flowsDraft, setFlowsDraft] = useState<ProcessFlow[] | null>(null)
  const [processEnabledDraft, setProcessEnabledDraft] = useState<boolean | null>(null)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [pendingTemplateId, setPendingTemplateId] =
    useState<ProcessStepTemplateId | null>(null)
  const [pendingDeleteFlowId, setPendingDeleteFlowId] = useState<string | null>(null)

  const defaults = getWebsiteSettingsDefaults()
  const configuredFlows = getConfiguredProcessFlows(
    settings?.process_flows,
    settings?.process_steps ?? defaults.process_steps
  )
  const flows = flowsDraft ?? configuredFlows
  const selectedFlow =
    flows.find((flow) => flow.id === selectedFlowId) ?? flows[0]
  const processEnabled =
    processEnabledDraft ??
    settings?.company_info?.processSectionEnabled ??
    defaults.company_info.processSectionEnabled
  const activeFlowsCount = flows.filter((flow) => flow.active !== false).length
  const hasChanges = flowsDraft !== null || processEnabledDraft !== null

  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  const setFlows = (nextFlows: ProcessFlow[]) => {
    setFlowsDraft(nextFlows)
  }

  const updateFlow = (
    flowId: string,
    updater: (flow: ProcessFlow) => ProcessFlow
  ) => {
    setFlows(
      flows.map((flow) => (flow.id === flowId ? updater(flow) : flow))
    )
  }

  const handleSave = async () => {
    const invalidFlow = flows.find(
      (flow) =>
        flow.title.trim().length < 2 ||
        flow.steps.some(
          (step) =>
            step.title.trim().length < 2 ||
            step.description.trim().length < 5
        )
    )
    if (invalidFlow) {
      toast.error('Hay procesos incompletos', {
        description: 'Cada proceso y cada paso necesitan textos claros.',
      })
      setSelectedFlowId(invalidFlow.id)
      return
    }

    if (processEnabled && activeFlowsCount === 0) {
      toast.error('Activa al menos un proceso', {
        description: 'La sección pública necesita un proceso visible.',
      })
      return
    }

    const result = await updateSettings({
      ...(flowsDraft !== null ? { process_flows: normalizeFlows(flows) } : {}),
      ...(processEnabledDraft !== null
        ? {
            company_info: {
              ...defaults.company_info,
              ...settings?.company_info,
              processSectionEnabled: processEnabledDraft,
            },
          }
        : {}),
    })

    if (!result.success) {
      toast.error(result.error || 'No se pudieron guardar los procesos')
      return
    }

    setFlowsDraft(null)
    setProcessEnabledDraft(null)
    toast.success('Procesos actualizados', {
      icon: <Check className="h-4 w-4" />,
    })
  }

  const handleAddProcess = () => {
    if (flows.length >= 6) {
      toast.error('Puedes crear hasta 6 procesos')
      return
    }

    const processId = createEntityId('process')
    const newFlow: ProcessFlow = {
      id: processId,
      title: `Proceso ${flows.length + 1}`,
      description: '',
      active: true,
      steps: [
        {
          id: createEntityId('step'),
          number: 1,
          title: '',
          description: '',
        },
      ],
    }
    setFlows([...flows, newFlow])
    setSelectedFlowId(processId)
  }

  const handleDeleteProcess = () => {
    if (!pendingDeleteFlowId || flows.length <= 1) return

    const nextFlows = flows.filter((flow) => flow.id !== pendingDeleteFlowId)
    setFlows(nextFlows)
    setSelectedFlowId(nextFlows[0]?.id ?? null)
    setPendingDeleteFlowId(null)
  }

  const handleAddStep = () => {
    if (!selectedFlow) return
    if (selectedFlow.steps.length >= 8) {
      toast.error('Puedes mostrar hasta 8 pasos por proceso')
      return
    }

    updateFlow(selectedFlow.id, (flow) => ({
      ...flow,
      steps: [
        ...flow.steps,
        {
          id: createEntityId('step'),
          number: flow.steps.length + 1,
          title: '',
          description: '',
        },
      ],
    }))
  }

  const handleDeleteStep = (stepId: string) => {
    if (!selectedFlow) return
    if (selectedFlow.steps.length <= 1) {
      toast.error('Debe quedar al menos un paso en cada proceso')
      return
    }

    updateFlow(selectedFlow.id, (flow) => ({
      ...flow,
      steps: flow.steps
        .filter((step) => step.id !== stepId)
        .map((step, index) => ({ ...step, number: index + 1 })),
    }))
  }

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (!selectedFlow) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= selectedFlow.steps.length) return

    const updated = [...selectedFlow.steps]
    const [moved] = updated.splice(index, 1)
    updated.splice(newIndex, 0, moved)
    updateFlow(selectedFlow.id, (flow) => ({
      ...flow,
      steps: updated.map((step, stepIndex) => ({
        ...step,
        number: stepIndex + 1,
      })),
    }))
  }

  const handleUpdateStep = (
    stepId: string,
    field: 'title' | 'description',
    value: string
  ) => {
    if (!selectedFlow) return
    updateFlow(selectedFlow.id, (flow) => ({
      ...flow,
      steps: flow.steps.map((step) =>
        step.id === stepId ? { ...step, [field]: value } : step
      ),
    }))
  }

  const handleApplyTemplate = (templateId: ProcessStepTemplateId) => {
    if (!selectedFlow) return
    const template = PROCESS_STEP_TEMPLATES.find((item) => item.id === templateId)
    if (!template) return

    updateFlow(selectedFlow.id, (flow) => ({
      ...flow,
      title: template.label,
      description: template.description,
      steps: createProcessStepsFromTemplate(templateId),
    }))
    setPendingTemplateId(null)
    toast.success(`Plantilla "${template.label}" aplicada`, {
      description: 'Solo reemplazó el proceso seleccionado. Guarda para publicarlo.',
    })
  }

  const handleDiscard = () => {
    setFlowsDraft(null)
    setProcessEnabledDraft(null)
    setSelectedFlowId(null)
  }

  if (isLoading && !settings) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-destructive">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Footprints className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Procesos públicos</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Publica recorridos diferentes para reparaciones, compras, pagos u
            otros tipos de atención.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleAddProcess}
          disabled={flows.length >= 6}
          className="h-10 shrink-0 rounded-md"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Nuevo proceso
        </Button>
      </div>

      <section className="rounded-lg border p-4 sm:p-5" aria-labelledby="process-status-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                processEnabled
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {processEnabled
                ? <Eye className="h-4 w-4" aria-hidden="true" />
                : <EyeOff className="h-4 w-4" aria-hidden="true" />}
            </div>
            <div>
              <h3 id="process-status-title" className="text-sm font-semibold">
                {processEnabled ? 'Sección visible' : 'Sección oculta'}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {processEnabled
                  ? `${activeFlowsCount} de ${flows.length} procesos se mostrarán al público.`
                  : 'Los procesos se conservan, pero no aparecen en el inicio.'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 px-3 py-2 sm:min-w-[220px]">
            <div>
              <Label htmlFor="enable-process" className="text-sm font-medium">
                Mostrar sección
              </Label>
              <p className="text-[11px] text-muted-foreground">Se aplica al guardar.</p>
            </div>
            <Switch
              id="enable-process"
              checked={processEnabled !== false}
              onCheckedChange={setProcessEnabledDraft}
            />
          </div>
        </div>
        <SectionHowItWorks
          sectionName="los procesos públicos"
          steps={[
            {
              title: 'Crea uno o varios procesos',
              description: 'Cada proceso tiene nombre, descripción y sus propios pasos.',
            },
            {
              title: 'Decide cuáles mostrar',
              description: 'Puedes ocultar un proceso sin eliminar su configuración.',
            },
            {
              title: 'Guarda y publica',
              description: 'El cliente elegirá el proceso desde pestañas en la página de inicio.',
            },
          ]}
        />
      </section>

      <section className="rounded-lg border p-4" aria-labelledby="process-selector-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 id="process-selector-title" className="text-sm font-semibold">
              Tus procesos
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Selecciona uno para editarlo. Puedes crear hasta 6.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{flows.length}/6</span>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Procesos configurados">
          {flows.map((flow) => {
            const selected = flow.id === selectedFlow?.id
            return (
              <button
                key={flow.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSelectedFlowId(flow.id)}
                className={`min-w-[150px] rounded-md border px-3 py-2 text-left transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'bg-background hover:bg-muted/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      flow.active !== false ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate text-xs font-semibold">{flow.title}</span>
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {flow.steps.length} paso{flow.steps.length === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {selectedFlow && (
        <>
          <section className="rounded-lg border p-4" aria-labelledby="selected-process-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="selected-process-title" className="text-sm font-semibold">
                  Información del proceso
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Este nombre será la pestaña que verá el cliente.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={flows.length <= 1}
                onClick={() => setPendingDeleteFlowId(selectedFlow.id)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-destructive"
                aria-label={`Eliminar proceso ${selectedFlow.title}`}
                title="Eliminar proceso"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="process-title">Nombre del proceso</Label>
                <Input
                  id="process-title"
                  value={selectedFlow.title}
                  onChange={(event) =>
                    updateFlow(selectedFlow.id, (flow) => ({
                      ...flow,
                      title: event.target.value,
                    }))
                  }
                  maxLength={80}
                  className="h-10 rounded-md"
                  placeholder="Ej: Reparaciones"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="process-description">Descripción breve</Label>
                <Input
                  id="process-description"
                  value={selectedFlow.description || ''}
                  onChange={(event) =>
                    updateFlow(selectedFlow.id, (flow) => ({
                      ...flow,
                      description: event.target.value,
                    }))
                  }
                  maxLength={200}
                  className="h-10 rounded-md"
                  placeholder="Ej: Así cuidamos tu equipo de principio a fin."
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
              <div>
                <Label htmlFor={`flow-active-${selectedFlow.id}`} className="text-sm font-medium">
                  Mostrar este proceso
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Puedes ocultarlo sin perder sus pasos.
                </p>
              </div>
              <Switch
                id={`flow-active-${selectedFlow.id}`}
                checked={selectedFlow.active !== false}
                onCheckedChange={(checked) =>
                  updateFlow(selectedFlow.id, (flow) => ({
                    ...flow,
                    active: checked,
                  }))
                }
              />
            </div>
          </section>

          <section className="rounded-lg border p-4" aria-labelledby="process-templates-title">
            <h3 id="process-templates-title" className="text-sm font-semibold">
              Aplicar plantilla al proceso seleccionado
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Reemplaza solamente los pasos de “{selectedFlow.title}”.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {PROCESS_STEP_TEMPLATES.map((template) => {
                const TemplateIcon = TEMPLATE_ICONS[template.id]
                return (
                  <Button
                    key={template.id}
                    type="button"
                    variant="outline"
                    onClick={() => setPendingTemplateId(template.id)}
                    className="h-auto min-h-[72px] justify-start gap-3 rounded-md px-3 py-3 text-left"
                  >
                    <TemplateIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{template.label}</span>
                      <span className="mt-1 block whitespace-normal text-[11px] font-normal leading-snug text-muted-foreground">
                        {template.description}
                      </span>
                    </span>
                  </Button>
                )
              })}
            </div>
          </section>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Pasos de {selectedFlow.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Entre 1 y 8 pasos por proceso.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddStep}
              disabled={selectedFlow.steps.length >= 8}
              className="h-9 rounded-md"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Agregar paso
            </Button>
          </div>

          <div className="space-y-3">
            {selectedFlow.steps.map((step, index) => (
              <section
                key={step.id}
                className="rounded-lg border bg-background"
                aria-labelledby={`process-step-${step.id}`}
              >
                <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <h4 id={`process-step-${step.id}`} className="truncate text-sm font-medium">
                      {step.title.trim() || `Paso ${index + 1}`}
                    </h4>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      onClick={() => handleMoveStep(index, 'up')}
                      disabled={index === 0}
                      aria-label={`Subir paso ${index + 1}`}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      onClick={() => handleMoveStep(index, 'down')}
                      disabled={index === selectedFlow.steps.length - 1}
                      aria-label={`Bajar paso ${index + 1}`}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteStep(step.id)}
                      disabled={selectedFlow.steps.length <= 1}
                      aria-label={`Eliminar paso ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`step-title-${step.id}`}>Título</Label>
                    <Input
                      id={`step-title-${step.id}`}
                      value={step.title}
                      onChange={(event) =>
                        handleUpdateStep(step.id, 'title', event.target.value)
                      }
                      placeholder="Ej: Confirmamos tu pedido"
                      maxLength={100}
                      className="h-10 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`step-description-${step.id}`}>Descripción</Label>
                    <Textarea
                      id={`step-description-${step.id}`}
                      value={step.description}
                      onChange={(event) =>
                        handleUpdateStep(step.id, 'description', event.target.value)
                      }
                      placeholder="Explica brevemente qué sucede en esta etapa."
                      rows={2}
                      maxLength={300}
                      className="min-h-[76px] resize-y rounded-md text-sm"
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <AlertDialog
        open={pendingTemplateId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTemplateId(null)
        }}
      >
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar este proceso?</AlertDialogTitle>
            <AlertDialogDescription>
              La plantilla cambiará el nombre, la descripción y todos los pasos
              del proceso seleccionado. Los demás procesos no se modificarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-md"
              onClick={() => {
                if (pendingTemplateId) handleApplyTemplate(pendingTemplateId)
              }}
            >
              Aplicar plantilla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteFlowId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteFlowId(null)
        }}
      >
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este proceso?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también todos sus pasos cuando guardes los cambios.
              Esta acción todavía puede descartarse desde la barra inferior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteProcess}
            >
              Eliminar proceso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="sticky bottom-0 z-30 -mx-2 border-t bg-background/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-4 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`h-2 w-2 rounded-full ${
                hasChanges ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              aria-hidden="true"
            />
            <span>
              {hasChanges
                ? 'Hay cambios en los procesos sin guardar'
                : 'Los procesos están guardados'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscard}
              disabled={isSaving || !hasChanges}
              className="h-10 rounded-md"
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Descartar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="h-10 rounded-md"
            >
              {isSaving
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
