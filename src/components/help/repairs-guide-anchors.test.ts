import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import guide from './repairs-guide-content.json'

const componentFiles = [
  'src/components/dashboard/repairs/RepairHeader.tsx',
  'src/components/dashboard/repairs/RepairFilters.tsx',
  'src/components/dashboard/repairs/RepairDetailDialog.tsx',
  'src/components/dashboard/repairs/RepairPaymentDialog.tsx',
  'src/components/dashboard/repairs/RepairDeliveryDialog.tsx',
  'src/components/dashboard/repairs/RepairCostCalculator.tsx',
  'src/components/dashboard/repair-form-dialog-v2.tsx',
]

describe('repairs help anchor contract', () => {
  it('declares every guide anchor exactly once in the repairs UI', () => {
    const source = componentFiles
      .map(file => readFileSync(resolve(process.cwd(), file), 'utf8'))
      .join('\n')
    const anchors = guide.tracks.flatMap(track => track.tasks.flatMap(task => task.steps.map(step => step.anchorId)))
    const invalid = anchors.filter(anchor => source.split(`data-help-id="${anchor}"`).length - 1 !== 1)

    expect(invalid, `Missing or duplicated repair help anchors: ${invalid.join(', ')}`).toEqual([])
  })
})
