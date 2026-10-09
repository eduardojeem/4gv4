import { expect,it } from 'vitest'
import { publicAppointmentPrice } from '@/lib/agenda/public-appointment-price'
import type { SupabaseClient } from '@supabase/supabase-js'
const client=(quote:unknown,product:unknown,error:unknown=null)=>({from:(table:string)=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='agenda_booking_quotes'?quote:product,error})};return q}}) as unknown as SupabaseClient
const appointment={id:'a',organization_id:'o',service_product_id:'s',price:40000}
it('never reveals the booked hidden price after changing catalog visibility',async()=>{
  expect(await publicAppointmentPrice(client({hide_price:true},{hide_price:false}),appointment)).toBeNull()
})
it('fails closed when privacy metadata cannot be read',async()=>{
  expect(await publicAppointmentPrice(client(null,null,{code:'42501'}),appointment)).toBeNull()
})
it('retains visible zero and uses catalog privacy for older appointments',async()=>{
  expect(await publicAppointmentPrice(client({hide_price:false},{hide_price:false}),{...appointment,price:0})).toBe(0)
  expect(await publicAppointmentPrice(client(null,{hide_price:true}),appointment)).toBeNull()
})
it('hides the new private service price after an internal service replacement',async()=>{
  expect(await publicAppointmentPrice(client({hide_price:false},{hide_price:true}),appointment)).toBeNull()
  expect(await publicAppointmentPrice(client({hide_price:false},null),appointment)).toBeNull()
})
