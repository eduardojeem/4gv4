import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CashCountModal } from '@/app/dashboard/pos/components/CashCountModal'
import CashRegisterPage from '@/app/dashboard/pos/caja/page'

vi.mock('@/hooks/use-shared-settings', () => ({ useSharedSettings: () => ({ settings: { currency: 'PYG' } }) }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { id: 'actor', role: 'cashier' } }) }))
vi.mock('@/app/dashboard/pos/contexts/CashRegisterContext', () => ({ useCashRegisterContext: () => ({
  registers: [], activeRegisterId: '', setActiveRegisterId: vi.fn(),
  getCurrentRegister: { isOpen: true, balance: 100000, movements: [] },
  userPermissions: {}, openRegister: vi.fn(), closeRegister: vi.fn(), addMovement: vi.fn(), performCashCount: vi.fn(),
}) }))
vi.mock('@/app/dashboard/pos/caja/components/CashRegisterHeader', () => ({ CashRegisterHeader: () => null }))
vi.mock('@/app/dashboard/pos/caja/components/CashRegisterOverview', () => ({ CashRegisterOverview: ({ onCloseRegister }: { onCloseRegister: () => void }) => <button onClick={onCloseRegister}>Cerrar caja</button> }))
vi.mock('@/app/dashboard/pos/caja/components/CashRegisterReport', () => ({ CashRegisterReport: () => null }))
vi.mock('@/app/dashboard/pos/caja/components/CashRegisterHistory', () => ({ CashRegisterHistory: () => null }))
vi.mock('@/app/dashboard/pos/caja/components/CashRegisterAudit', () => ({ CashRegisterAudit: () => null }))
vi.mock('@/app/dashboard/pos/caja/components/ElectronicPaymentsPanel', () => ({ ElectronicPaymentsPanel: () => null }))
vi.mock('@/app/dashboard/pos/components/OpenCashRegisterDialog', () => ({ OpenCashRegisterDialog: () => null }))
vi.mock('@/app/dashboard/pos/components/POSCashMovementDialog', () => ({ POSCashMovementDialog: () => null }))

afterEach(cleanup)

describe('confirmaciones de caja en móvil', () => {
  it('exige un conteo explícito para cerrar, pero permite cero contado', () => {
    render(<CashRegisterPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar caja' }))
    expect(screen.getByRole('button', { name: 'Confirmar Cierre' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Monto real contado en efectivo físico'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Confirmar Cierre' })).toBeEnabled()
  })

  it('espera el guardado del arqueo antes de cerrar e impide repetirlo', async () => {
    let resolveSave!: () => void
    const onConfirm = vi.fn(() => new Promise<void>(resolve => { resolveSave = resolve }))
    const onClose = vi.fn()
    render(<CashCountModal isOpen onConfirm={onConfirm} onClose={onClose} systemBalance={0} />)
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Arqueo/ }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Guardando/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Guardando/ }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    resolveSave()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('enfoca el diálogo sin abrir un input y permite contar con controles identificados', async () => {
    const onConfirm = vi.fn()
    render(<CashCountModal isOpen onConfirm={onConfirm} onClose={vi.fn()} systemBalance={100000} />)
    expect(screen.getByRole('dialog')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar un billete de 100.000' }))
    expect(screen.getByLabelText('100.000')).toHaveValue('1')
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Arqueo/ }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ total: 100000 }), undefined))
  })

  it('conserva el conteo y muestra el error cuando falla el guardado', async () => {
    const onClose = vi.fn()
    render(<CashCountModal isOpen onConfirm={() => Promise.reject(new Error('Sin conexión'))} onClose={onClose} systemBalance={100000} />)
    fireEvent.change(screen.getAllByPlaceholderText('0')[0], { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Arqueo/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getAllByPlaceholderText('0')[0]).toHaveValue('2')
    expect(onClose).not.toHaveBeenCalled()
  })
})
