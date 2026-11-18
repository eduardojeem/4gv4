import {act,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {EspecialCosmeticosCarousel} from '@/components/public/especial-cosmeticos/EspecialCosmeticosCarousel'
import type {PromotionalCarouselSettings} from '@/types/website-settings'
vi.mock('next/navigation',()=>({usePathname:()=>'/prueba/inicio'}))
vi.mock('@/components/ui/app-image',()=>({AppImage:()=>null}))
let reduced=false
beforeEach(()=>{reduced=false;vi.useFakeTimers();vi.stubGlobal('matchMedia',vi.fn(()=>({matches:reduced,addEventListener:vi.fn(),removeEventListener:vi.fn()})))})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
const slides=[{id:'a',title:'Primero',active:true,imageUrl:'/a.webp'},{id:'b',title:'Segundo',active:true,imageUrl:'/b.webp'}]
const settings={enabled:true,autoplay:true,intervalSeconds:6,slides} as PromotionalCarouselSettings
it('no falla al reducirse los banners activos mientras se ve el segundo',()=>{
 const view=render(<EspecialCosmeticosCarousel settings={settings}/>)
 fireEvent.click(screen.getByRole('button',{name:'Slide siguiente'}))
 expect(screen.getByRole('heading',{name:'Segundo'})).toBeInTheDocument()
 expect(()=>view.rerender(<EspecialCosmeticosCarousel settings={{...settings,slides:slides.slice(0,1)}}/>)).not.toThrow()
 expect(screen.getByRole('heading',{name:'Primero'})).toBeInTheDocument()
})
it('la pausa manual se conserva al retirar el mouse',()=>{
 render(<EspecialCosmeticosCarousel settings={settings}/>)
 fireEvent.click(screen.getByRole('button',{name:'Pausar carrusel'}))
 fireEvent.mouseLeave(screen.getByRole('region',{name:'Campañas y Novedades de Cosmética'}))
 expect(screen.getByRole('button',{name:'Reanudar carrusel'})).toBeInTheDocument()
 act(()=>vi.advanceTimersByTime(7000))
 expect(screen.getByRole('heading',{name:'Primero'})).toBeInTheDocument()
})
it('respeta la preferencia de movimiento reducido',()=>{
 reduced=true
 render(<EspecialCosmeticosCarousel settings={settings}/>)
 act(()=>vi.advanceTimersByTime(7000))
 expect(screen.getByRole('heading',{name:'Primero'})).toBeInTheDocument()
})

it('avanza automáticamente cuando el usuario lo permite',()=>{
 render(<EspecialCosmeticosCarousel settings={settings}/>)
 act(()=>vi.advanceTimersByTime(7000))
 expect(screen.getByRole('heading',{name:'Segundo'})).toBeInTheDocument()
})
it('mantiene el destino de compra dentro del comercio',()=>{
 render(<EspecialCosmeticosCarousel settings={{...settings,autoplay:false,slides:[{...slides[0],ctaText:'Comprar',ctaHref:'/productos'}]}}/>)
 expect(screen.getByRole('link',{name:'Comprar'})).toHaveAttribute('href','/prueba/productos')
})
