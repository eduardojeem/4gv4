import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { File } from 'expo-file-system'
import { Platform } from 'react-native'
import { getPrivateCacheContext } from './private-cache-context'
import { outputNativeDocument, type PrintableDocument } from './native-document-flow'
export function outputDocument(
  document: PrintableDocument,
  action: 'print' | 'pdf',
  epoch: number,
  assertCurrent?: () => void,
) {
  if (Platform.OS === 'web' && action === 'pdf')
    throw new Error('Compartí el PDF desde la aplicación móvil.')
  return outputNativeDocument(document, action, {
    assertContext: () => {
      assertCurrent?.()
      if (getPrivateCacheContext().epoch !== epoch)
        throw new Error(
          'Cambió la cuenta, sucursal o los permisos. Abrí el comprobante nuevamente.',
        )
    },
    print: async (options) => {
      await Print.printAsync(options)
    },
    available: () => Sharing.isAvailableAsync(),
    file: (options) => Print.printToFileAsync(options),
    share: (uri) =>
      Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Compartir documento',
      }),
    remove: (uri) => new File(uri).delete(),
  })
}
