import { expect, it } from 'vitest'
import { PERMISSIONS } from '@/lib/auth/roles-permissions'
import { PERMISSION_GROUPS } from '@/components/admin/users/permissions'
import { userPermissionsSchema } from '@/lib/admin/user-edit-validation'
it('exposes cost writing as an independent validated permission in the product group',()=>{
 expect(PERMISSIONS['products.update_cost'].action).toBe('update')
 expect(PERMISSION_GROUPS.find(group=>group.id==='products')?.permissions.some(p=>p.id==='products.update_cost')).toBe(true)
 expect(userPermissionsSchema.safeParse(['products.update_cost']).success).toBe(true)
 expect(userPermissionsSchema.safeParse(['products.fake_cost']).success).toBe(false)
})
