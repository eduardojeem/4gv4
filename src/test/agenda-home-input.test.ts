import {expect,it} from 'vitest';
import {appointmentInputSchema} from '@/lib/agenda/agenda-api';
const base={customer_name:'Ana',service_name:'Servicio',starts_at:'2026-11-15T12:00:00Z',duration_minutes:30};
it('requires an address for at-home appointments',()=>{expect(appointmentInputSchema.safeParse({...base,attention_mode:'home'}).success).toBe(false)});
it('rejects invalid travel durations',()=>{expect(appointmentInputSchema.safeParse({...base,attention_mode:'home',service_address:'Calle 1',travel_before_minutes:-1}).success).toBe(false);expect(appointmentInputSchema.safeParse({...base,attention_mode:'home',service_address:'Calle 1',travel_after_minutes:181}).success).toBe(false)});
it('preserves structured location and travel times',()=>{expect(appointmentInputSchema.parse({...base,attention_mode:'home',service_address:'Calle 1',arrival_instructions:'Timbre azul',travel_before_minutes:15,travel_after_minutes:20})).toMatchObject({attention_mode:'home',service_address:'Calle 1',travel_before_minutes:15,travel_after_minutes:20})});
