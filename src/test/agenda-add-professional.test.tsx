import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import { AddProfessionalDialog, suggestProfessionalColor, validateNewProfessional, PROFESSIONAL_PALETTE } from '@/components/dashboard/agenda/AddProfessionalDialog'
import type { AgendaService } from '@/lib/agenda/agenda-server'

const service = (id: string, name: string): AgendaService => ({ product_id: id, name, price: 1, hide_price: false, duration_minutes: 30, online: true, configured: true })
const services = [service('s1', 'Corte'), service('s2', 'Barba'), service('s3', 'Color')]
const draft = { name: 'Juan', specialty: '', color: '#6366f1', allServices: true, serviceIds: [], onlineVisible: true }
afterEach(() => vi.unstubAllGlobals())

const pintar = (props: Partial<Parameters<typeof AddProfessionalDialog>[0]> = {}) => {
  const onCreated = vi.fn()
  const onOpenChange = vi.fn()
  render(<AddProfessionalDialog open onOpenChange={onOpenChange} services={services} advanced existingNames={['Lucas']} usedColors={['#6366f1']} nextOrder={2} onCreated={onCreated} onCompleteProfile={vi.fn()} {...props} />)
  return { onCreated, onOpenChange }
}

describe('validación del alta', () => {
  it('pide nombre, avisa si se repite y exige servicios si no hace todos', () => {
    expect(validateNewProfessional({ ...draft, name: '  ' }, []).name).toBe('Poné el nombre.')
    expect(validateNewProfessional({ ...draft, name: 'lucas ' }, ['Lucas']).duplicate).toMatch(/Ya hay alguien/)
    expect(validateNewProfessional({ ...draft, allServices: false, serviceIds: [] }, []).services).toMatch(/al menos un servicio/)
    expect(validateNewProfessional(draft, [])).toEqual({ name: null, duplicate: null, services: null })
  })

  it('sugiere un color que nadie usa', () => {
    expect(suggestProfessionalColor(['#6366F1', '#ec4899'])).toBe('#f59e0b')
    expect(PROFESSIONAL_PALETTE).toContain(suggestProfessionalColor(PROFESSIONAL_PALETTE))
  })
})

describe('formulario de agregar profesional', () => {
  it('crea con especialidad, color libre, visibilidad y solo los servicios elegidos', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ professional: { id: 'p9', name: 'Juan', color: '#ec4899', is_active: true, sort_order: 2 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const { onCreated, onOpenChange } = pintar()

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Juan' } })
    fireEvent.change(screen.getByLabelText(/^Especialidad/), { target: { value: 'Barbero' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Hace todos los servicios' }))
    fireEvent.click(within(screen.getByText('Color').closest('label')!).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('switch', { name: 'Se puede reservar online' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    const created = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(created).toEqual({ name: 'Juan', color: '#ec4899', sort_order: 2, specialty: 'Barbero', online_visible: false })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ id: 'p9', service_ids: ['s1', 's2'] })
    expect(onCreated.mock.calls[0][0].service_ids).toEqual(['s1', 's2'])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('con «Hace todos» no guarda servicios aparte, y «agregar otro» deja el formulario abierto y vacío', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ professional: { id: 'p9', name: 'Ana', color: '#ec4899', is_active: true, sort_order: 2 } }) })
    vi.stubGlobal('fetch', fetchMock)
    const { onCreated, onOpenChange } = pintar()
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y agregar otro' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('')
  })

  it('con foto: la sube apenas se crea y la guarda en el profesional', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:foto')
    URL.revokeObjectURL = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ professional: { id: 'p9abcdef-0000', name: 'Ana', color: '#f59e0b', is_active: true, sort_order: 2 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, url: 'https://cdn/ana.webp' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ professional: {} }) })
    vi.stubGlobal('fetch', fetchMock)
    const { onCreated } = pintar()
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
    const file = new File(['x'], 'ana.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [file] } })
    expect(screen.getByRole('button', { name: 'Cambiar la foto' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/website/promotion-image')
    expect((fetchMock.mock.calls[1][1].body as FormData).get('slideId')).toBe('equipo-p9abcdef')
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ id: 'p9abcdef-0000', photo_url: 'https://cdn/ana.webp' })
    expect(onCreated.mock.calls[0][0].photo_url).toBe('https://cdn/ana.webp')
  })

  it('rechaza fotos de otro formato o de más de 5 MB antes de subir', () => {
    pintar()
    fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } })
    expect(screen.getByText('La foto tiene que ser JPG, PNG o WebP.')).toBeInTheDocument()
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [big] } })
    expect(screen.getByText('La foto pesa más de 5 MB.')).toBeInTheDocument()
  })

  it('no deja enviar sin servicios elegidos y muestra el error del servidor en el formulario', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Llegaste al límite de tu plan' }) }))
    pintar()
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Hace todos los servicios' }))
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled()
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(await screen.findByText('Llegaste al límite de tu plan')).toBeInTheDocument()
  })
})
