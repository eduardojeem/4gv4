import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { clearDashboardSummaryCache, getCachedDashboardSummary, synchronizeDashboardSummaryScope } from './summary-cache'
beforeEach(() => { vi.useFakeTimers(); clearDashboardSummaryCache() })
afterEach(() => vi.useRealTimers())
it('expires after 30 seconds and force bypasses a fresh value', async () => {
 const load = vi.fn().mockResolvedValue({ n: 1 })
 await getCachedDashboardSummary('user:org:branch:period:role', load)
 await getCachedDashboardSummary('user:org:branch:period:role', load)
 expect(load).toHaveBeenCalledTimes(1)
 await getCachedDashboardSummary('user:org:branch:period:role', load, { force: true })
 expect(load).toHaveBeenCalledTimes(2)
 vi.advanceTimersByTime(30001)
 await getCachedDashboardSummary('user:org:branch:period:role', load)
 expect(load).toHaveBeenCalledTimes(3)
})
it('isolates keys and payload objects', async () => {
 const original = { rows: [{ n: 1 }] }; const load = vi.fn().mockResolvedValue(original)
 const first = await getCachedDashboardSummary('user:one', load)
 first.rows[0].n = 3; original.rows[0].n = 4
 expect(await getCachedDashboardSummary('user:one', load)).toEqual({ rows: [{ n: 1 }] })
 await getCachedDashboardSummary('user:two', load)
 expect(load).toHaveBeenCalledTimes(2)
})
it('does not cache errors, aborted loads or loads pending across scope clear', async () => {
 const bad = vi.fn().mockRejectedValue(new Error('bad'))
 await expect(getCachedDashboardSummary('bad', bad)).rejects.toThrow('bad')
 await expect(getCachedDashboardSummary('bad', bad)).rejects.toThrow('bad')
 expect(bad).toHaveBeenCalledTimes(2)
 const controller = new AbortController(); let resolve!: (value: number) => void
 const pending = getCachedDashboardSummary('pending', () => new Promise<number>(done => { resolve = done }), { signal: controller.signal })
 controller.abort(); resolve(1)
 await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
 const fresh = vi.fn().mockResolvedValue(2)
 expect(await getCachedDashboardSummary('pending', fresh)).toBe(2)
 let finish!: (value: number) => void
 const stale = getCachedDashboardSummary('scope', () => new Promise<number>(done => { finish = done }))
 clearDashboardSummaryCache(); finish(3); await stale
 expect(await getCachedDashboardSummary('scope', fresh)).toBe(2)
})
it('clears organization changes and bounds entries to 25', async () => {
 const load = vi.fn().mockResolvedValue(1)
 for (let i=0;i<26;i++) await getCachedDashboardSummary(String(i),load)
 await getCachedDashboardSummary('0',load)
 expect(load).toHaveBeenCalledTimes(27)
 window.dispatchEvent(new CustomEvent('organization:changed'))
 await getCachedDashboardSummary('0',load)
 expect(load).toHaveBeenCalledTimes(28)
})

it('invalidates on principal scope changes and logout without losing same-scope reuse', async () => {
 synchronizeDashboardSummaryScope('user:org')
 const load=vi.fn().mockResolvedValue(1)
 await getCachedDashboardSummary('key',load)
 synchronizeDashboardSummaryScope('user:org')
 await getCachedDashboardSummary('key',load)
 expect(load).toHaveBeenCalledTimes(1)
 synchronizeDashboardSummaryScope(':')
 await getCachedDashboardSummary('key',load)
 expect(load).toHaveBeenCalledTimes(2)
})

it('does not share an abort controller across simultaneous consumers', async () => {
 const a=new AbortController();const b=new AbortController()
 let finishA!:(value:number)=>void;let finishB!:(value:number)=>void
 const first=getCachedDashboardSummary('shared',()=>new Promise<number>(resolve=>{finishA=resolve}),{signal:a.signal})
 const second=getCachedDashboardSummary('shared',()=>new Promise<number>(resolve=>{finishB=resolve}),{signal:b.signal})
 a.abort();finishA(1);finishB(2)
 await expect(first).rejects.toMatchObject({name:'AbortError'})
 expect(await second).toBe(2);expect(b.signal.aborted).toBe(false)
})
