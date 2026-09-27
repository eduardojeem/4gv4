import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('configuracion de rendimiento en desarrollo', () => {
  it('evita la cache persistente de Turbopack que bloquea este proyecto al compactarse', () => {
    const config = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8')

    expect(config).toContain('turbopackFileSystemCacheForDev: false')
    expect(config).toContain('agentRules: false')
  })

  it('no genera trazas SWR detalladas salvo que se habiliten de forma explicita', () => {
    const provider = fs.readFileSync(path.join(root, 'src/providers/swr-provider.tsx'), 'utf8')

    expect(provider).toContain("process.env.NEXT_PUBLIC_DEBUG_SWR === 'true'")
    expect(provider).not.toContain("process.env.NODE_ENV === 'development' ? [")
  })

  it('no carga plugins de produccion mientras inicia next dev', () => {
    const config = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8')

    expect(config).toContain("import { createRequire } from 'node:module'")
    expect(config).toContain("process.env.NODE_ENV === 'production'\n  ? loadModule('@ducanh2912/next-pwa')")
    expect(config).toContain("process.env.ANALYZE === 'true'\n  ? loadModule('@next/bundle-analyzer')")
  })
})
