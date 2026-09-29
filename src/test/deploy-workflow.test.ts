import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/deploy.yml'), 'utf8')

describe('workflow de despliegue', () => {
  it('usa el CLI de Vercel fijado a una versión en lugar de una Action inexistente', () => {
    expect(workflow).not.toContain('vercel/action@')
    expect(workflow).toContain('npx --yes vercel@61.0.0 pull --yes --environment=production')
    expect(workflow).toContain('npx --yes vercel@61.0.0 build --prod')
    expect(workflow).toContain('npx --yes vercel@61.0.0 deploy --prebuilt --prod --yes')
    expect(workflow).toContain('VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}')
    expect(workflow).toContain('VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}')
    expect(workflow).toContain('--token=${{ secrets.VERCEL_TOKEN }}')
  })

  it('cancela despliegues obsoletos cuando main recibe un commit más nuevo', () => {
    expect(workflow).toContain('group: production-deploy')
    expect(workflow).toContain('cancel-in-progress: true')
  })
})
