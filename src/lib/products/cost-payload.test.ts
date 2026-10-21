import { describe, expect, it } from 'vitest'
import { omitUnauthorizedProductCosts } from './cost-payload'
describe('product cost payload compatibility', () => {
 it('preserves name and variants while omitting every cost alias without write permission', () => {
  const source={name:'Renamed',purchase_price:0,foreign_purchase_price:null,cost_price:4,variants:[{id:'v1',sku:'NEW',purchasePrice:0,purchase_price:8,cost_price:9,salePrice:20}]}
  expect(omitUnauthorizedProductCosts(source,false)).toEqual({name:'Renamed',variants:[{id:'v1',sku:'NEW',salePrice:20}]})
  expect(source.purchase_price).toBe(0)
  expect(source.variants[0].purchasePrice).toBe(0)
 })
 it('preserves an explicit legitimate zero when writing is allowed',()=>{
  const source={purchase_price:0,variants:[{purchasePrice:0}]}
  expect(omitUnauthorizedProductCosts(source,true)).toEqual(source)
 })
})
