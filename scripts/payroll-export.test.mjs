import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import test from 'node:test'
import { transform } from 'esbuild'

const source = await readFile(new URL('../src/lib/finances/payroll-export.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { payrollExportStatus, payrollCsvCell } = await import('data:text/javascript,' + encodeURIComponent(code))
const entry = { outstanding_amount: 0, paid_amount: 0 }

test('draft and voided snapshots never appear paid', () => {
  assert.match(payrollExportStatus({ status: 'draft' }, entry), /Borrador/)
  assert.equal(payrollExportStatus({ status: 'voided' }, entry), 'Anulada')
})
test('approved snapshot distinguishes unpaid, partial and paid', () => {
  assert.equal(payrollExportStatus({ status: 'approved' }, entry), 'Pagada')
  assert.match(payrollExportStatus({ status: 'approved' }, { paid_amount: 0, outstanding_amount: 100 }), /pendiente/)
  assert.equal(payrollExportStatus({ status: 'approved' }, { paid_amount: 50, outstanding_amount: 50 }), 'Pago parcial')
})
test('CSV escapes quotes, newlines and formula prefixes', () => {
  assert.equal(payrollCsvCell('Ana "A"'), '"Ana ""A"""')
  for (const text of ['=1+1', ' +CMD', '@SUM(A1)', '\t=1']) assert.ok(payrollCsvCell(text).startsWith('"\''))
  assert.equal(payrollCsvCell('Ana\nMaria'), '"Ana\nMaria"')
})
