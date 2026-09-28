import { describe, expect, it } from 'vitest'
import { toPublicStatusHistory } from './public-status-history'

describe('toPublicStatusHistory', () => {
  it('colapsa estados repetidos consecutivos y omite filas sin estado', () => {
    expect(toPublicStatusHistory([
      { new_status: 'recibido', created_at: '2026-09-01T10:00:00Z' },
      { new_status: 'diagnostico', created_at: '2026-09-02T10:00:00Z' },
      { new_status: 'diagnostico', created_at: '2026-09-02T10:00:01Z' },
      { new_status: 'diagnostico', created_at: '2026-09-02T10:00:02Z' },
      { new_status: null, created_at: '2026-09-02T11:00:00Z' },
      { new_status: 'listo', created_at: '2026-09-03T10:00:00Z' },
    ])).toEqual([
      { status: 'recibido', created_at: '2026-09-01T10:00:00Z' },
      { status: 'diagnostico', created_at: '2026-09-02T10:00:00Z' },
      { status: 'listo', created_at: '2026-09-03T10:00:00Z' },
    ])
  })

  it('no expone notas internas', () => {
    const [entry] = toPublicStatusHistory([{ new_status: 'reparacion', created_at: '2026-09-01T10:00:00Z' }])
    expect(entry).not.toHaveProperty('note')
    expect(entry).not.toHaveProperty('notes')
  })

  it('tolera null', () => {
    expect(toPublicStatusHistory(null)).toEqual([])
  })
})
