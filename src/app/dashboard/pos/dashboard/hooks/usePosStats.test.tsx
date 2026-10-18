import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ rpc: vi.fn(), full: vi.fn(), from: vi.fn(), org: {id:'org',role:'owner'}, scope: {current:'user:org'} }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({rpc: state.rpc,from:state.from}) }))
vi.mock('@/contexts/branch-context', () => ({useBranch:()=>({selectedBranchId:'branch'})}))
vi.mock('@/contexts/ActiveOrganizationContext',()=>({useActiveOrganization:()=>({organization:state.org,isLoading:false})}))
vi.mock('@/hooks/use-tenant-scope',()=>({useTenantScope:()=>({scope:'user:org',currentScope:state.scope,organizationId:'org'})}))
vi.mock('@/lib/dashboard/summary-cache',()=>({getCachedDashboardSummary:(_key:string,load:()=>Promise<unknown>)=>load()}))
vi.mock('./usePosDetails',async(importOriginal)=>{const actual=await importOriginal<typeof import('./usePosDetails')>();return {...actual,usePosDetails:()=>({refetch:state.full})}})
import { usePosStats } from './usePosStats'
import { EMPTY_POS_STATS } from './usePosDetails'
const range = {from:new Date(2026,9,17),to:new Date(2026,9,17)}
const summary = {...EMPTY_POS_STATS,totalSales:110,totalTransactions:1,netSales:100,totalCost:60,itemsWithoutCost:1,dailySales:[{bucket_day:'2026-10-17',sales:110,transactions:1}],refunds:{totalAmount:10,salesAmount:10,repairsAmount:0}}
beforeEach(()=>{vi.clearAllMocks();state.scope.current='user:org';state.rpc.mockImplementation(()=>Object.assign(Promise.resolve({data:summary,error:null}),{abortSignal(){return this}}));state.full.mockResolvedValue({...EMPTY_POS_STATS,allSales:[{id:'sale',created_at:new Date().toISOString(),cost:60,refundAmount:10,itemsCount:2,profit:40}],warnings:[]})})
describe('POS summary and explicit detail boundary',()=>{
 it('loads one aggregate RPC without raw sales, items, credits or repairs for KPI rendering',async()=>{
  const {result}=renderHook(()=>usePosStats(range))
  await waitFor(()=>expect(result.current.loading).toBe(false))
  expect(state.rpc).toHaveBeenCalledTimes(1);expect(state.from).not.toHaveBeenCalled();expect(state.full).not.toHaveBeenCalled()
  expect(state.rpc.mock.calls[0][1]).toMatchObject({p_organization_id:'org',p_branch_id:'branch'})
  expect(result.current.detailsLoaded).toBe(false)
  expect(result.current.stats.profitStats.withTax.salesProfit).toBe(40)
  expect(result.current.stats.profitStats.withoutTax.salesProfit).toBe(30)
  expect(result.current.stats.profitStats.itemsWithoutCost).toBe(1)
 })
 it('loads full detail only on demand and returns the real rows for export',async()=>{
  const {result}=renderHook(()=>usePosStats(range));await waitFor(()=>expect(result.current.loading).toBe(false))
  let loaded:unknown
  await act(async()=>{loaded=await result.current.loadDetails()})
  expect(state.full).toHaveBeenCalledTimes(1);expect(loaded).toHaveProperty('allSales.0.id','sale')
  expect(result.current.detailsLoaded).toBe(true);expect(result.current.stats.allSales[0].id).toBe('sale')
 })
 it('surfaces failed detail and never claims an empty completed export',async()=>{
  state.full.mockResolvedValue(undefined)
  const {result}=renderHook(()=>usePosStats(range));await waitFor(()=>expect(result.current.loading).toBe(false))
  await act(async()=>{await expect(result.current.loadDetails()).rejects.toThrow('detalle completo')})
  expect(result.current.detailsError).toBeTruthy();expect(result.current.detailsLoaded).toBe(false)
 })
})


it('hides in-flight detail loading and errors when the period key changes',async()=>{
 let resolveDetails!:(value:unknown)=>void
 state.full.mockReturnValue(new Promise(resolve=>{resolveDetails=resolve}))
 const {result,rerender}=renderHook(({period})=>usePosStats(period),{initialProps:{period:range}})
 await waitFor(()=>expect(result.current.loading).toBe(false))
 let pending:Promise<unknown>
 act(()=>{pending=result.current.loadDetails().catch(()=>undefined)})
 expect(result.current.detailsLoading).toBe(true)
 const next={from:new Date(2026,9,16),to:new Date(2026,9,16)}
 rerender({period:next})
 await waitFor(()=>expect(result.current.loading).toBe(false))
 expect(result.current.detailsLoading).toBe(false);expect(result.current.detailsError).toBeNull()
 await act(async()=>{resolveDetails(undefined);await pending})
 expect(result.current.detailsError).toBeNull();expect(result.current.detailsLoaded).toBe(false)
})
it('rejects malformed summary payloads rather than drawing fabricated zero figures',async()=>{
 state.rpc.mockImplementation(()=>Object.assign(Promise.resolve({data:{totalSales:999},error:null}),{abortSignal(){return this}}))
 const {result}=renderHook(()=>usePosStats(range))
 await waitFor(()=>expect(result.current.error?.message).toContain('formato inválido'))
 expect(result.current.loading).toBe(false)
})

it('rejects an empty daily series for a nonempty requested period instead of filling fake zeros',async()=>{
 state.rpc.mockImplementation(()=>Object.assign(Promise.resolve({data:{...summary,dailySales:[]},error:null}),{abortSignal(){return this}}))
 const {result}=renderHook(()=>usePosStats(range))
 await waitFor(()=>expect(result.current.error?.message).toContain('diario está incompleto'))
 expect(result.current.loading).toBe(false)
})
