import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))

import { EMAIL_TEMPLATE_REGISTRY, normalizeMessageState } from '@/lib/superadmin/communications'
import { asuncionInputToIso, isoToAsuncionInput } from '@/lib/superadmin/asuncion-time'
import { validateGlobalNotification } from '@/lib/superadmin/notification-validation'

describe('normalizeMessageState', () => {
  it('marca los mensajes entrantes como recibidos, sin importar el estado', () => {
    expect(normalizeMessageState('sent', 'inbound')).toBe('received')
    expect(normalizeMessageState(null, 'inbound')).toBe('received')
  })

  it('reconoce los estados de error', () => {
    for (const status of ['failed', 'error', 'bounced', 'rejected', ' FAILED ']) {
      expect(normalizeMessageState(status, 'outbound')).toBe('failed')
    }
  })

  it('no cuenta como enviado lo que todavía está en cola', () => {
    for (const status of ['pending', 'queued', 'scheduled', 'sending', '', null]) {
      expect(normalizeMessageState(status, 'outbound')).toBe('pending')
    }
  })

  it('trata delivered/read/sent como enviados', () => {
    for (const status of ['sent', 'delivered', 'read']) {
      expect(normalizeMessageState(status, null)).toBe('sent')
    }
  })
})

describe('hora de Asunción para avisos programados', () => {
  it('interpreta el input como hora de Paraguay (UTC-3)', () => {
    expect(asuncionInputToIso('2026-11-10T09:30')).toBe('2026-11-10T12:30:00.000Z')
  })

  it('muestra una fecha guardada en hora de Paraguay', () => {
    expect(isoToAsuncionInput('2026-11-10T12:30:00.000Z')).toBe('2026-11-10T09:30')
    expect(isoToAsuncionInput('2026-12-31T02:15:00.000Z')).toBe('2026-12-30T23:15')
  })

  it('ida y vuelta sin perder minutos', () => {
    const value = '2027-03-01T00:05'
    expect(isoToAsuncionInput(asuncionInputToIso(value))).toBe(value)
  })

  it('rechaza valores vacíos o mal formados', () => {
    expect(asuncionInputToIso('')).toBeNull()
    expect(asuncionInputToIso('10/11/2026 09:30')).toBeNull()
    expect(isoToAsuncionInput(null)).toBe('')
    expect(isoToAsuncionInput('no-es-fecha')).toBe('')
  })
})

describe('validateGlobalNotification con fechas programadas', () => {
  const base = { title: 'Mantenimiento', body: 'Texto', type: 'info', target: 'all', status: 'scheduled' }
  const now = new Date('2026-11-07T15:00:00.000Z')

  it('rechaza una hora que ya pasó', () => {
    expect(validateGlobalNotification({ ...base, scheduled_at: '2026-11-07T14:00:00.000Z' }, now)).toEqual({
      data: null,
      error: 'La fecha de programacion ya paso. Elegi una hora futura o publicalo ahora.',
    })
  })

  it('tolera segundos de diferencia y acepta horas futuras', () => {
    expect(validateGlobalNotification({ ...base, scheduled_at: '2026-11-07T14:59:30.000Z' }, now).error).toBeNull()
    expect(validateGlobalNotification({ ...base, scheduled_at: '2026-11-08T12:00:00.000Z' }, now).data?.scheduled_at)
      .toBe('2026-11-08T12:00:00.000Z')
  })

  it('no exige fecha futura a borradores ni publicados', () => {
    expect(validateGlobalNotification({ ...base, status: 'draft', scheduled_at: '2020-01-01T00:00:00.000Z' }, now).error).toBeNull()
    expect(validateGlobalNotification({ ...base, status: 'sent', scheduled_at: '2020-01-01T00:00:00.000Z' }, now).error).toBeNull()
  })
})

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full) : /\.(ts|tsx)$/.test(name) ? [full] : []
  })
}

describe('catálogo de plantillas de email', () => {
  it('incluye cada render*Email del código (salvo el envoltorio común)', () => {
    const exported = new Set<string>()
    for (const file of listFiles(join(process.cwd(), 'src', 'lib'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/export (?:async )?function (render\w*Email)\b/g)) {
        exported.add(match[1])
      }
    }
    exported.delete('renderBrandedEmail')
    const listed = new Set(EMAIL_TEMPLATE_REGISTRY.map((t) => t.trigger.replace(/\(\)$/, '')))
    expect(exported.size).toBeGreaterThan(0)
    expect([...exported].filter((name) => !listed.has(name))).toEqual([])
  })
})
