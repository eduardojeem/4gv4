import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({products:[] as unknown[],loading:false,error:null as Error|null,categories:[] as unknown[],company:{name:'Comercio de prueba',slug:'prueba'} as Record<string,unknown>}))
vi.mock('swr',()=>({default:()=>({data:state.products,isLoading:state.loading,error:state.error})}))
vi.mock('next/navigation',()=>({usePathname:()=>'/prueba/inicio'}))
vi.mock('@/components/public/storefront-style-context',()=>({useStorefrontCompanyInfo:()=>state.company}))
vi.mock('@/hooks/usePublicCategories',()=>({usePublicCategories:()=>({categories:state.categories})}))
vi.mock('@/components/public/inicio/PromotionalCarousel',()=>({PromotionalCarousel:()=> <div data-testid="configured-carousel">Banner configurado</div>}))
vi.mock('@/components/public/ProductCard',()=>({ProductCard:({product}:{product:{id:string;name:string}})=><div data-testid="real-product">{product.name}</div>}))
vi.mock('@/components/public/FloatingWhatsAppButton',()=>({FloatingWhatsAppButton:({fallbackPhone}:{fallbackPhone:string})=><a href={'https://wa.me/'+fallbackPhone}>WhatsApp real</a>}))
vi.mock('@/components/ui/app-image',()=>({AppImage:()=>null}))
import { EspecialCosmeticosHome } from '@/components/public/especial-cosmeticos/EspecialCosmeticosHome'
import type {WebsiteSettings} from '@/types/website-settings'
beforeEach(()=>{state.products=[];state.loading=false;state.error=null;state.categories=[];state.company={name:'Comercio de prueba',slug:'prueba'}})
const show=(over:Record<string,unknown>={})=>render(<EspecialCosmeticosHome settings={{company_info:state.company,...over} as unknown as WebsiteSettings}/> )
it('un catálogo vacío no inventa productos, ofertas, contactos ni reseñas',()=>{
 const {container}=show()
 expect(screen.queryAllByTestId('real-product')).toHaveLength(0)
 expect(container.querySelector('a[href*="wa.me"]')).toBeNull()
 expect(container.querySelector('iframe')).toBeNull()
 expect(screen.queryByText(/4.9/)).toBeNull()
 expect(screen.queryByText(/20% OFF/)).toBeNull()
 expect(screen.getByText(/Todavía no hay productos publicados/)).toBeInTheDocument()
})
it('muestra solo productos reales y ofertas reales del comercio',()=>{
 state.products=[{id:'p1',name:'Producto real',has_offer:true,offer_price:80,sale_price:100}]
 show()
 expect(screen.getAllByTestId('real-product')).toHaveLength(2)
 expect(screen.getAllByText('Producto real')).toHaveLength(2)
 expect(screen.queryByText('Set Rutina Glow Completa')).toBeNull()
})
it('usa el contacto y los conteos guardados, incluido cero',()=>{
 state.company={...state.company,whatsapp:'595981999999',address:'Dirección real'}
 state.categories=[{id:'cat',name:'Categoría real',productCount:0}]
 const {container}=show()
 expect(container.querySelector('a[href="https://wa.me/595981999999"]')).not.toBeNull()
 expect(screen.getByText('0 productos')).toBeInTheDocument()
})
it('un error de catálogo se comunica sin sustituir datos por una muestra',()=>{
 state.error=new Error('error de red');show()
 expect(screen.getByText(/No pudimos cargar el catálogo/)).toBeInTheDocument()
 expect(screen.queryAllByTestId('real-product')).toHaveLength(0)
})

it('muestra el carrusel configurado sin recurrir a ofertas inventadas',()=>{
 show({promotional_carousel:{enabled:true,slides:[{id:'banner-real',active:true,title:'Banner del comercio'}]}})
 expect(screen.getByTestId('configured-carousel')).toBeInTheDocument()
 expect(screen.queryAllByTestId('real-product')).toHaveLength(0)
})
it.each([{enabled:false,slides:[{id:'b',active:true}]},{enabled:true,slides:[{id:'b',active:false}]}])('respeta el carrusel oculto o sin banners activos',promotional_carousel=>{
 show({promotional_carousel})
 expect(screen.queryByTestId('configured-carousel')).toBeNull()
})
