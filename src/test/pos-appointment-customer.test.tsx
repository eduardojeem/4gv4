import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppointmentCustomerCard } from '@/app/dashboard/pos/components/AppointmentCustomerCard'
import { useQuoteToCart } from '@/app/dashboard/pos/hooks/useQuoteToCart'
import type { Product } from '@/app/dashboard/pos/types'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
const contact={id:null,name:'Ana Pérez',phone:'0981123456'}
describe('appointment contact in POS',()=>{
 it('keeps name and phone and clears the previous sale customer when there is no linked record', async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({professionalBookingAvailable:true,appointment:{id:'a',number:1,status:'confirmed',sale_id:null,customer_id:null,customer_name:contact.name,customer_phone:contact.phone,service_product_id:'s',service_name:'Corte',price:50000}})}))
  const select=vi.fn()
  const {result}=renderHook(()=>useQuoteToCart({quoteId:null,appointmentId:'a',ready:true,inventoryProducts:[{id:'s',name:'Corte',sale_price:50000,is_active:true} as Product],getVariant:()=>null,addProduct:vi.fn(),addVariant:vi.fn(),updateItemDiscount:vi.fn(),setIsWholesale:vi.fn(),setSelectedCustomer:select,clearCart:vi.fn()}))
  await waitFor(()=>expect(result.current.activeQuote?.customer).toEqual(contact))
  expect(select).toHaveBeenCalledWith('')
 })
 it('requires confirmation even when phone formats match',()=>{
  const select=vi.fn(),create=vi.fn()
  render(<AppointmentCustomerCard contact={contact} customers={[{id:'c',name:'Ana habitual',phone:'+595981123456'}]} selectedId="" onSelect={select} onCreate={create}/>)
  expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
  expect(select).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Usar ficha de Ana habitual'}))
  expect(select).toHaveBeenCalledWith('c')
  fireEvent.click(screen.getByRole('button',{name:'Registrar con datos de la reserva'}))
  expect(create).toHaveBeenCalledOnce()
 })
 it('does not offer replacing an already linked reservation customer',()=>{
  render(<AppointmentCustomerCard contact={{...contact,id:'c'}} customers={[{id:'c',name:'Ana habitual',phone:contact.phone}]} selectedId="c" onSelect={vi.fn()} onCreate={vi.fn()}/>)
  expect(screen.queryByRole('button',{name:'Buscar cliente existente'})).not.toBeInTheDocument()
 })
})
