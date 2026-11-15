import {expect,it} from 'vitest'
import {filterDashboardNavGroups,getBusinessFocusSection,getMobileDashboardItems} from '@/config/dashboard-navigation'
import {getDashboardPermissionsForOrganizationRole} from '@/lib/auth/organization-dashboard-permissions'
import {mapOrganizationRoleToDashboardRole} from '@/lib/auth/section-access'
import {roleHasPermission,type OrganizationRole} from '@/lib/saas/permissions'
import {buildPanelQuickActions} from '../../mobile/src/lib/panel-nav-model'
import type {PanelData} from '../../mobile/src/lib/panel'
for(const organizationRole of ['owner','admin','cashier','technician'] as OrganizationRole[]){
 it(`keeps ${organizationRole} permissions when choosing the primary activity`,()=>{
  const permissions=new Set(getDashboardPermissionsForOrganizationRole(organizationRole))
  const groups=filterDashboardNavGroups({role:mapOrganizationRoleToDashboardRole(organizationRole),effectiveModules:['services','repairs','pos'],hasPermission:p=>permissions.has(p),operatingModel:'mixed'})
  expect(getBusinessFocusSection(groups,'general','mixed','agenda')).toBe('agenda')
  const data={organization:{primaryActivity:'agenda'},businessFocus:'agenda',groups,capabilities:{'agenda.create':roleHasPermission(organizationRole,'pos.sales.read'),'repairs.orders.create':roleHasPermission(organizationRole,'repairs.orders.create'),'pos.sales.create':roleHasPermission(organizationRole,'pos.sales.create')}} as unknown as PanelData
  const actions=buildPanelQuickActions(data)
  expect(actions[0].sectionKey).toBe('agenda')
  expect(actions.some(action=>action.sectionKey==='repairs')).toBe(roleHasPermission(organizationRole,'repairs.orders.create'))
 })
}
it('switches organization configuration without keeping the previous focus or catalog label',()=>{
 const serviceGroups=filterDashboardNavGroups({role:'admin',effectiveModules:['services','pos'],hasPermission:()=>true,operatingModel:'service'})
 const retailGroups=filterDashboardNavGroups({role:'admin',effectiveModules:['inventory','pos'],hasPermission:()=>true,operatingModel:'retail'})
 expect(getMobileDashboardItems(serviceGroups,4,'general','service','agenda').some(item=>item.key==='agenda')).toBe(true)
 expect(getMobileDashboardItems(retailGroups,4,'general','retail','agenda').some(item=>item.key==='agenda')).toBe(false)
 expect(retailGroups.flatMap(group=>group.items).find(item=>item.key==='products')?.label).toBe('Productos')
})
it('never creates an agenda action without its capability',()=>{
 const data={organization:{primaryActivity:'agenda'},businessFocus:'agenda',groups:[{items:[{key:'agenda'}]}],capabilities:{'agenda.create':false}} as unknown as PanelData
 expect(buildPanelQuickActions(data)).toEqual([])
})