import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const ctx = vi.hoisted(() => ({ can: true, scope: 'u:org', currentScope: { current: 'u:org' }, fetch: vi.fn() }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ hasPermission: () => ctx.can }) }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => ({ scope: ctx.scope, currentScope: ctx.currentScope, organizationId: 'org' }) }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: 'branch' }) }))
vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => ({ effectiveModules: ['inventory'] }) }))
import { ProductVisibilityControl } from './ProductVisibilityControl'
const product = { id: 'p', organization_id: 'org', visibility: 'public', hide_price: false }
beforeEach(() => { ctx.can = true; ctx.scope = 'u:org'; ctx.currentScope.current = ctx.scope; ctx.fetch.mockReset(); vi.stubGlobal('fetch', ctx.fetch) })
afterEach(() => vi.unstubAllGlobals())
function choose(value: string) { fireEvent.change(screen.getByLabelText('Visibilidad en tienda'), { target: { value } }) }
it('guarda únicamente publicación y precio, con el ámbito de sucursal', async () => {
  const onSaved = vi.fn()
  ctx.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { id: 'p', visibility: 'public', hide_price: true } }) })
  render(<ProductVisibilityControl product={product} onSaved={onSaved} />)
  choose('public_no_price')
  expect(ctx.fetch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar visibilidad' }))
  await screen.findByText('Visibilidad guardada.')
  expect(JSON.parse(ctx.fetch.mock.calls[0][1].body)).toEqual({ id: 'p', visibility: 'public', hide_price: true })
  expect(ctx.fetch.mock.calls[0][1].headers['x-branch-id']).toBe('branch')
  expect(onSaved).toHaveBeenCalledWith('p', { visibility: 'public', hide_price: true })
})
it('no permite editar sin permiso', () => {
  ctx.can = false
  render(<ProductVisibilityControl product={product} onSaved={vi.fn()} />)
  expect(screen.getByLabelText('Visibilidad en tienda')).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Guardar visibilidad' })).toBeNull()
})
it('conserva el borrador y permite reintentar si falla', async () => {
  const onSaved = vi.fn()
  ctx.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'No se pudo guardar.' }) })
  render(<ProductVisibilityControl product={product} onSaved={onSaved} />)
  choose('hidden'); fireEvent.click(screen.getByRole('button', { name: 'Guardar visibilidad' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar.')
  expect(screen.getByLabelText('Visibilidad en tienda')).toHaveValue('hidden')
  expect(onSaved).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Guardar visibilidad' })).toBeEnabled()
})
it('no confirma resultados de otra empresa', async () => {
  let finish!: (value: unknown) => void
  ctx.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const onSaved = vi.fn()
  render(<ProductVisibilityControl product={product} onSaved={onSaved} />)
  choose('hidden'); fireEvent.click(screen.getByRole('button', { name: 'Guardar visibilidad' }))
  ctx.currentScope.current = 'u:otra'
  await act(async () => finish({ ok: true, json: async () => ({ success: true, data: { id: 'p', visibility: 'hidden' } }) }))
  expect(onSaved).not.toHaveBeenCalled()
  expect(screen.queryByText('Visibilidad guardada.')).toBeNull()
})
it('no afirma que ocultó el precio si el servidor omitió ese cambio', async () => {
  ctx.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, hide_price_skipped: true, data: { id: 'p', visibility: 'public', hide_price: false } }) })
  render(<ProductVisibilityControl product={product} onSaved={vi.fn()} />)
  choose('public_no_price'); fireEvent.click(screen.getByRole('button', { name: 'Guardar visibilidad' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/precio sigue visible/)
  expect(screen.queryByText('Visibilidad guardada.')).toBeNull()
})
