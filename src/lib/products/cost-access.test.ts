import { expect, it, vi } from 'vitest'
import { resolveOrganizationProductCostAccess, redactProductCosts, hasExplicitProductCost, normalizeUnknownProductCosts, prepareProductCostInput } from './cost-access'
it('scopes grants to organization and distinguishes read from write',async()=>{
 const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),in:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{role:'seller'},error:null}),then:(resolve: (v:unknown)=>unknown)=>Promise.resolve({data:[{permission:'products.read_cost'}],error:null}).then(resolve)}
 const access=await resolveOrganizationProductCostAccess({from:()=>q} as never,{userId:'u',organizationId:'B',organizationRole:'seller'})
 expect(access).toEqual({canReadCost:true,canWriteCost:false});expect(q.eq).toHaveBeenCalledWith('organization_id','B')
})
it('only organization administrators default to cost permissions',async()=>{
 const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{role:'admin'},error:null})}
 expect(await resolveOrganizationProductCostAccess({from:()=>q} as never,{userId:'u',organizationId:'B',organizationRole:'seller'})).toEqual({canReadCost:true,canWriteCost:true})
})
it('redacts local/foreign and variant aliases, preserving zero when authorized',()=>{
 const p={purchase_price:0,foreign_purchase_price:5,variants:[{purchasePrice:2,purchase_price:3,name:'v'}]}
 expect(redactProductCosts(p,{canReadCost:false})).toEqual({variants:[{name:'v'}]})
 expect(redactProductCosts(p,{canReadCost:true})).toEqual(p)
})
it('unknown is omitted but zero and manipulated aliases count as writes',()=>{
 expect(hasExplicitProductCost({purchase_price:null,variants:[{purchasePrice:undefined}]})).toBe(false)
 expect(hasExplicitProductCost({variants:[{purchase_price:0}]})).toBe(true)
 expect(normalizeUnknownProductCosts({purchase_price:null,foreign_purchase_price:null},false)).toEqual({})
})

it('hydrates omitted variant cost with organization and product scoping and rejects foreign IDs',async()=>{
 const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),in:vi.fn().mockResolvedValue({data:[{id:'owned',purchase_price:27}],error:null})}
 const client={from:()=>q} as never
 const body=await prepareProductCostInput(client,{variants:[{id:'owned',purchasePrice:null},{name:'new'}]},'B','product')
 expect(body.variants).toEqual([{id:'owned',purchasePrice:27},{name:'new',purchasePrice:0}])
 expect(q.eq).toHaveBeenCalledWith('organization_id','B');expect(q.eq).toHaveBeenCalledWith('product_id','product')
 await expect(prepareProductCostInput(client,{variants:[{id:'foreign'}]},'B','product')).rejects.toThrow('no pertenece')
})
it('fails closed when membership cannot be verified even with caller-provided admin role',async()=>{
 const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})}
 expect(await resolveOrganizationProductCostAccess({from:()=>q} as never,{userId:'u',organizationId:'B',organizationRole:'admin'})).toEqual({canReadCost:false,canWriteCost:false})
 q.maybeSingle.mockResolvedValue({data:null,error:{message:'offline'}} as never)
 await expect(resolveOrganizationProductCostAccess({from:()=>q} as never,{userId:'u',organizationId:'B'})).rejects.toThrow('verificar')
})
