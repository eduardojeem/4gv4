import { expect, it, vi } from 'vitest'
import { countMonthlyRepairs, repairMonthWindow } from '../lib/saas/repair-monthly-usage'
import type { SupabaseClient } from '@supabase/supabase-js'
it('resets on the first of the month in Paraguay without carrying unused quota',()=>{const before=repairMonthWindow(Date.parse('2026-12-01T02:59:59Z'));const after=repairMonthWindow(Date.parse('2026-12-01T03:00:00Z'));expect(before.startsAt).toBe('2026-11-01T03:00:00.000Z');expect(before.endsAt).toBe(after.startsAt);expect(after.startsAt).toBe('2026-12-01T03:00:00.000Z');expect(after.endsAt).toBe('2027-01-01T03:00:00.000Z')})
it('counts only creations in the active organization and current month',async()=>{const calls:unknown[]=[];const q={select:vi.fn(()=>q),eq:vi.fn((...args:unknown[])=>{calls.push(args);return q}),gte:vi.fn((...args:unknown[])=>{calls.push(args);return q}),lt:vi.fn(async(...args:unknown[])=>{calls.push(args);return {count:12,error:null}})};const client={from:vi.fn(()=>q)} as unknown as SupabaseClient;const result=await countMonthlyRepairs(client,'org-a',Date.parse('2026-11-15T12:00:00Z'));expect(result.current).toBe(12);expect(calls).toEqual([['organization_id','org-a'],['created_at',result.startsAt],['created_at',result.endsAt]])})

it('starts a fresh count after reset and fails closed when the count is unavailable',async()=>{
 const rows=['2026-11-10T12:00:00Z','2026-11-20T12:00:00Z','2026-12-02T12:00:00Z'];let lower='';
 const q={select:()=>q,eq:()=>q,gte:(_k:string,v:string)=>{lower=v;return q},lt:async(_k:string,upper:string)=>({count:rows.filter(date=>date>=lower&&date<upper).length,error:null})};const client={from:()=>q} as unknown as SupabaseClient;
 expect((await countMonthlyRepairs(client,'org',Date.parse('2026-11-29T12:00:00Z'))).current).toBe(2)
 expect((await countMonthlyRepairs(client,'org',Date.parse('2026-12-15T12:00:00Z'))).current).toBe(1)
 q.lt=async()=>({count:null as unknown as number,error:null});await expect(countMonthlyRepairs(client,'org')).rejects.toThrow('No se pudo contar')
})
