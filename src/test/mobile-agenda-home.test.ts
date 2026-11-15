import {expect,it} from 'vitest'
import {appointmentInputSchema} from '@/lib/agenda/agenda-api'
import {emptyForm,appointmentPayload,formIssues,formFromAppointment,type AgendaData,type Appointment} from '../../mobile/src/lib/agenda-model'
const data={settings:{slot_minutes:30},timeZone:'UTC',capabilities:{professionalBooking:true,homeAppointments:true},canConfigure:false,professionals:[],attentionMode:'home'} as unknown as AgendaData
it('sends the same home fields accepted by the server',()=>{
 const form={...emptyForm(data,'2026-11-16','10:00'),customerName:'Ana',serviceName:'Servicio',service_address:'Calle 1',arrival_instructions:'Timbre azul',travel_before_minutes:15,travel_after_minutes:20}
 expect(form.attention_mode).toBe('home')
 expect(appointmentInputSchema.parse(appointmentPayload(form,data,'create'))).toMatchObject({attention_mode:'home',service_address:'Calle 1',arrival_instructions:'Timbre azul',travel_before_minutes:15,travel_after_minutes:20})
})
it('does not send unsupported fields before the migration',()=>{
 const form={...emptyForm({...data,capabilities:{professionalBooking:true}},'2026-11-16','10:00'),customerName:'Ana',serviceName:'Servicio'}
 expect(appointmentPayload(form,{...data,capabilities:{professionalBooking:true}},'create')).not.toHaveProperty('attention_mode')
})
it('restores location and travel when editing and validates missing addresses',()=>{
 const original={customer_id:null,customer_name:'Ana',customer_phone:null,professional_id:null,service_product_id:null,service_name:'Visita',notes:null,starts_at:'2026-11-16T10:00Z',ends_at:'2026-11-16T10:30Z',price:50000,attention_mode:'home',service_address:'Calle 1',arrival_instructions:'Portón',travel_before_minutes:15,travel_after_minutes:20,status:'confirmed'} as Appointment
 const form=formFromAppointment(original,'UTC')
 expect(form).toMatchObject({service_address:'Calle 1',travel_before_minutes:15,travel_after_minutes:20})
 expect(formIssues({...form,service_address:''},data)).toContain('Agregá la dirección para la atención a domicilio.')
})