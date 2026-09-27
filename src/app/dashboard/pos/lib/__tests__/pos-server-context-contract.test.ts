import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('contexto sensible del cliente POS', () => {
  it('se carga mediante APIs tenant-aware y no consulta tablas desde el navegador', () => {
    const context = readFileSync(resolve(process.cwd(), 'src/app/dashboard/pos/contexts/POSCustomerContext.tsx'), 'utf8')
    const repairs = readFileSync(resolve(process.cwd(), 'src/app/dashboard/pos/hooks/usePOSRepairs.ts'), 'utf8')
    expect(context).toContain('/metrics`')
    expect(context).not.toContain("supabase.from('sales')")
    expect(repairs).toContain('/repairs?limit=20')
    expect(repairs).not.toContain(".from('repairs')")
    expect(repairs).not.toContain("'postgres_changes'")
  })
})
