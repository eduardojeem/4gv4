import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const operationalRoutes = [
  'src/app/api/repairs/analytics/route.ts',
  'src/app/api/repairs/inventory/route.ts',
  'src/app/api/repairs/priority/route.ts',
  'src/app/api/repairs/sign/route.ts',
  'src/app/api/repairs/communications/whatsapp/route.ts',
  'src/app/api/repairs/technicians/[id]/compensation/route.ts',
  'src/app/api/repairs/technicians/[id]/payments/route.ts',
  'src/app/api/repairs/technicians/[id]/payments/[paymentId]/route.ts',
  'src/app/api/repairs/technicians-stats/route.ts',
  'src/app/api/repairs/usage/route.ts',
  'src/app/api/repairs/[id]/status/route.ts',
]

describe('repair API organization module gates', () => {
  it.each(operationalRoutes)('blocks operational endpoint %s through the centralized gate', (path) => {
    expect(read(path)).toContain('resolveRepairModuleContext')
  })

  it('keeps public QR verification available for historical receipts', () => {
    const source = read('src/app/api/repairs/verify-qr/route.ts')
    expect(source).not.toContain('resolveRepairModuleContext')
    expect(source).toContain('verifyRepairHash')
  })
})
