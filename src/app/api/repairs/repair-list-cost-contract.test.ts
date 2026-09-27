import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('repair list cost contract', () => {
  it('reloads parts and the current cost revision used by the detail modal', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'repairs', 'route.ts'), 'utf8')
    const variants = source.slice(source.indexOf('const REPAIR_SELECT_VARIANTS'), source.indexOf('const FULL_REPAIR_SELECT'))

    expect(variants).toContain('parts:repair_parts(*)')
    expect(variants).toContain('currentCostRevision:repair_cost_revisions!repairs_current_cost_revision_fk(*)')
  })

  it('reloads the current technical check after saving it', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'repairs', 'route.ts'), 'utf8')
    const qualityCheckJoins = source.match(/qualityCheck:repair_quality_checks!repairs_current_quality_check_fk/g) ?? []

    expect(qualityCheckJoins).toHaveLength(4)
    expect(source).toContain('checkedBy:profiles!created_by(id, full_name)')
  })
})
