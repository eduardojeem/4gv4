import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  deleteEq: vi.fn(),
  selectEq: vi.fn(),
  maybeSingle: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
  assertRepairExists: vi.fn(),
  fetchRepairById: vi.fn(),
  planInfo: vi.fn(),
  existingPhotos: 0,
}))

const selectBuilder = {
  eq: mocks.selectEq,
  maybeSingle: mocks.maybeSingle,
}
mocks.selectEq.mockReturnValue(selectBuilder)

const deleteResult = { error: null }
const deleteBuilder = {
  eq: mocks.deleteEq,
  then: (resolve: (value: typeof deleteResult) => void) => resolve(deleteResult),
}
mocks.deleteEq.mockReturnValue(deleteBuilder)

vi.mock('@/app/api/repairs/_lib', () => ({
  resolveRepairRouteContext: vi.fn(async () => ({
    supabase: {
      from: mocks.from,
      storage: { from: vi.fn(() => ({ remove: mocks.remove })) },
    },
    userId: 'user-1',
    organizationId: 'org-1',
    branchId: 'branch-1',
  })),
  isNextResponse: vi.fn(() => false),
  assertRepairExists: mocks.assertRepairExists,
  fetchRepairById: mocks.fetchRepairById,
}))

vi.mock('@/lib/saas/subscription-service', () => ({ getOrganizationPlanInfo: mocks.planInfo }))

import { DELETE, POST } from './route'

function requestWithJson(body: unknown) {
  return { json: vi.fn(async () => body) } as never
}

const context = { params: Promise.resolve({ id: 'repair-1' }) }

describe('/api/repairs/[id]/images private image contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectEq.mockReturnValue(selectBuilder)
    mocks.deleteEq.mockReturnValue(deleteBuilder)
    mocks.assertRepairExists.mockResolvedValue(true)
    mocks.fetchRepairById.mockResolvedValue({ data: { id: 'repair-1' }, error: null })
    mocks.insert.mockResolvedValue({ error: null })
    mocks.remove.mockResolvedValue({ data: null, error: null })
    mocks.maybeSingle.mockResolvedValue({
      data: { id: 'image-1', image_url: 'repairs/repair-1/photo.jpg' },
      error: null,
    })
    mocks.existingPhotos = 0
    mocks.planInfo.mockResolvedValue({ name: 'Pro Max', repairPhotoLimit: 20, repairPhotoUpgradePlan: 'Pro' })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'repair_images') throw new Error(`Unexpected table ${table}`)
      return {
        insert: mocks.insert,
        // Con `head` es el conteo de fotos ya cargadas en la reparación.
        select: vi.fn((_columns: string, options?: { head?: boolean }) => options?.head
          ? { eq: vi.fn(async () => ({ count: mocks.existingPhotos, error: null })) }
          : selectBuilder),
        delete: vi.fn(() => deleteBuilder),
      }
    })
  })

  it('respeta el cupo de fotos por reparación del plan', async () => {
    mocks.planInfo.mockResolvedValue({ name: 'Pro', repairPhotoLimit: 3, repairPhotoUpgradePlan: 'Pro' })
    mocks.existingPhotos = 3
    const response = await POST(requestWithJson({
      images: [{ storagePath: 'organizations/org-1/repair-images/user-1/photo.jpg' }],
    }), context)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Tu plan permite hasta 3 fotos por reparación.' })
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('sin fotos en el plan nombra el plan que las incluye', async () => {
    mocks.planInfo.mockResolvedValue({ name: 'Gratis', repairPhotoLimit: 0, repairPhotoUpgradePlan: 'Pro' })
    const response = await POST(requestWithJson({
      images: [{ storagePath: 'organizations/org-1/repair-images/user-1/photo.jpg' }],
    }), context)

    expect(response.status).toBe(402)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Tu plan Gratis no incluye fotos en las reparaciones. Están disponibles en el plan Pro.',
    })
  })

  it('attaches only normalized storage paths', async () => {
    const response = await POST(requestWithJson({
      images: [{
        storagePath: 'organizations/org-1/repair-images/user-1/photo.jpg',
        description: 'Frente',
        imageType: 'intake',
      }],
    }), context)

    expect(response.status).toBe(200)
    expect(mocks.insert).toHaveBeenCalledWith([{
      repair_id: 'repair-1',
      image_url: 'organizations/org-1/repair-images/user-1/photo.jpg',
      image_type: 'intake',
      description: 'Frente',
      uploaded_by: 'user-1',
    }])
  })

  it('rejects an arbitrary URL without inserting it', async () => {
    const response = await POST(requestWithJson({
      images: [{ storagePath: 'https://attacker.example/photo.jpg' }],
    }), context)

    expect(response.status).toBe(400)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('rejects a normalized path owned by another organization', async () => {
    const response = await POST(requestWithJson({
      images: [{ storagePath: 'organizations/org-other/repair-images/user-1/photo.jpg' }],
    }), context)

    expect(response.status).toBe(400)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('loads by image id and repair id before deleting the stored object', async () => {
    const response = await DELETE(requestWithJson({ imageId: 'image-1' }), context)

    expect(response.status).toBe(200)
    expect(mocks.selectEq).toHaveBeenNthCalledWith(1, 'id', 'image-1')
    expect(mocks.selectEq).toHaveBeenNthCalledWith(2, 'repair_id', 'repair-1')
    expect(mocks.deleteEq).toHaveBeenCalledWith('repair_id', 'repair-1')
    expect(mocks.deleteEq).toHaveBeenCalledWith('id', 'image-1')
    expect(mocks.remove).toHaveBeenCalledWith(['repairs/repair-1/photo.jpg'])
  })

  it('denies an image id that belongs to another repair', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await DELETE(requestWithJson({ imageId: 'image-other' }), context)

    expect(response.status).toBe(404)
    expect(mocks.deleteEq).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('keeps the database row retryable when Storage deletion fails', async () => {
    mocks.remove.mockResolvedValue({ data: null, error: new Error('storage unavailable') })

    const response = await DELETE(requestWithJson({ imageId: 'image-1' }), context)

    expect(response.status).toBe(500)
    expect(mocks.deleteEq).not.toHaveBeenCalled()
  })
})
