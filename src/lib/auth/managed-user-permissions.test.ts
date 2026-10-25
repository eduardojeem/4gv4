// @vitest-environment node
import { expect,it } from 'vitest'
import { syncManagedUserPermissions,isManagedPermissionVisible } from './managed-user-permissions'
it('saves/revokes exact organization grants while retaining foreign organization and legacy NULL grants',async()=>{
 const rows=[{user_id:'u',organization_id:'A' as string|null,permission:'products.read_cost',is_active:true},{user_id:'u',organization_id:null,permission:'products.read_cost',is_active:true},{user_id:'u',organization_id:'B',permission:'products.update_cost',is_active:true}]
 const client={from:()=>{
  const filters:Record<string,unknown>={};let patch:Record<string,unknown>|undefined;let inserted:typeof rows|undefined
  const q={select:()=>q,eq:(key:string,value:unknown)=>{filters[key]=value;return q},in:(key:string,value:unknown)=>{filters[key]=value;return q},insert:(values:typeof rows)=>{inserted=values;return q},update:(value:Record<string,unknown>)=>{patch=value;return q},then:(resolve:(value:unknown)=>unknown)=>{
   if(inserted)rows.push(...inserted)
   if(patch)rows.filter(row=>Object.entries(filters).every(([key,value])=>Array.isArray(value)?value.includes(row[key as keyof typeof row]):row[key as keyof typeof row]===value)).forEach(row=>Object.assign(row,patch))
   return Promise.resolve({data:rows.filter(row=>row.is_active),error:null}).then(resolve)
  }};return q
 }}
 await syncManagedUserPermissions(client as never,'u','B',['products.read_cost'])
 expect(rows.filter(row=>row.organization_id==='A'||row.organization_id===null).every(row=>row.is_active)).toBe(true)
 expect(rows.find(row=>row.organization_id==='B'&&row.permission==='products.update_cost')?.is_active).toBe(false)
 expect(rows.find(row=>row.organization_id==='B'&&row.permission==='products.read_cost')?.is_active).toBe(true)
})
it('does not present legacy or other organization cost grants as effective',()=>{
 expect(isManagedPermissionVisible({permission:'products.read_cost',organization_id:null},'B')).toBe(false)
 expect(isManagedPermissionVisible({permission:'products.update_cost',organization_id:'A'},'B')).toBe(false)
 expect(isManagedPermissionVisible({permission:'products.update_cost',organization_id:'B'},'B')).toBe(true)
})
