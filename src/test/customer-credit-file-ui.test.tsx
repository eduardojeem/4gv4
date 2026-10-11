import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ role: 'owner' }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { role: state.role } }) }))
vi.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }))
import { CustomerCreditFile } from '@/components/dashboard/customers/credit-file/CustomerCreditFile'
import { CreditFileDocuments } from '@/components/dashboard/customers/credit-file/CreditFileDocuments'
const policy = { version: 0, mode: 'informational', requireIdentity: false, minVerifiedReferences: 0, requiredDocuments: [] }
const file = { version: 1, status: 'draft', identity: { type: 'ci', number: '' }, occupation: '', company: '', position: '', declaredMonthlyIncome: null, informedCustomerAt: null, references: [], documents: [], lastDecision: null }
const summary = { status: 'draft', mode: 'informational', missing: ['approval'], limit: 0, outstanding: 0, available: 0, overdueCount: 0, eligible: false }
beforeEach(() => {
  state.role = 'owner'
  vi.stubGlobal('fetch', vi.fn(async (url, options) => new Response(JSON.stringify(String(url).endsWith('/summary') ? { summary } : { success: true, file: options?.method ? file : null, policy }), { status: 200 })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('customer credit file management UI', () => {
  it('keeps an unsaved document comment after a review conflict or failed reload', async () => {
    const current = {...file,documents:[{id:'document',type:'identity',filename:'fixture.jpg',lifecycle:'ready',reviewStatus:'pending',reviewedAt:null,reviewedBy:null,comment:'A'}]}
    let failReload = false
    vi.mocked(fetch).mockImplementation(async (url, options) => new Response(JSON.stringify(String(url).endsWith('/summary') ? {summary} : options?.method ? {error:'La ficha cambió',code:'CREDIT_FILE_VERSION_CONFLICT'} : failReload ? {error:'No disponible'} : {file:current,policy}),{status:options?.method ? 409 : failReload ? 503 : 200}))
    const confirm = vi.spyOn(window,'confirm').mockReturnValue(true)
    render(<CustomerCreditFile customerId="customer" onCustomerUpdated={() => {}} />)
    fireEvent.change(await screen.findByLabelText('Comentario para fixture.jpg'),{target:{value:'Mi revisión pendiente'}})
    fireEvent.click(screen.getByRole('button',{name:'Verificar documento'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('La ficha cambió')
    expect(screen.getByLabelText('Comentario para fixture.jpg')).toHaveValue('Mi revisión pendiente')
    failReload = true
    fireEvent.click(screen.getByRole('button',{name:'Recargar ficha'}))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No disponible'))
    expect(screen.getByLabelText('Comentario para fixture.jpg')).toHaveValue('Mi revisión pendiente')
    confirm.mockRestore()
  })
  it('confirms discarding document drafts, reloads the accepted comment and preserves it in review', async () => {
    let current = {...file, documents:[{id:'document',type:'identity',filename:'fixture.jpg',lifecycle:'ready',reviewStatus:'pending',reviewedAt:null,reviewedBy:null,comment:'A'}]}
    const confirm = vi.spyOn(window,'confirm').mockReturnValue(false)
    vi.mocked(fetch).mockImplementation(async url => new Response(JSON.stringify(String(url).endsWith('/summary') ? {summary} : {file:current,policy})))
    render(<CustomerCreditFile customerId="customer" onCustomerUpdated={() => {}} />)
    const comment = await screen.findByLabelText('Comentario para fixture.jpg')
    fireEvent.change(comment,{target:{value:'Borrador local'}})
    current = {...current,version:2,documents:[{...current.documents[0],comment:'B'}]}
    fireEvent.click(screen.getByRole('button',{name:'Recargar ficha'}))
    expect(confirm).toHaveBeenCalled()
    expect(comment).toHaveValue('Borrador local')
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button',{name:'Recargar ficha'}))
    await waitFor(() => expect(screen.getByLabelText('Comentario para fixture.jpg')).toHaveValue('B'))
    fireEvent.click(screen.getByRole('button',{name:'Verificar documento'}))
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([,options]) => options?.method === 'PATCH')).toBe(true))
    const call = vi.mocked(fetch).mock.calls.find(([,options]) => options?.method === 'PATCH')!
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({version:2,comment:'B'})
    confirm.mockRestore()
  })
  it('refreshes the operational summary after changing organization requirements', async () => {
    let currentPolicy = policy
    vi.mocked(fetch).mockImplementation(async (url,options) => {
      if (options?.method === 'PUT') currentPolicy = {...policy,version:1,mode:'warning'}
      return new Response(JSON.stringify(String(url).endsWith('/summary') ? {summary:{...summary,mode:currentPolicy.mode}} : {file,policy:currentPolicy}))
    })
    render(<CustomerCreditFile customerId="customer" onCustomerUpdated={() => {}} />)
    await screen.findByLabelText('Modo de control')
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/summary'))).toBe(true))
    const before = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/summary')).length
    fireEvent.change(screen.getByLabelText('Modo de control'),{target:{value:'warning'}})
    fireEvent.click(screen.getByRole('button',{name:'Guardar requisitos'}))
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/summary')).length).toBeGreaterThan(before))
  })
  it('ignores a save result after switching customer instead of refreshing the previous detail', async () => {
    let resolveSave!: (response: Response) => void
    const updated = vi.fn()
    vi.mocked(fetch).mockImplementation(async (url, options) => {
      if (options?.method === 'PUT') return new Promise<Response>(resolve => { resolveSave = resolve })
      return new Response(JSON.stringify(String(url).endsWith('/summary') ? { summary } : { file: null, policy }))
    })
    const view = render(<CustomerCreditFile customerId="first" onCustomerUpdated={updated} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar ficha' }))
    await waitFor(() => expect(resolveSave).toBeDefined())
    view.rerender(<CustomerCreditFile customerId="second" onCustomerUpdated={updated} />)
    await screen.findByLabelText('Número de documento')
    await act(async () => { resolveSave(new Response(JSON.stringify({ file, policy }))); await Promise.resolve() })
    expect(updated).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Número de documento')).toHaveValue('')
  })
  it('saves optional income as null without approving a customer', async () => {
    render(<CustomerCreditFile customerId="cf240000-0000-4000-8000-000000000001" onCustomerUpdated={() => {}} />)
    const save = await screen.findByRole('button', { name: 'Guardar ficha' })
    expect(screen.getByLabelText(/Informé al cliente/)).not.toBeChecked()
    fireEvent.click(save)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([,options]) => options?.method === 'PUT')).toBe(true))
    const call = vi.mocked(fetch).mock.calls.find(([,options]) => options?.method === 'PUT')!
    expect(call[0]).not.toContain('decision')
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({ declaredMonthlyIncome: null, informedCustomer: false })
    expect(screen.getByText('Una referencia no es un garante.')).toBeInTheDocument()
  })
  it('does not load private information for a seller', () => {
    state.role = 'seller'
    render(<CustomerCreditFile customerId="customer" onCustomerUpdated={() => {}} />)
    expect(screen.getByText(/Solo propietario/)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Ingreso mensual declarado')).not.toBeInTheDocument()
  })
  it('keeps edits on a conflict and offers reload', async () => {
    vi.mocked(fetch).mockImplementation(async (url, options) => new Response(JSON.stringify(String(url).endsWith('/summary') ? { summary } : options?.method ? { error: 'La ficha cambió. Recargá.', code: 'CREDIT_FILE_VERSION_CONFLICT' } : { file: null, policy }), { status: options?.method ? 409 : 200 }))
    render(<CustomerCreditFile customerId="customer" onCustomerUpdated={() => {}} />)
    const number = await screen.findByLabelText('Número de documento')
    fireEvent.change(number, { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La ficha cambió')
    expect(number).toHaveValue('12345')
    expect(screen.getByRole('button', { name: 'Recargar ficha' })).toBeInTheDocument()
  })
  it('caps references at five and exposes a manual verification choice', async () => {
    render(<CustomerCreditFile customerId="customer" onCustomerUpdated={() => {}} />)
    const add = await screen.findByRole('button', { name: /Agregar referencia/ })
    for (let index = 0; index < 5; index++) fireEvent.click(add)
    expect(add).toBeDisabled()
    expect(screen.getAllByText('Verificada manualmente').length).toBe(5)
  })
  it('requires explicit confirmation before enabling mandatory approval', async () => {
    render(<CustomerCreditFile customerId="customer" onCustomerUpdated={() => {}} />)
    fireEvent.change(await screen.findByLabelText('Modo de control'), { target: { value: 'required' } })
    const save = screen.getByRole('button', { name: 'Guardar requisitos' })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/Entiendo que se bloquearán/))
    expect(save).toBeEnabled()
  })
  it('shows unavailable migrations with a reload action', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'La ficha no está disponible. Revisá las migraciones.' }), { status: 503 }))
    render(<CustomerCreditFile customerId="customer" onCustomerUpdated={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('migraciones')
    expect(screen.getByRole('button', { name: 'Recargar ficha' })).toBeEnabled()
  })
  it('confirms document retirement before sending DELETE', async () => {
    const withDocument = { ...file, documents: [{ id: 'document', type: 'identity', filename: 'fixture.jpg', mimeType: 'image/jpeg', byteSize: 8, lifecycle: 'ready', reviewStatus: 'pending', reviewedAt: null, reviewedBy: null, comment: '' }] }
    vi.mocked(fetch).mockImplementation(async url => new Response(JSON.stringify(String(url).endsWith('/summary') ? { summary } : { file: withDocument, policy })))
    render(<CustomerCreditFile customerId="customer" onCustomerUpdated={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retirar', exact: true }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('La deuda no cambia')
    expect(vi.mocked(fetch).mock.calls.some(([,options]) => options?.method === 'DELETE')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Retirar documento' }))
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([,options]) => options?.method === 'DELETE')).toBe(true))
  })
  it('uploads a photo without automatically marking it verified', async () => {
    const action = vi.fn(async () => ({}))
    render(<CreditFileDocuments customerId="fixture" documents={[]} version={2} disabled={false} action={action} />)
    fireEvent.change(screen.getByLabelText('Archivo o foto'), { target: { files: [new File(['fixture'], 'fixture.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(screen.getByRole('button', { name: /Subir documento/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Todavía requiere revisión manual')
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith('/documents', 'POST', expect.any(FormData))
    expect(action.mock.calls[0][2].get('version')).toBe('2')
  })
  it('does not allow another upload when ten document slots are occupied', () => {
    const documents = Array.from({ length: 10 }, (_, index) => ({ id: String(index), type: 'identity' as const, filename: `fixture-${index}.jpg`, lifecycle: 'pending' as const, reviewStatus: 'pending' as const, reviewedAt: null, reviewedBy: null, comment: '' }))
    const action = vi.fn(async () => ({}))
    render(<CreditFileDocuments customerId="fixture" documents={documents} version={10} disabled={false} action={action} />)
    fireEvent.change(screen.getByLabelText('Archivo o foto'), { target: { files: [new File(['fixture'], 'fixture.jpg', { type: 'image/jpeg' })] } })
    expect(screen.getByRole('button', { name: 'Subir documento (10/10)' })).toBeDisabled()
    expect(action).not.toHaveBeenCalled()
  })
  it('warns on a different identity without silently replacing the customer RUC', async () => {
    render(<CustomerCreditFile customerId="fixture" existingRuc="RUC-FICTICIO" onCustomerUpdated={() => {}} />)
    fireEvent.change(await screen.findByLabelText('Número de documento'), { target: { value: 'CI-FICTICIA' } })
    expect(screen.getByText(/no reemplazará sus datos generales/)).toHaveTextContent('RUC-FICTICIO')
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method)).toBe(false)
  })
})
