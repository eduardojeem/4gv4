import { beforeEach, describe, expect, it, vi } from 'vitest'
import { outputNativeDocument } from '../../mobile/src/lib/native-document-flow'
describe('impresión nativa sin repetir operaciones', () => {
  const deps = {
    assertContext: vi.fn(),
    print: vi.fn(async () => {}),
    available: vi.fn(async () => true),
    file: vi.fn(async () => ({ uri: 'cache://receipt.pdf' })),
    share: vi.fn(async () => {}),
    remove: vi.fn(),
  }
  beforeEach(() => {
    vi.clearAllMocks()
    deps.assertContext.mockImplementation(() => {})
    deps.available.mockResolvedValue(true)
    deps.share.mockResolvedValue(undefined)
  })
  it('imprime HTML sin generar archivos ni compartir', async () => {
    await outputNativeDocument({ html: '<p>Comprobante</p>' }, 'print', deps)
    expect(deps.print).toHaveBeenCalledOnce()
    expect(deps.file).not.toHaveBeenCalled()
    expect(deps.share).not.toHaveBeenCalled()
  })
  it('borra el PDF temporal después de compartir', async () => {
    await outputNativeDocument({ html: '<p>Recibo</p>' }, 'pdf', deps)
    expect(deps.share).toHaveBeenCalledWith('cache://receipt.pdf')
    expect(deps.remove).toHaveBeenCalledWith('cache://receipt.pdf')
  })
  it('borra el PDF también si falla compartir', async () => {
    deps.share.mockRejectedValueOnce(new Error('cancelado'))
    await expect(outputNativeDocument({ html: 'HTML' }, 'pdf', deps)).rejects.toThrow('cancelado')
    expect(deps.remove).toHaveBeenCalledOnce()
  })
  it('no comparte tras cambiar de negocio y limpia el archivo ya generado', async () => {
    let checks = 0
    deps.assertContext.mockImplementation(() => {
      if (++checks === 3) throw new Error('Otra cuenta')
    })
    await expect(outputNativeDocument({ html: 'HTML' }, 'pdf', deps)).rejects.toThrow('Otra cuenta')
    expect(deps.share).not.toHaveBeenCalled()
    expect(deps.remove).toHaveBeenCalledOnce()
  })
  it('rechaza el documento vacío y un teléfono sin compartir archivos', async () => {
    await expect(outputNativeDocument({ html: '' }, 'print', deps)).rejects.toThrow('incompleto')
    deps.available.mockResolvedValue(false)
    await expect(outputNativeDocument({ html: 'HTML' }, 'pdf', deps)).rejects.toThrow('no permite')
    expect(deps.file).not.toHaveBeenCalled()
  })
})
