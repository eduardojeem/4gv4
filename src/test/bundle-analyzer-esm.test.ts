import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('bundle analyzer ESM entry point', () => {
  it('can be imported by Node without CommonJS globals or starting a build', () => {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e',
      "const m = await import('./scripts/analyze-bundle.js'); console.log(JSON.stringify({ analyze: typeof m.analyzeBundleSize, formats: m.CONFIG.reportFormats }))",
    ], { encoding: 'utf8', timeout: 10000 })
    expect(JSON.parse(output)).toEqual({ analyze: 'function', formats: ['json', 'html', 'markdown'] })
  })
})
