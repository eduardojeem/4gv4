import { beforeEach, describe, expect, it, vi } from 'vitest'
const rendered = vi.hoisted(() => ({ text: [] as string[], tables: [] as Array<{ body: string[][] }> }))
vi.mock('jspdf', () => ({ default: class {
 lastAutoTable = { finalY: 80 }
 setFontSize() {}
 setTextColor() {}
 text(value: string) { rendered.text.push(value) }
 addPage() {}
 save() {}
} }))
vi.mock('jspdf-autotable', () => ({ default: (_doc: unknown, options: { body: string[][] }) => { rendered.tables.push(options) } }))
import { generateAnalyticsPDF } from './analytics-pdf'
import { formatCurrency } from '@/lib/currency'
beforeEach(() => { rendered.text = []; rendered.tables = [] })
describe('repair report matches the dashboard cohort', () => {
 it('includes the selected period, delivered revenue and an unavailable promise result', () => {
  generateAnalyticsPDF({ periodLabel: '01/05/2026 – 16/10/2026', metrics: { totalRepairs: 3, completedRepairs: 2, totalRevenue: 100, onTimeRate: null } })
  expect(rendered.text).toContain('Ingresadas: 01/05/2026 – 16/10/2026')
  expect(rendered.tables[0].body).toContainEqual(['Ingresos por entregadas del grupo', formatCurrency(100)])
  expect(rendered.tables[0].body).toContainEqual(['Entregas a Tiempo', 'No disponible (sin fecha prometida)'])
 })
 it('preserves a measured zero instead of treating it as unavailable', () => {
  generateAnalyticsPDF({ metrics: { totalRevenue: 0, onTimeRate: 0 } })
  expect(rendered.tables[0].body).toContainEqual(['Entregas a Tiempo', '0%'])
  expect(rendered.tables[0].body).toContainEqual(['Ingresos por entregadas del grupo', formatCurrency(0)])
 })
})
