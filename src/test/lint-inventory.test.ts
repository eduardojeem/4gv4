import { describe, expect, it } from 'vitest'

import { summarizeLintResults } from '../../scripts/lint-inventory.mjs'

describe('summarizeLintResults', () => {
  it('summarizes errors and warnings deterministically by rule and file', () => {
    expect(
      summarizeLintResults([
        {
          filePath: 'C:\\repo\\src\\z.ts',
          errorCount: 1,
          warningCount: 1,
          messages: [
            { ruleId: 'no-undef', severity: 2 },
            { ruleId: null, severity: 1 },
          ],
        },
        {
          filePath: 'C:\\repo\\src\\a.ts',
          errorCount: 0,
          warningCount: 2,
          messages: [
            { ruleId: '@typescript-eslint/no-unused-vars', severity: 1 },
            { ruleId: '@typescript-eslint/no-unused-vars', severity: 1 },
          ],
        },
      ], 'C:\\repo'),
    ).toEqual({
      errors: 1,
      warnings: 3,
      byRule: {
        '@typescript-eslint/no-unused-vars': 2,
        'no-undef': 1,
        unclassified: 1,
      },
      byFile: [
        { file: 'src/a.ts', errors: 0, warnings: 2 },
        { file: 'src/z.ts', errors: 1, warnings: 1 },
      ],
    })
  })
})
