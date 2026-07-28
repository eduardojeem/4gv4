import { describe, expect, it } from 'vitest'
import {
  PROCESS_STEP_TEMPLATES,
  createProcessStepsFromTemplate,
  getConfiguredProcessFlows,
  getPublicProcessFlows,
  getProcessSaveOrder,
} from '@/lib/website/process-steps'
import {
  ProcessFlowsSchema,
  ProcessStepsSchema,
} from '@/lib/validation/website-settings'

describe('process step templates', () => {
  it('provides templates for the supported business flows', () => {
    expect(PROCESS_STEP_TEMPLATES.map((template) => template.id)).toEqual([
      'repairs',
      'purchase',
      'payments',
      'personalized',
    ])
  })

  it.each(PROCESS_STEP_TEMPLATES)('builds a valid $label template', (template) => {
    const steps = createProcessStepsFromTemplate(template.id)

    expect(steps.map((step) => step.number)).toEqual(
      steps.map((_, index) => index + 1)
    )
    expect(steps.length).toBeGreaterThanOrEqual(1)
    expect(steps.length).toBeLessThanOrEqual(8)
    expect(ProcessStepsSchema.safeParse(steps).success).toBe(true)
  })

  it('hides before saving content when the section is disabled', () => {
    expect(
      getProcessSaveOrder({
        hasStepsChanges: true,
        visibilityDraft: false,
      })
    ).toEqual(['visibility', 'steps'])
  })

  it('saves content before publishing an enabled section', () => {
    expect(
      getProcessSaveOrder({
        hasStepsChanges: true,
        visibilityDraft: true,
      })
    ).toEqual(['steps', 'visibility'])
  })

  it('converts legacy steps into one compatible process', () => {
    const legacySteps = createProcessStepsFromTemplate('repairs')
    const flows = getConfiguredProcessFlows([], legacySteps)

    expect(flows).toHaveLength(1)
    expect(flows[0].title).toBe('Proceso principal')
    expect(flows[0].steps).toEqual(legacySteps)
  })

  it('supports several independently visible processes', () => {
    const flows = [
      {
        id: 'repairs',
        title: 'Reparaciones',
        description: 'Servicio técnico',
        active: true,
        steps: createProcessStepsFromTemplate('repairs'),
      },
      {
        id: 'purchase',
        title: 'Compra y entrega',
        description: 'Pedidos de productos',
        active: false,
        steps: createProcessStepsFromTemplate('purchase'),
      },
    ]

    expect(ProcessFlowsSchema.safeParse(flows).success).toBe(true)
    expect(getPublicProcessFlows(flows, []).map((flow) => flow.id)).toEqual([
      'repairs',
    ])
  })
})
