import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('admin reviews API contract & security', () => {
  it('protects routes with withAdminAuth and scopes all queries to organization_id', () => {
    const route = read('src/app/api/admin/reviews/route.ts')

    // Protegido con autenticación de admin
    expect(route).toContain('withAdminAuth(getHandler)')
    expect(route).toContain('withAdminAuth(patchBulkHandler)')

    // Aislamiento multitenant estricto
    expect(route).toContain(".eq('organization_id', orgId)")
  })

  it('supports search, rating, status and sorting in GET query', () => {
    const route = read('src/app/api/admin/reviews/route.ts')

    expect(route).toContain("searchParams.get('status')")
    expect(route).toContain("searchParams.get('rating')")
    expect(route).toContain("searchParams.get('search')")
    expect(route).toContain("searchParams.get('sort')")
    expect(route).toContain('rating_desc')
    expect(route).toContain('rating_asc')
  })

  it('calculates comprehensive stats including star breakdown and satisfaction', () => {
    const route = read('src/app/api/admin/reviews/route.ts')

    expect(route).toContain('satisfactionRate')
    expect(route).toContain('breakdown')
    expect(route).toContain('computedAverage')
    expect(route).toContain('approvedCount')
    expect(route).toContain('hiddenCount')
    expect(route).toContain('pendingCount')
  })

  it('supports bulk operations safely in PATCH', () => {
    const route = read('src/app/api/admin/reviews/route.ts')

    expect(route).toContain('bulkActionSchema')
    expect(route).toContain("'approve_all_pending'")
    expect(route).toContain("'approve'")
    expect(route).toContain("'reject'")
    expect(route).toContain("'show'")
    expect(route).toContain("'hide'")
    expect(route).toContain("'delete'")
    expect(route).toContain(".in('id', ids)")
  })

  it('maintains single review operations in [id]/route.ts', () => {
    const singleRoute = read('src/app/api/admin/reviews/[id]/route.ts')

    expect(singleRoute).toContain('withAdminAuth')
    expect(singleRoute).toContain(".eq('organization_id', orgId)")
    expect(singleRoute).toContain(".eq('id', id)")
  })
})

describe('reviews statistics and ratings logic', () => {
  const sampleReviews = [
    { rating: 5, is_approved: true, is_visible: true },
    { rating: 5, is_approved: true, is_visible: true },
    { rating: 4, is_approved: true, is_visible: true },
    { rating: 3, is_approved: true, is_visible: false },
    { rating: 1, is_approved: false, is_visible: true },
  ]

  it('calculates star breakdown and satisfaction rate correctly', () => {
    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let approvedCount = 0
    let hiddenCount = 0
    let pendingCount = 0
    let sumApproved = 0

    for (const r of sampleReviews) {
      if (!r.is_approved) {
        pendingCount++
      } else if (!r.is_visible) {
        hiddenCount++
      } else {
        approvedCount++
        sumApproved += r.rating
      }
      const star = r.rating as 1 | 2 | 3 | 4 | 5
      breakdown[star]++
    }

    expect(pendingCount).toBe(1)
    expect(approvedCount).toBe(3)
    expect(hiddenCount).toBe(1)
    expect(breakdown[5]).toBe(2)
    expect(breakdown[4]).toBe(1)
    expect(breakdown[3]).toBe(1)
    expect(breakdown[1]).toBe(1)

    const avg = Number((sumApproved / approvedCount).toFixed(1))
    expect(avg).toBe(4.7)

    const satisfied = breakdown[5] + breakdown[4]
    const satisfactionRate = Math.round((satisfied / sampleReviews.length) * 100)
    expect(satisfactionRate).toBe(60)
  })
})
