import {act,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import type {WebsiteSettings} from '@/types/website-settings'
import type {StorefrontCapabilities} from '@/lib/website/storefront-capabilities'
const state=vi.hoisted(()=>({pathname:'/shop-a/inicio',desktop:false,listeners:new Set<(event:MediaQueryListEvent)=>void>(),products:[{id:'out-of-stock',name:'Producto sin stock',sale_price:100,stock_quantity:0,in_stock:false}]}))
vi.mock('next/navigation',()=>({usePathname:()=>state.pathname}))
vi.mock('swr',()=>({default:()=>({data:state.products,isLoading:false})}))
vi.mock('@/hooks/usePublicCategories',()=>({usePublicCategories:()=>({categories:[]})}))
vi.mock('@/components/public/cart/PublicCartButton',()=>({PublicCartButton:()=> <button>Carrito compartido</button>}))
vi.mock('@/components/public/ProductCard',()=>({ProductCard:({product}:{product:{name:string}})=> <div>{product.name}</div>}))
vi.mock('@/components/public/inicio/PromotionalCarousel',()=>({PromotionalCarousel:()=> <div data-testid="shared-carousel"/>}))
vi.mock('@/components/public/inicio/StoreOffersPromoShowcase',()=>({StoreOffersPromoShowcase:()=>null}))
import {WholesaleHeader} from '@/components/public/wholesale/WholesaleHeader'
import {WholesaleHome} from '@/components/public/wholesale/WholesaleHome'
const capabilities={hasCatalog:true} as StorefrontCapabilities
const slide=(id:string,extra:Record<string,unknown>={})=>({id,title:'Título '+id,message:'Mensaje '+id,imageUrl:'/synthetic.jpg',imageAlt:'Imagen sintética',active:true,hideText:false,ctaText:'Ver promoción',ctaHref:'/ofertas',...extra})
function settings(extra:Record<string,unknown>={}):WebsiteSettings{return {company_info:{name:'Tienda sintética',phone:'',email:''},hero_content:{enabled:false},promotional_carousel:{enabled:true,slides:[slide('principal'),slide('secundario',extra)]}} as unknown as WebsiteSettings}
beforeEach(()=>{state.pathname='/shop-a/inicio';state.desktop=false;state.listeners.clear();document.body.style.overflow='';vi.spyOn(window,'matchMedia').mockImplementation(query=>({matches:state.desktop,media:query,addEventListener:(_type:string,listener:(event:MediaQueryListEvent)=>void)=>state.listeners.add(listener),removeEventListener:(_type:string,listener:(event:MediaQueryListEvent)=>void)=>state.listeners.delete(listener)} as unknown as MediaQueryList))})
afterEach(()=>{vi.restoreAllMocks();document.body.style.overflow=''})
describe('Wholesale release navigation and claims',()=>{
it.each(['shop-a','shop-b'])('keeps secondary promo CTA in %s',slug=>{state.pathname='/'+slug+'/inicio';render(<WholesaleHome settings={settings()} branches={[]} capabilities={capabilities}/>);expect(screen.getByRole('link',{name:'Ver promoción'}).getAttribute('href')).toBe('/'+slug+'/ofertas')})
it('preserves an external promo URL',()=>{render(<WholesaleHome settings={settings({ctaHref:'https://example.test/promo'})} branches={[]} capabilities={capabilities}/>);expect(screen.getByRole('link',{name:'Ver promoción'}).getAttribute('href')).toBe('https://example.test/promo')})
it('does not double-prefix tenant URLs',()=>{render(<WholesaleHome settings={settings({ctaHref:'/shop-a/ofertas'})} branches={[]} capabilities={capabilities}/>);expect(screen.getByRole('link',{name:'Ver promoción'}).getAttribute('href')).toBe('/shop-a/ofertas')})
it('keeps hideText slides in the shared carousel without reintroducing text cards',()=>{const config=settings({hideText:true});render(<WholesaleHome settings={config} branches={[]} capabilities={capabilities}/>);expect(screen.getByTestId('shared-carousel')).toBeDefined();expect(screen.queryByText('Título secundario')).toBeNull();expect(screen.queryByText('Mensaje secundario')).toBeNull();expect(config.promotional_carousel.slides[1].hideText).toBe(true)})
it('renders a visible secondary slide when hideText is false',()=>{render(<WholesaleHome settings={settings({hideText:false})} branches={[]} capabilities={capabilities}/>);expect(screen.getByText('Título secundario')).toBeDefined();expect(screen.getByText('Mensaje secundario')).toBeDefined()})
it('does not promise immediate availability for products without stock',()=>{render(<WholesaleHome settings={settings()} branches={[]} capabilities={capabilities}/>);expect(screen.getByText('Producto sin stock')).toBeDefined();expect(screen.queryByText(/disponibilidad inmediata/i)).toBeNull()})
})
describe('Wholesale mobile modal',()=>{
it('closes with Escape and restores focus',async()=>{const user=userEvent.setup();render(<WholesaleHeader settings={null}/>);const trigger=screen.getByRole('button',{name:'Abrir menú de navegación'});await user.click(trigger);expect(screen.getByRole('dialog')).toBeDefined();await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await waitFor(()=>expect(document.activeElement).toBe(trigger))})
it('moves focus into the modal and contains keyboard navigation',async()=>{const user=userEvent.setup();render(<WholesaleHeader settings={null}/>);await user.click(screen.getByRole('button',{name:'Abrir menú de navegación'}));const dialog=screen.getByRole('dialog');await waitFor(()=>expect(dialog.contains(document.activeElement)).toBe(true));await user.tab({shift:true});expect(dialog.contains(document.activeElement)).toBe(true)})
it('closes on desktop breakpoint and restores previous scroll state',async()=>{document.body.style.overflow='auto';const user=userEvent.setup();render(<WholesaleHeader settings={null}/>);await user.click(screen.getByRole('button',{name:'Abrir menú de navegación'}));expect(screen.getByRole('dialog')).toBeDefined();act(()=>{state.desktop=true;state.listeners.forEach(listener=>listener({matches:true} as MediaQueryListEvent))});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await waitFor(()=>expect(document.body.hasAttribute('data-scroll-locked')).toBe(false));expect(document.body.style.overflow).toBe('auto')})
it('restores scroll when unmounted while open',async()=>{document.body.style.overflow='auto';const user=userEvent.setup();const view=render(<WholesaleHeader settings={null}/>);await user.click(screen.getByRole('button',{name:'Abrir menú de navegación'}));view.unmount();await waitFor(()=>expect(document.body.hasAttribute('data-scroll-locked')).toBe(false));expect(document.body.style.overflow).toBe('auto')})
})
