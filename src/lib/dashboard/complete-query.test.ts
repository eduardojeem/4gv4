import { describe, expect, it } from 'vitest'
import { completeDashboardQuery } from './complete-query'
function query(rows: Array<{ id: string }>, failAt?: number, countMissing = false) {
 let offset = 0
 const calls: number[] = []
 const builder = {
  order: () => builder,
  abortSignal: () => builder,
  range: (from: number) => { offset = from; return builder },
  then: <TResult1 = { data: Array<{ id: string }> | null; error: unknown; count: number | null }, TResult2 = never>(resolve?: ((value: { data: Array<{ id: string }> | null; error: unknown; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null, reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) => {
   calls.push(offset)
   return Promise.resolve({ data: failAt === offset ? null : rows.slice(offset, offset + 200), error: failAt === offset ? new Error('failed') : null, count: countMissing ? null : rows.length }).then(resolve, reject)
  },
 }
 return { builder, calls }
}
describe('complete dashboard query', () => {
 it('follows exact coverage even when the server returns fewer than the requested page size', async () => {
  const { builder, calls } = query(Array.from({ length: 1250 }, (_, i) => ({ id: String(i) })))
  const result = await completeDashboardQuery(builder)
  expect(result.error).toBeNull()
  expect(result.data).toHaveLength(1250)
  expect(calls).toEqual([0,200,400,600,800,1000,1200])
 })
 it('returns no partial data after a second-page failure', async () => {
  const { builder } = query(Array.from({ length: 400 }, (_, i) => ({ id: String(i) })), 200)
  const result = await completeDashboardQuery(builder)
  expect(result.data).toBeNull()
  expect(result.error).toBeTruthy()
 })
 it('rejects missing coverage and duplicate pages', async () => {
  expect((await completeDashboardQuery(query([{ id: '1' }], undefined, true).builder)).error).toBeTruthy()
  expect((await completeDashboardQuery(query([{ id: '1' }, { id: '1' }]).builder)).error).toBeTruthy()
 })
})
