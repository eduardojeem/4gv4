import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPAIRS_GUIDE_VERSION } from './repairs-guide'

describe('repairs guide PDF', () => {
  it('publishes the same guide version used by the interactive help', () => {
    const manifestPath = resolve(process.cwd(), 'public/guides/repairs-guide-manifest.json')
    expect(existsSync(manifestPath)).toBe(true)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version: string; file: string }

    expect(manifest.version).toBe(REPAIRS_GUIDE_VERSION)
    expect(manifest.file).toBe('/guides/guia-reparaciones-v1.pdf')
    expect(existsSync(resolve(process.cwd(), 'public', manifest.file.slice(1)))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'output/pdf/guia-reparaciones-v1.pdf'))).toBe(true)
  })
})
