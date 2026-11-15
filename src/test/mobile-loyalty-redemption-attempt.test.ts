import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  pendingRedemption,
  submitRedemption,
  redemptionStorageKey,
  type RedemptionStorage,
} from '../../mobile/src/lib/loyalty-redemption-attempt'
let values: Map<string, string>, storage: RedemptionStorage
const context = { userId: 'user-one', organizationId: 'org-one' },
  request = { customerId: 'customer-one', customerName: 'Ana', points: 10 }
beforeEach(() => {
  values = new Map()
  storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value)
    },
    removeItem: async (key) => {
      values.delete(key)
    },
  }
})
describe('canje móvil idempotente', () => {
  it('conserva la referencia después de un resultado incierto y la reutiliza al reabrir', async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Conexión interrumpida'))
      .mockResolvedValueOnce({ id: 'receipt' })
    await expect(submitRedemption(context, request, { storage, submit })).rejects.toThrow(
      'Conexión',
    )
    const saved = await pendingRedemption(context, storage)
    expect(saved?.points).toBe(10)
    await submitRedemption(context, request, { storage, submit })
    expect(submit.mock.calls[0][2]).toBe(submit.mock.calls[1][2])
    expect(await pendingRedemption(context, storage)).toBeNull()
  })
  it('no cambia de cliente o monto mientras hay un canje incierto', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Sin respuesta'))
    await expect(submitRedemption(context, request, { storage, submit })).rejects.toThrow()
    await expect(
      submitRedemption(context, { ...request, points: 11 }, { storage, submit }),
    ).rejects.toThrow('pendiente')
    expect(submit).toHaveBeenCalledTimes(1)
  })
  it('un rechazo definitivo no deja bloqueado el siguiente intento', async () => {
    const submit = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Saldo insuficiente'), { status: 400 }))
    await expect(submitRedemption(context, request, { storage, submit })).rejects.toThrow()
    expect(await pendingRedemption(context, storage)).toBeNull()
  })
  it('aísla los intentos por usuario y organización', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Sin respuesta'))
    await expect(submitRedemption(context, request, { storage, submit })).rejects.toThrow()
    expect(await pendingRedemption({ ...context, userId: 'other' }, storage)).toBeNull()
    expect(await pendingRedemption({ ...context, organizationId: 'other' }, storage)).toBeNull()
  })
  it('no llama al servidor cuando no se pudo persistir el intento', async () => {
    const submit = vi.fn()
    storage.setItem = async () => {
      throw new Error('Almacenamiento no disponible')
    }
    await expect(submitRedemption(context, request, { storage, submit })).rejects.toThrow(
      'Almacenamiento',
    )
    expect(submit).not.toHaveBeenCalled()
  })
  it('impide enviar simultáneamente dos canjes', async () => {
    let finish!: () => void
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const first = submitRedemption(context, request, { storage, submit })
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    await expect(submitRedemption(context, request, { storage, submit })).rejects.toThrow(
      'en curso',
    )
    finish()
    await first
  })
  it('rechaza almacenamiento corrupto en lugar de reemplazar la referencia', async () => {
    values.set(redemptionStorageKey(context), JSON.stringify({ points: 10 }))
    await expect(pendingRedemption(context, storage)).rejects.toThrow('historial')
  })
})

it('no envía el canje si cambió de sesión mientras guardaba la referencia', async () => {
  let current = true
  const submit = vi.fn()
  storage.setItem = async (key, value) => {
    values.set(key, value)
    current = false
  }
  await expect(
    submitRedemption(context, request, { storage, submit, isCurrent: () => current }),
  ).rejects.toThrow('sesión')
  expect(submit).not.toHaveBeenCalled()
  expect(await pendingRedemption(context, storage)).not.toBeNull()
})

it('no informa como fallido un canje confirmado si falla limpiar la referencia local',async()=>{
 const submit=vi.fn().mockResolvedValue({id:'confirmed-credit'})
 storage.removeItem=async()=>{throw new Error('No se pudo limpiar el almacenamiento')}
 await expect(submitRedemption(context,request,{storage,submit})).resolves.toEqual({id:'confirmed-credit'})
 expect(await pendingRedemption(context,storage)).not.toBeNull()
})