import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import test from 'node:test'
import { transform } from 'esbuild'

const { code } = await transform(await readFile(new URL('../src/lib/finance/reconciliation-guidance.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' })
const { reconciliationGuidance } = await import('data:text/javascript,' + encodeURIComponent(code))

test('guides each discrepancy without suggesting duplicate money movements', () => {
  assert.match(reconciliationGuidance('MISSING_DIRECT_COST'), /histórico/)
  assert.match(reconciliationGuidance('MISSING_CASH_TIMING'), /No registres otro cobro/)
  assert.match(reconciliationGuidance('MISSING_BRANCH'), /No lo asignes/)
  assert.match(reconciliationGuidance('MISSING_EMPLOYEE'), /segundo pago/)
  assert.match(reconciliationGuidance('unknown'), /administrador/)
})
test('summary never describes period flow as available money', async () => {
  const summary = await readFile(new URL('../src/components/admin/finances/FinanceSummary.tsx', import.meta.url), 'utf8')
  assert.ok(!summary.includes('Dinero real disponible tras compensar'))
  assert.ok(summary.includes('reconciliationGuidance(warning.code)'))
  assert.ok(summary.includes('Datos pendientes de conciliación'))
})
