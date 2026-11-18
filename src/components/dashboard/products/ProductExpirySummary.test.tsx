import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const ctx = vi.hoisted(() => ({ scope: 'user:org', currentScope: { current: 'user:org' }, fetch: vi.fn() }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => ({ scope: ctx.scope, currentScope: ctx.currentScope, organizationId: 'org' }) }))
import { ProductExpirySummary } from './ProductExpirySummary'
const batch = { id: 'b', variant_id: null, lot_code: 'L-25', expires_on: '2026-12-01', remaining: 3, status: 'week', discarded_at: null }
beforeEach(() => { ctx.scope = 'user:org'; ctx.currentScope.current = ctx.scope; vi.stubGlobal('fetch', ctx.fetch); ctx.fetch.mockReset() })
afterEach(() => vi.unstubAllGlobals())
it('muestra fecha, lote y advertencia sin presentar estimaciones como stock exacto', async () => {
  ctx.fetch.mockResolvedValue({ ok: true, json: async () => ({ available: true, batches: [batch] }) })
  render(<ProductExpirySummary productId="p" expected />)
  expect(await screen.findByText('L-25')).toBeInTheDocument()
  expect(screen.getByText('01/12/2026')).toBeInTheDocument()
  expect(screen.getByText('Vence en 7 días')).toBeInTheDocument()
  expect(screen.getByText(/3 unidades estimadas/)).toBeInTheDocument()
})
it('un error permite reintentar y nunca se muestra como ausencia de vencimientos', async () => {
  ctx.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) }).mockResolvedValueOnce({ ok: true, json: async () => ({ available: true, batches: [] }) })
  render(<ProductExpirySummary productId="p" expected />)
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar vencimientos' }))
  expect(await screen.findByText(/No hay lotes registrados/)).toBeInTheDocument()
})
it('descarta una respuesta tardía de otro producto', async () => {
  let finish!: (value: unknown) => void
  ctx.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ ok: true, json: async () => ({ available: true, batches: [] }) })
  const { rerender } = render(<ProductExpirySummary productId="a" expected />)
  rerender(<ProductExpirySummary productId="b" expected />)
  await screen.findByText(/No hay lotes registrados/)
  await act(async () => finish({ ok: true, json: async () => ({ available: true, batches: [batch] }) }))
  expect(screen.queryByText('L-25')).toBeNull()
})
it('filtra variantes, agotados y descartados sin ocultar lotes sin asignación', async () => {
  ctx.fetch.mockResolvedValue({ ok: true, json: async () => ({ available: true, batches: [batch, { ...batch, id: 'x', variant_id: 'otra', lot_code: 'OTRA' }, { ...batch, id: 'd', discarded_at: '2026-01-01', lot_code: 'DESCARTADO' }] }) })
  render(<ProductExpirySummary productId="p" variantId="elegida" expected />)
  await screen.findByText('L-25')
  expect(screen.queryByText('OTRA')).toBeNull()
  expect(screen.queryByText('DESCARTADO')).toBeNull()
  expect(screen.getByText(/sin variante asignada/i)).toBeInTheDocument()
})
it('distingue función no disponible de fecha no registrada', async () => {
  ctx.fetch.mockResolvedValue({ ok: true, json: async () => ({ available: false, batches: [] }) })
  render(<ProductExpirySummary productId="p" expected />)
  expect(await screen.findByText(/no están disponibles en la base/)).toBeInTheDocument()
  expect(screen.queryByText(/No hay lotes registrados/)).toBeNull()
})
it('rechaza fechas inválidas en lugar de mostrarlas como válidas', async () => {
  ctx.fetch.mockResolvedValue({ ok: true, json: async () => ({ available: true, batches: [{ ...batch, expires_on: '2026-02-31' }] }) })
  render(<ProductExpirySummary productId="p" expected />)
  expect(await screen.findByText(/información de vencimientos está incompleta/)).toBeInTheDocument()
})
it('no conserva lotes visibles al cambiar de empresa', async () => {
  ctx.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ available: true, batches: [batch] }) }).mockImplementationOnce(() => new Promise(() => {}))
  const { rerender } = render(<ProductExpirySummary productId="p" expected />)
  await screen.findByText('L-25')
  ctx.scope = 'user:otra'; ctx.currentScope.current = ctx.scope
  rerender(<ProductExpirySummary productId="p" expected />)
  expect(screen.queryByText('L-25')).toBeNull()
  expect(screen.getByText(/Consultando vencimientos/)).toBeInTheDocument()
})
it('actualiza los lotes sin conservar resultados anteriores', async () => {
  ctx.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ available: true, batches: [batch] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ available: true, batches: [{ ...batch, lot_code: 'LOTE-NUEVO' }] }) })
  render(<ProductExpirySummary productId="p" expected />)
  await screen.findByText('L-25')
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar vencimientos' }))
  expect(await screen.findByText('LOTE-NUEVO')).toBeInTheDocument()
  expect(screen.queryByText('L-25')).toBeNull()
})
