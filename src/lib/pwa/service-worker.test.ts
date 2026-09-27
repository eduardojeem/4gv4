import { afterEach, describe, expect, it, vi } from 'vitest'

import { isServiceWorkerDisabled } from './service-worker'

const ORIGINAL = process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER

describe('interruptor de apagado del service worker', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER = ORIGINAL
    vi.unstubAllGlobals()
  })

  it('queda activo por defecto', () => {
    process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER = ''
    expect(isServiceWorkerDisabled()).toBe(false)

    delete process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER
    expect(isServiceWorkerDisabled()).toBe(false)
  })

  it('se apaga con 1 o true', () => {
    process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER = '1'
    expect(isServiceWorkerDisabled()).toBe(true)

    process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER = 'true'
    expect(isServiceWorkerDisabled()).toBe(true)
  })

  it('no se apaga con un valor cualquiera', () => {
    // Un typo en la variable no debe dejar la PWA a medio andar sin avisar.
    for (const value of ['0', 'false', 'si', 'yes', 'off']) {
      process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER = value
      expect(isServiceWorkerDisabled()).toBe(false)
    }
  })
})

describe('unregisterServiceWorkers', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('desregistra y limpia las caches', async () => {
    const unregister = vi.fn().mockResolvedValue(true)
    const deleteCache = vi.fn().mockResolvedValue(true)

    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
    })
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(['static-v2']), delete: deleteCache })

    const { unregisterServiceWorkers } = await import('./service-worker')
    await unregisterServiceWorkers()

    expect(unregister).toHaveBeenCalled()
    // Sin borrar la cache, el contenido guardado sobrevive al desregistro.
    expect(deleteCache).toHaveBeenCalledWith('static-v2')
  })

  it('no rompe la pagina si el navegador falla', async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: vi.fn().mockRejectedValue(new Error('denegado')) },
    })

    const { unregisterServiceWorkers } = await import('./service-worker')
    await expect(unregisterServiceWorkers()).resolves.toBeUndefined()
  })
})
