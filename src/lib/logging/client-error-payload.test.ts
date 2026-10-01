import { describe, expect, it } from 'vitest'
import { parseClientErrorPayload } from '@/lib/logging/client-error-payload'

describe('parseClientErrorPayload', () => {
  it('acepta campos de diagnóstico acotados y descarta identidad enviada por el cliente', () => {
    const result = parseClientErrorPayload({
      name: 'TypeError',
      message: 'falló el render',
      source: 'boundary',
      severity: 'fatal',
      userId: 'usuario-falso',
      organizationId: 'organizacion-falsa',
    })

    expect(result).toEqual({
      name: 'TypeError',
      message: 'falló el render',
      source: 'boundary',
      severity: 'fatal',
      stack: null,
      digest: null,
      url: null,
      metadata: {},
    })
    expect(result).not.toHaveProperty('userId')
    expect(result).not.toHaveProperty('organizationId')
  })

  it('rechaza mensajes vacíos, demasiado grandes o metadata no serializable', () => {
    expect(() => parseClientErrorPayload({ name: 'Error', message: '' })).toThrow()
    expect(() => parseClientErrorPayload({ name: 'Error', message: 'x'.repeat(2001) })).toThrow()
    expect(() => parseClientErrorPayload({
      name: 'Error',
      message: 'x',
      metadata: { payload: 'x'.repeat(5000) },
    })).toThrow()
  })
})
