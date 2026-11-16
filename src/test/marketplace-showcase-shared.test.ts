import {describe,it,expect} from 'vitest'
import {buildShowcaseCards, SHOWCASE_SLIDES} from '@/lib/public/marketplace-showcase-content'
import {filterMarketProducts} from '@/lib/public/mobile-marketplace-query'
describe('contenido compartido del carrusel',()=>{
 it('oculta rubros sin catálogo y conserva orden por cantidad y contenido compartido',()=>{
  expect(buildShowcaseCards({})).toEqual([])
  const cards=buildShowcaseCards({belleza:{count:3,categoryIds:['b'],products:[]},electronica:{count:8,categoryIds:['e','e2'],products:[]}})
  expect(cards.map(card=>card.id)).toEqual(['electronica','belleza'])
  expect(cards[0]).toMatchObject({...SHOWCASE_SLIDES.find(s=>s.id==='electronica'),count:8,categoryIds:['e','e2']})
 })
 it('filtra todas las categorías del rubro sin depender del nombre del producto',()=>{
  const product=(id:string,category:string)=>({id,name:'Modelo '+id,brand:null,category:{id:category,name:'Otra denominación'},price:10,offerPrice:null,inStock:true,featured:false,store:{slug:'tienda',name:'Tienda'}})
  expect(filterMarketProducts([product('1','a'),product('2','b'),product('3','c')],{category:'a,b'}).map(p=>p.id)).toEqual(['1','2'])
 })
})
