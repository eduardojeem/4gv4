import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readPreviousRun, summarizeHistoryRuns } from '@/lib/health/history'
import type { HealthHistoryEntry, HealthSeverity, HealthStatus } from '@/lib/health/types'

function row(runId: string, checkId: string, checkedAt: string, status: HealthStatus = 'healthy') {
  return {
    id: 1,
    run_id: runId,
    checked_at: checkedAt,
    check_id: checkId,
    category: 'security',
    status,
    severity: status === 'error' ? 'high' : 'info',
    message: checkId,
    duration_ms: 10,
  }
}

function entry(
  runId: string,
  checkId: string,
  checkedAt: string,
  status: HealthStatus,
  durationMs: number | null = 10,
): HealthHistoryEntry {
  return {
    id: 1,
    runId,
    checkedAt,
    checkId,
    category: 'security',
    status,
    severity: (status === 'error' ? 'high' : 'info') as HealthSeverity,
    message: checkId,
    durationMs,
  }
}

function queryResult(data: unknown, error: unknown = null) {
  return { data, error }
}

function adminFor(firstResult: unknown, secondResult?: unknown) {
  const first = {
    select: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(firstResult),
  }
  const second = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(secondResult),
  }
  const from = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)

  return { admin: { from } as unknown as SupabaseClient, first, second, from }
}

describe('readPreviousRun', () => {
  it('selects the preceding run and fetches all of its rows', async () => {
    const selected = row('run-b', 'latest-row', '2026-10-02T11:00:00.000Z')
    const previousRows = [
      row('run-b', 'check-2', '2026-10-02T10:59:59.000Z', 'error'),
      row('run-b', 'check-1', '2026-10-02T10:59:58.000Z'),
    ]
    const { admin, first, second } = adminFor(queryResult(selected), queryResult(previousRows))

    const result = await readPreviousRun(admin, 'run-current')

    expect(first.neq).toHaveBeenCalledWith('run_id', 'run-current')
    expect(second.eq).toHaveBeenCalledWith('run_id', 'run-b')
    expect(result).toMatchObject({ available: true, runId: 'run-b', checkedAt: selected.checked_at })
    expect(result.entries.map((item) => item.checkId)).toEqual(['check-2', 'check-1'])
  })

  it('does not exclude a run when there is no current run id', async () => {
    const selected = row('run-latest', 'check', '2026-10-02T11:00:00.000Z')
    const { admin, first } = adminFor(queryResult(selected), queryResult([selected]))

    await readPreviousRun(admin)

    expect(first.neq).not.toHaveBeenCalled()
  })

  it.each([
    [{ code: '42P01', message: 'relation does not exist' }, 'Historial no disponible'],
    [{ code: 'XX000', message: 'connection failed' }, 'connection failed'],
  ])('degrades safely when the lookup fails', async (error, expectedReason) => {
    const { admin } = adminFor(queryResult(null, error))

    await expect(readPreviousRun(admin, 'run-current')).resolves.toMatchObject({
      available: false,
      reason: expect.stringContaining(expectedReason),
      entries: [],
    })
  })

  it('degrades safely when fetching the selected run fails', async () => {
    const selected = row('run-b', 'check', '2026-10-02T11:00:00.000Z')
    const { admin } = adminFor(queryResult(selected), queryResult(null, { message: 'rows failed' }))

    await expect(readPreviousRun(admin, 'run-current')).resolves.toMatchObject({
      available: false,
      reason: 'rows failed',
      entries: [],
    })
  })
})

describe('summarizeHistoryRuns', () => {
  it('groups interleaved rows with status counts and safe timing totals', () => {
    const summaries = summarizeHistoryRuns([
      entry('run-a', 'a-2', '2026-10-02T10:00:02.000Z', 'error', 25),
      entry('run-b', 'b-1', '2026-10-02T11:00:00.000Z', 'healthy', null),
      entry('run-a', 'a-1', '2026-10-02T10:00:00.000Z', 'warning', 15),
    ])

    expect(summaries).toEqual([
      expect.objectContaining({
        runId: 'run-b',
        startedAt: '2026-10-02T11:00:00.000Z',
        finishedAt: '2026-10-02T11:00:00.000Z',
        durationMs: 0,
        checkCount: 1,
        counts: expect.objectContaining({ healthy: 1, error: 0 }),
      }),
      expect.objectContaining({
        runId: 'run-a',
        startedAt: '2026-10-02T10:00:00.000Z',
        finishedAt: '2026-10-02T10:00:02.000Z',
        durationMs: 40,
        checkCount: 2,
        counts: expect.objectContaining({ warning: 1, error: 1 }),
      }),
    ])
  })
})
