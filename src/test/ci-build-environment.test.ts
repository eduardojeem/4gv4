import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflows = ['ci.yml', 'test.yml'].map((file) => ({
  file,
  source: readFileSync(resolve(process.cwd(), '.github/workflows', file), 'utf8'),
}))

const marketplacePage = readFileSync(resolve(process.cwd(), 'src/app/marketplace/page.tsx'), 'utf8')

describe('entorno de compilación de CI', () => {
  it.each(workflows)('$file permite prerenderizar páginas con el cliente público de Supabase', ({ source }) => {
    const buildJob = source.slice(source.indexOf('\n  build:'), source.indexOf('\n  accessibility:'))
    expect(buildJob).toContain('NEXT_PUBLIC_SUPABASE_URL: https://ci-placeholder.supabase.co')
    expect(buildJob).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder-anon-key')
  })

  it('el marketplace usa fallbacks públicos cuando la configuración privada no está disponible', () => {
    expect(marketplacePage).toContain('getPlatformBranding().catch(() => DEFAULT_PLATFORM_BRANDING)')
    expect(marketplacePage).toContain('getPlatformAnnouncements().catch(() => [])')
  })
})
