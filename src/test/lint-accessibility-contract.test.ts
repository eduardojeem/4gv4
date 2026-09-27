import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

describe('lint and accessibility cleanup contracts', () => {
  it('counts mixed category bulk results with explicit control flow', () => {
    const source = read('src/app/dashboard/categories/page.tsx')

    expect(source).not.toMatch(/res\.success\s*\?\s*successCount\+\+\s*:\s*failCount\+\+/)
    expect(source.match(/if \(res\.success\) \{\s*successCount \+= 1\s*\} else \{\s*failCount \+= 1\s*\}/g)).toHaveLength(2)
  })

  it('puts aria-sort on table headers instead of their buttons', () => {
    const source = read('src/components/admin/inventory/inventory-management.tsx')

    expect(source).toMatch(/<th[^>]*aria-sort=/)
    expect(source).not.toMatch(/<button[^>]*aria-sort=/)
  })

  it('does not expose the decorative image icon as an unlabelled image', () => {
    const source = read('src/components/profile/avatar-upload-demo.tsx')

    expect(source).toContain('Image as ImageIcon')
    expect(source).toContain('<ImageIcon aria-hidden="true"')
  })
})
