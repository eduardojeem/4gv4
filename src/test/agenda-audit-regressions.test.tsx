import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BarberDailySummaryCard } from '@/components/dashboard/agenda/BarberDailySummaryCard'
import { AntiNoShowReminderCard } from '@/components/dashboard/agenda/AntiNoShowReminderCard'
import type { AgendaData, Appointment } from '@/components/dashboard/agenda/types'
import { DEFAULT_AGENDA_SETTINGS } from '@/lib/agenda/agenda-server'
const professionals=[{id:'p1',name:'Ana',user_id:'user',color:'#000000',phone:null,is_active:true,sort_order:0},{id:'p2',name:'Bea',color:'#000000',phone:null,is_active:true,sort_order:1}]
const appointment=(id:string,status:Appointment['status'],professional_id='p1')=>({id,status,professional_id,price:10000,starts_at:'2026-11-13T13:00:00Z',ends_at:'2026-11-13T13:30:00Z',customer_name:id,customer_phone:'0981123456',service_name:'Corte',reminder_sent_at:null} as Appointment)
const data:AgendaData={available:true,date:'2026-11-13',days:1,appointments:[appointment('atendido','completed'),appointment('pendiente','pending'),appointment('ausente','no_show'),appointment('otro','completed','p2')],professionals,services:[],settings:DEFAULT_AGENDA_SETTINGS,pendingCount:1,timeZone:'America/Asuncion',currency:'PYG',storeName:'Local',storeSlug:'local',canConfigure:true}
beforeEach(()=>vi.stubGlobal('fetch',vi.fn()))
it('Todo el Equipo usa todos los profesionales aunque el usuario esté vinculado',()=>{render(<BarberDailySummaryCard data={data} date={data.date} currentUserId="user" selectedProfessionalId={null} onSelectProfessional={vi.fn()}/>);expect(screen.getByText('Total Servicios')).toBeInTheDocument();expect(screen.getByText(/20.000/)).toBeInTheDocument()})
it('solo genera recordatorios para pendientes y confirmados',()=>{render(<AntiNoShowReminderCard data={{...data,appointments:[appointment('atendido','completed')]}} date={data.date} onAppointmentUpdated={vi.fn()}/>);expect(screen.queryByText(/Recordatorios WhatsApp/)).not.toBeInTheDocument()})
import { ProfessionalEmployeeLink } from '@/components/dashboard/agenda/ProfessionalEmployeeLink'
import { fireEvent, waitFor } from '@testing-library/react'
it('propaga las comisiones guardadas para que el padre actualice la liquidación',async()=>{
  const onSaved=vi.fn()
  vi.stubGlobal('fetch',vi.fn(async(_url,options)=>({ok:true,json:async()=>options?.method==='PUT'?{userId:'user',commissionRateServices:70}:{available:true,employees:[],userId:'user',remunerationType:'commission',commissionRateServices:50}})))
  render(<ProfessionalEmployeeLink professionalId="p1" onSaved={onSaved}/> )
  fireEvent.click(await screen.findByRole('button',{name:'70%'}))
  fireEvent.click(screen.getByRole('button',{name:'Guardar comisiones'}))
  await waitFor(()=>expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({commission_rate_services:70,user_id:'user'})))
})
