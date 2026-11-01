import {render,screen} from '@testing-library/react'
import {describe,it,expect,vi,beforeEach} from 'vitest'
import type {WebsiteSettings} from '@/types/website-settings'
import type {StorefrontCapabilities} from '@/lib/website/storefront-capabilities'
const state=vi.hoisted(()=>({products:[] as Array<{id:string;name:string;sale_price:number;wholesale_price?:number}>,error:undefined as Error|undefined}))
vi.mock('next/navigation',()=>({usePathname:()=>'/synthetic/inicio'}))
vi.mock('swr',()=>({default:()=>({data:state.products,error:state.error,isLoading:false})}))
vi.mock('@/hooks/usePublicCategories',()=>({usePublicCategories:()=>({categories:[]})}))
vi.mock('@/components/public/ProductCard',()=>({ProductCard:({product}:{product:{id:string;name:string;wholesale_price?:number}})=><div data-testid="shared-product">{product.name}:{product.wholesale_price ?? 'retail'}</div>}))
vi.mock('@/components/public/inicio/PromotionalCarousel',()=>({PromotionalCarousel:()=>null}))
vi.mock('@/components/public/inicio/StoreTrustBar',()=>({StoreTrustBar:()=> <div>Configured benefits</div>}))
vi.mock('@/components/public/inicio/StoreOffersPromoShowcase',()=>({StoreOffersPromoShowcase:()=>null}))
import {WholesaleHome} from '@/components/public/wholesale/WholesaleHome'
const settings={company_info:{name:'Synthetic',phone:'',email:''},hero_content:{enabled:true,title:'Catálogo local',subtitle:'',badge:''}} as WebsiteSettings
const capabilities={hasCatalog:true} as StorefrontCapabilities
describe('WholesaleHome',()=>{
beforeEach(()=>{state.products=[];state.error=undefined})
it('has safe empty defaults without fabricated claims',()=>{render(<WholesaleHome settings={settings} branches={[]} capabilities={capabilities}/>);expect(screen.getByText('Todavía no hay productos publicados.')).toBeDefined();expect(screen.queryByText('Configured benefits')).toBeNull();expect(screen.queryByText(/Envío gratis|Garantía oficial|15K|99%|4.9/)).toBeNull()})
it('bounds the grid and passes authorized prices to shared cards unchanged',()=>{state.products=Array.from({length:32},(_,i)=>Object.freeze({id:String(i),name:'Producto '+i,sale_price:100,wholesale_price:80}));render(<WholesaleHome settings={settings} branches={[]} capabilities={capabilities}/>);expect(screen.getAllByTestId('shared-product')).toHaveLength(20);expect(screen.getByText('Producto 0:80')).toBeDefined();expect(state.products[0].sale_price).toBe(100)})
it('keeps retail products retail and reports network failure',()=>{state.products=[{id:'1',name:'Retail',sale_price:100}];const view=render(<WholesaleHome settings={settings} branches={[]} capabilities={capabilities}/>);expect(screen.getByText('Retail:retail')).toBeDefined();state.error=new Error('offline');view.rerender(<WholesaleHome settings={settings} branches={[]} capabilities={capabilities}/>);expect(screen.getByRole('status').textContent).toContain('No pudimos cargar')})
it('does not render a catalog without the catalog capability',()=>{render(<WholesaleHome settings={settings} branches={[]} capabilities={{hasCatalog:false} as StorefrontCapabilities}/>);expect(screen.queryByText('Productos del catálogo')).toBeNull()})
})