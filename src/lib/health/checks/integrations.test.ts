import { describe, expect, it } from 'vitest'
import { buildScheduledTaskHealth, buildServiceHealthEntries, loadWebhookEvents } from '@/lib/health/checks/integrations'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HealthCheckResult, HealthStatus } from '@/lib/health/types'

function check(id: string, status: HealthStatus, summary = status): HealthCheckResult {
  return {
    id,
    category: 'deployment',
    name: id,
    status,
    severity: 'medium',
    summary,
    description: 'Descripción',
    method: 'Fuente comprobable',
    findings: [],
    checkedAt: '2026-10-02T20:00:00.000Z',
    durationMs: 125,
  }
}

describe('buildServiceHealthEntries', () => {
  it('keeps configured-but-unverified services unknown and missing services not configured', () => {
    const services = buildServiceHealthEntries(
      [
        check('supabase.database', 'healthy', 'Base accesible'),
        check('security.turnstile', 'error', 'Configuración incompleta'),
        check('cloudflare.edge', 'healthy', 'Proxy verificado'),
        check('payments.pagopar', 'not_configured', 'No implementado'),
      ],
      {
        supabase: 'configured',
        upstash: 'missing',
        telegram: 'configured',
        turnstile: 'partial',
        cloudflare: 'configured',
        pagopar: 'missing',
      },
    )

    expect(services.find((service) => service.id === 'supabase')).toMatchObject({ status: 'healthy' })
    expect(services.find((service) => service.id === 'upstash')).toMatchObject({ status: 'not_configured' })
    expect(services.find((service) => service.id === 'telegram')).toMatchObject({ status: 'unknown' })
    expect(services.find((service) => service.id === 'turnstile')).toMatchObject({ status: 'error', configured: 'partial' })
    expect(services.find((service) => service.id === 'cloudflare')).toMatchObject({ status: 'healthy' })
    expect(services.find((service) => service.id === 'pagopar')).toMatchObject({ status: 'not_configured' })
  })

  it('never includes environment values in its serialized output', () => {
    const marker = 'secret-value-that-must-not-leak'
    const original = process.env.UPSTASH_REDIS_REST_TOKEN
    process.env.UPSTASH_REDIS_REST_TOKEN = marker
    const serialized = JSON.stringify(buildServiceHealthEntries([], { upstash: 'configured' }))
    if (original === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
    else process.env.UPSTASH_REDIS_REST_TOKEN = original

    expect(serialized).not.toContain(marker)
    expect(serialized).toContain('UPSTASH_REDIS_REST_URL')
  })

  it('recognizes Cloudflare from verified proxy headers without requiring optional API credentials', () => {
    const services = buildServiceHealthEntries(
      [check('cloudflare.edge', 'healthy', 'Tráfico pasando por Cloudflare')],
      { cloudflare: 'missing' },
    )

    expect(services.find((service) => service.id === 'cloudflare')).toMatchObject({
      configured: 'configured',
      status: 'healthy',
    })
  })

  it('does not call configuration-only checks healthy and exposes verification context', () => {
    const configuredOnly = buildServiceHealthEntries(
      [
        { ...check('security.rate_limiting', 'healthy'), metadata: { latencyMs: 7 } },
        check('security.turnstile', 'healthy'),
        check('payments.pagopar', 'healthy'),
      ],
      { upstash: 'configured', turnstile: 'configured', pagopar: 'configured' },
    )

    for (const id of ['upstash', 'turnstile', 'pagopar']) {
      expect(configuredOnly.find((service) => service.id === id)).toMatchObject({
        status: 'unknown',
        unavailableReason: expect.stringContaining('no verificado'),
      })
    }
    expect(configuredOnly.find((service) => service.id === 'upstash')).toMatchObject({ latencyMs: 7 })
  })
})

describe('loadWebhookEvents', () => {
  it('degrades a rejected provider query instead of aborting the whole diagnostic', async () => {
    const query = {
      select: () => query,
      order: () => query,
      limit: () => Promise.reject(new Error('network unavailable')),
    }
    const admin = { from: () => query } as unknown as SupabaseClient

    await expect(loadWebhookEvents(admin)).resolves.toMatchObject({
      available: false,
      reason: expect.stringContaining('network unavailable'),
    })
  })
})

describe('buildScheduledTaskHealth', () => {
  it('keeps missing execution timestamps null and derives only available evidence', () => {
    const tasks = buildScheduledTaskHealth(
      [check('integrity.subscription_lifecycle', 'healthy', 'Sin vencimientos pendientes')],
      { graceNotificationsConfigured: true },
    )

    expect(tasks).toEqual([
      expect.objectContaining({
        id: 'subscription-lifecycle',
        status: 'healthy',
        lastRunAt: null,
        nextRunAt: null,
        durationMs: 125,
      }),
      expect.objectContaining({
        id: 'plan-grace-notifications',
        status: 'unknown',
        lastRunAt: null,
        nextRunAt: null,
      }),
    ])
  })

  it('reports a stale lifecycle effect as an error and an absent cron secret as not configured', () => {
    const tasks = buildScheduledTaskHealth(
      [check('integrity.subscription_lifecycle', 'error', '2 vencimientos sin procesar')],
      { graceNotificationsConfigured: false },
    )

    expect(tasks[0]).toMatchObject({ status: 'error', summary: '2 vencimientos sin procesar' })
    expect(tasks[1]).toMatchObject({ status: 'not_configured' })
  })
})
