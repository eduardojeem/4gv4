'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { appointmentPhoneMatches } from '@/lib/agenda/appointment-customer'
type Customer = {id:string;name:string;phone?:string|null}
export function AppointmentCustomerCard({contact,customers,selectedId,onSelect,onCreate}:{contact:{id:string|null;name:string;phone:string|null};customers:Customer[];selectedId:string;onSelect:(id:string)=>void;onCreate:()=>void}) {
 const [search,setSearch]=useState('')
 const [choosing,setChoosing]=useState(false)
 const selected=customers.find(customer=>customer.id===selectedId)
 const candidates=customers.filter(customer=>appointmentPhoneMatches(contact.phone,customer.phone))
 const filtered=customers.filter(customer=>!search.trim() || customer.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) || (customer.phone||'').includes(search.trim()))
 const locked=Boolean(contact.id)
 return <section aria-label="Cliente de la reserva" className="max-h-48 overflow-y-auto space-y-3 rounded-xl border bg-card p-4 text-sm">
  <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Cliente de la reserva</p><p className="font-semibold">{contact.name}</p><p className="text-muted-foreground">{contact.phone || 'Sin teléfono en la reserva'}</p></div><div><p className="text-xs text-muted-foreground">Ficha para este cobro</p><p className="font-medium">{selected?.name || (selectedId ? 'Cliente seleccionado' : 'Sin ficha vinculada')}</p>{locked && selectedId === contact.id && <p className="text-xs text-muted-foreground">La reserva ya está vinculada a este cliente.</p>}{locked && selectedId !== contact.id && <div role="alert"><p>La ficha seleccionada no coincide con la reserva.</p><Button size="sm" variant="outline" onClick={()=>onSelect(contact.id!)}>Usar cliente de la reserva</Button></div>}</div></div>
  {!locked && <>
   {!selectedId && candidates.length>0 && <div className="space-y-2 rounded-lg bg-primary/5 p-3"><p>Encontramos {candidates.length===1?'una ficha con este teléfono':'varias fichas con este teléfono'}. Confirmá cuál corresponde.</p>{candidates.map(customer=><div key={customer.id} className="flex flex-wrap items-center justify-between gap-2"><span>{customer.name} · {customer.phone}</span><Button size="sm" variant="outline" onClick={()=>onSelect(customer.id)}>Usar ficha de {customer.name}</Button></div>)}</div>}
   <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setChoosing(value=>!value)}>{selectedId?'Cambiar ficha para el cobro':'Buscar cliente existente'}</Button>{!selectedId && <Button size="sm" variant="outline" onClick={onCreate}>Registrar con datos de la reserva</Button>}</div>
   {choosing && <div className="space-y-2"><Input aria-label="Buscar cliente para el cobro" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nombre o teléfono"/><p className="text-xs text-muted-foreground">Clientes cargados en el POS. Verificá nombre y teléfono antes de vincular.</p><ul className="max-h-44 overflow-y-auto divide-y">{filtered.slice(0,30).map(customer=><li key={customer.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{customer.name} · {customer.phone || 'Sin teléfono'}</span><Button size="sm" variant="ghost" onClick={()=>{onSelect(customer.id);setChoosing(false)}}>Seleccionar {customer.name}</Button></li>)}</ul>{filtered.length===0&&<p>No hay coincidencias en los clientes cargados.</p>}</div>}
  </>}
 </section>
}
