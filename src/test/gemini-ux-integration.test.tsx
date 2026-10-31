import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeroSection } from '@/components/public/inicio/HeroSection'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { StoreTrustBar } from '@/components/public/inicio/StoreTrustBar'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import { BookingSectionEditor } from '@/components/admin/website/BookingSectionEditor'
import { BookingSectionSchema } from '@/lib/validation/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
const state=vi.hoisted(()=>({update:vi.fn()}))
vi.mock('@/hooks/useWebsiteSettings',()=>({useAdminWebsiteSettings:()=>({settings:getWebsiteSettingsDefaults(),isLoading:false,updateSetting:state.update})}))
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()})
describe('integración segura de UX Gemini',()=>{
 it('la portada técnica no inventa certificación, especialidades ni estadísticas',()=>{
  const defaults=getWebsiteSettingsDefaults()
  render(<HeroSection companyInfo={{...defaults.company_info,name:''}} heroStats={{enabled:true,repairs:'',satisfaction:'',avgTime:''}} heroContent={{...defaults.hero_content,enabled:true}} brand={getBrandTheme('blue')} phoneClean="" contactHref="/inicio#contacto" hasRepairs />)
  for(const claim of ['Oficial','Tienda Oficial','Laboratorio Propio','Microelectrónica','Diagnóstico sin costo','Reparación express (1 a 3h)','Repuestos certificados','100%','4.9★','24h']) expect(screen.queryByText(claim)).not.toBeInTheDocument()
 })
 it.each(['beauty','classic'] as const)('no inventa beneficios en %s',style=>{
  const {container}=render(<StorefrontStyleProvider style={style}><StoreTrustBar /></StorefrontStyleProvider>)
  expect(container).toBeEmptyDOMElement()
 })
 it('conserva solo beneficios configurados y activos en Belleza',()=>{
  render(<StorefrontStyleProvider style="beauty"><StoreTrustBar settings={{enabled:true,position:'bottom',items:[{id:'pickup',title:'Retiro coordinado',active:true},{id:'hidden',title:'Garantía oficial',active:false}]}} /></StorefrontStyleProvider>)
  expect(screen.getByText('Retiro coordinado')).toBeInTheDocument()
  expect(screen.queryByText('Garantía oficial')).not.toBeInTheDocument()
 })
 it('valida badge opcional de reservas sin romper datos antiguos',()=>{
  const booking=getWebsiteSettingsDefaults().booking_section!
  expect(BookingSectionSchema.safeParse(booking).success).toBe(true)
  expect(BookingSectionSchema.parse({...booking,badge:' Cita técnica '}).badge).toBe('Cita técnica')
  expect(BookingSectionSchema.safeParse({...booking,badge:'x'.repeat(61)}).success).toBe(false)
 })
 it('aplica presets solo al elegirlos y guarda badge con el contrato existente',async()=>{
  state.update.mockResolvedValue({success:true})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({settings:{online_booking:false},services:[],professionals:[]})}))
  await act(async()=>{render(<BookingSectionEditor />)})
  expect(state.update).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:/Servicio Técnico/}))
  expect(screen.getByLabelText('Etiqueta superior (Badge / Eyebrow)')).toHaveValue('Atención en taller')
  fireEvent.click(screen.getByRole('button',{name:/Guardar/}))
  await waitFor(()=>expect(state.update).toHaveBeenCalledWith('booking_section',expect.objectContaining({badge:'Atención en taller',showTeam:false})))
 })
})
