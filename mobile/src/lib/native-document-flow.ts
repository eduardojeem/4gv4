export type PrintableDocument = { html: string; width?: number; height?: number }
export async function outputNativeDocument(
  document: PrintableDocument,
  action: 'print' | 'pdf',
  deps: {
    assertContext: () => void
    print: (document: PrintableDocument) => Promise<void>
    available: () => Promise<boolean>
    file: (document: PrintableDocument) => Promise<{ uri: string }>
    share: (uri: string) => Promise<void>
    remove: (uri: string) => void
  },
) {
  if (!document.html?.trim()) throw new Error('El comprobante está incompleto. Volvé a intentarlo.')
  deps.assertContext()
  if (action === 'print') {
    await deps.print(document)
    return
  }
  if (!(await deps.available())) throw new Error('Este teléfono no permite compartir archivos.')
  deps.assertContext()
  const { uri } = await deps.file(document)
  try {
    deps.assertContext()
    await deps.share(uri)
  } finally {
    try {
      deps.remove(uri)
    } catch {
      /* Archivo temporal; no altera la operación original. */
    }
  }
}
