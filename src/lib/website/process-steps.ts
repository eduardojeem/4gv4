import type { ProcessFlow, ProcessStep } from '@/types/website-settings'

export type ProcessStepTemplateId =
  | 'repairs'
  | 'purchase'
  | 'payments'
  | 'personalized'

export type ProcessSaveTarget = 'steps' | 'visibility'

interface ProcessStepTemplate {
  id: ProcessStepTemplateId
  label: string
  description: string
  steps: Array<Pick<ProcessStep, 'title' | 'description'>>
}

export const PROCESS_STEP_TEMPLATES: ProcessStepTemplate[] = [
  {
    id: 'repairs',
    label: 'Reparaciones',
    description: 'Diagnóstico, presupuesto, reparación y entrega.',
    steps: [
      { title: 'Diagnóstico', description: 'Revisamos el equipo e identificamos el problema.' },
      { title: 'Presupuesto', description: 'Te informamos el costo y el tiempo estimado.' },
      { title: 'Reparación', description: 'Realizamos el trabajo después de tu aprobación.' },
      { title: 'Entrega', description: 'Probamos el equipo y coordinamos la entrega.' },
    ],
  },
  {
    id: 'purchase',
    label: 'Compra y entrega',
    description: 'Selección, confirmación, preparación y recepción.',
    steps: [
      { title: 'Elegí tus productos', description: 'Explorá el catálogo y seleccioná lo que necesitás.' },
      { title: 'Confirmamos el pedido', description: 'Verificamos disponibilidad, pago y forma de entrega.' },
      { title: 'Preparamos la compra', description: 'Acondicionamos y revisamos los productos.' },
      { title: 'Retiro o delivery', description: 'Retirá en el local o recibí el pedido en tu zona.' },
    ],
  },
  {
    id: 'payments',
    label: 'Pagos y giros',
    description: 'Consulta, verificación, operación y comprobante.',
    steps: [
      { title: 'Consultá disponibilidad', description: 'Confirmamos el operador, requisitos y comisión.' },
      { title: 'Presentá los datos', description: 'Revisamos la información necesaria para la operación.' },
      { title: 'Realizamos la operación', description: 'Procesamos el pago, giro, retiro o depósito.' },
      { title: 'Recibí tu comprobante', description: 'Verificamos el resultado y entregamos la constancia.' },
    ],
  },
  {
    id: 'personalized',
    label: 'Atención personalizada',
    description: 'Consulta, propuesta y seguimiento.',
    steps: [
      { title: 'Contanos qué necesitás', description: 'Escuchamos tu consulta y reunimos la información clave.' },
      { title: 'Te proponemos una solución', description: 'Explicamos alternativas, costos y próximos pasos.' },
      { title: 'Acompañamos el resultado', description: 'Damos seguimiento hasta completar la atención.' },
    ],
  },
]

export function createProcessStepsFromTemplate(
  templateId: ProcessStepTemplateId
): ProcessStep[] {
  const template = PROCESS_STEP_TEMPLATES.find((item) => item.id === templateId)
  if (!template) return []

  return template.steps.map((step, index) => ({
    id: `${template.id}-step-${index + 1}`,
    number: index + 1,
    ...step,
  }))
}

export function getProcessSaveOrder({
  hasStepsChanges,
  visibilityDraft,
}: {
  hasStepsChanges: boolean
  visibilityDraft: boolean | null
}): ProcessSaveTarget[] {
  const targets: ProcessSaveTarget[] = []

  if (visibilityDraft === false) targets.push('visibility')
  if (hasStepsChanges) targets.push('steps')
  if (visibilityDraft === true) targets.push('visibility')

  return targets
}

export function getConfiguredProcessFlows(
  processFlows: ProcessFlow[] | null | undefined,
  legacySteps: ProcessStep[] | null | undefined
): ProcessFlow[] {
  if (Array.isArray(processFlows) && processFlows.length > 0) {
    return processFlows
  }

  if (!Array.isArray(legacySteps) || legacySteps.length === 0) {
    return []
  }

  return [
    {
      id: 'legacy-process',
      title: 'Proceso principal',
      description: 'Conoce cómo trabajamos paso a paso.',
      active: true,
      steps: legacySteps,
    },
  ]
}

export function getPublicProcessFlows(
  processFlows: ProcessFlow[] | null | undefined,
  legacySteps: ProcessStep[] | null | undefined
): ProcessFlow[] {
  return getConfiguredProcessFlows(processFlows, legacySteps).filter(
    (flow) => flow.active !== false
  )
}
