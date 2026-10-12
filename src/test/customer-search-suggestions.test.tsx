import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ImprovedSearchBar } from '@/components/dashboard/customers/ImprovedSearchBar'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear() })

it('keeps same-name customers distinct and lets the user confirm the entire search', async () => {
  const select = vi.fn()
  const search = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: [
    { id: 'one', name: 'José Pérez', phone: '0981111111', ruc: '1111111', customer_code: 'CLI-1' },
    { id: 'two', name: 'José Pérez', phone: '0982222222', ruc: '2222222', customer_code: 'CLI-2' },
  ] }))))
  function Harness() {
    const [value, setValue] = useState('')
    return <ImprovedSearchBar value={value} onChange={setValue} onSearch={search} onCustomerSelect={select} />
  }
  render(<Harness />)
  const input = screen.getByPlaceholderText(/Buscar clientes/)
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'jose' } })
  await screen.findByText('0981111111')
  expect(screen.getByText('0982222222')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Clientes encontrados' })).toHaveClass('overflow-y-scroll')
  expect(search).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
  expect(search).toHaveBeenCalledWith('jose')
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(search).toHaveBeenCalledTimes(2)
  fireEvent.focus(input)
  await waitFor(() => expect(screen.getByText('0982222222')).toBeInTheDocument())
  fireEvent.click(screen.getByText('0982222222'))
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'two' }))
})

it('keeps many same-name results in a bounded scroll region with keyboard navigation', async () => {
  const select = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data:
    Array.from({ length: 20 }, (_, index) => ({ id: `customer-${index}`, name: 'Ana Pérez', phone: `098${String(index).padStart(7, '0')}` })),
  }))))
  function Harness() {
    const [value, setValue] = useState('')
    return <ImprovedSearchBar value={value} onChange={setValue} onCustomerSelect={select} />
  }
  render(<Harness />)
  const input = screen.getByRole('textbox', { name: 'Buscar clientes' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'ana' } })
  const region = await screen.findByRole('region', { name: 'Clientes encontrados' })
  expect(region).toHaveClass('overflow-y-scroll', 'overscroll-contain', 'touch-pan-y')
  expect(region).toHaveStyle({ maxHeight: 'min(24rem, 50dvh)', scrollbarGutter: 'stable' })
  for (let index = 0; index < 20; index++) fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'customer-19' }))
})

it('keeps the result list open while focus moves into it', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: [
    { id: 'one', name: 'Ana Pérez', phone: '0981111111' },
    { id: 'two', name: 'Ana Pérez', phone: '0982222222' },
    { id: 'three', name: 'Ana Pérez', phone: '0983333333' },
  ] }))))
  function Harness() {
    const [value, setValue] = useState('')
    return <ImprovedSearchBar value={value} onChange={setValue} />
  }
  render(<Harness />)
  const input = screen.getByRole('textbox', { name: 'Buscar clientes' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'ana' } })
  const region = await screen.findByRole('region', { name: 'Clientes encontrados' })
  const last = region.querySelector('[data-search-index="2"]')!
  fireEvent.blur(input, { relatedTarget: last })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)) })
  expect(region).toBeInTheDocument()
  expect(screen.getByText('0983333333')).toBeInTheDocument()
})
