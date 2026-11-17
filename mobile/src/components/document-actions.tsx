import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { apiFetch } from '@/lib/api'
import { getPrivateCacheContext } from '@/lib/private-cache-context'
import { outputDocument } from '@/lib/native-document'
import type { PrintableDocument } from '@/lib/native-document-flow'
import { usePalette, palette } from '@/lib/palette'
export function DocumentActions({
  path,
  title,
  labels = false,
  whatsappPdf = false,
}: {
  path: string
  title: string
  labels?: boolean
  whatsappPdf?: boolean
}) {
  const sequence = useRef(0)
  useEffect(
    () => () => {
      sequence.current++
    },
    [path],
  )
  const c = usePalette(),
    lock = useRef(false)
  const [paper, setPaper] = useState(labels ? 'A4' : 'configured'),
    [type, setType] = useState('customer'),
    [quantity, setQuantity] = useState('1'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null)
  const action = async (mode: 'print' | 'pdf' | 'whatsapp') => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(null)
    const epoch = getPrivateCacheContext().epoch,
      id = sequence.current
    try {
      if (labels && (!/^\d+$/.test(quantity) || Number(quantity) < 1 || Number(quantity) > 100))
        throw new Error('Elegí entre 1 y 100 etiquetas.')
      const query = new URLSearchParams({
        paper,
        type: mode === 'whatsapp' ? 'customer' : type,
        ...(labels ? { quantity } : {}),
      })
      const document = await apiFetch<PrintableDocument>(path + '?' + query)
      if (id !== sequence.current) return
      await outputDocument(document, mode === 'whatsapp' ? 'pdf' : mode, epoch, () => {
        if (id !== sequence.current) throw new Error('Se cerró el documento. Volvé a abrirlo.')
      })
    } catch (e) {
      if (epoch === getPrivateCacheContext().epoch)
        setError(e instanceof Error ? e.message : 'No pudimos preparar el documento.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={{
        minHeight: 44,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: selected ? palette.primary : c.border,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: selected ? palette.primary : c.text }}>{label}</Text>
    </Pressable>
  )
  return (
    <View
      style={{
        padding: 16,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 16,
        gap: 10,
        backgroundColor: c.card,
      }}
    >
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
      {!labels && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {chip('customer', 'Para el cliente', type === 'customer', () => setType('customer'))}
          {chip('technician', 'Ficha técnica simple', type === 'technician', () =>
            setType('technician'),
          )}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(labels
          ? [
              ['A4', 'Hoja A4'],
              ['58mm', 'Etiqueta 50 × 25 mm'],
              ['80mm', 'Rollo 80 mm'],
            ]
          : [
              ['configured', 'Según el negocio'],
              ['58mm', '58 mm'],
              ['80mm', '80 mm'],
              ['A4', 'A4'],
            ]
        ).map(([key, label]) => chip(key, label, paper === key, () => setPaper(key)))}
      </View>
      {labels && (
        <>
          <Text style={{ color: c.muted }}>Cantidad de etiquetas (1 a 100)</Text>
          <TextInput
            accessibilityLabel="Cantidad de etiquetas"
            editable={!busy}
            keyboardType="number-pad"
            maxLength={3}
            value={quantity}
            onChangeText={setQuantity}
            style={{
              minHeight: 44,
              padding: 10,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 10,
              color: c.text,
            }}
          />
        </>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(whatsappPdf ? (['print', 'pdf', 'whatsapp'] as const) : (['print', 'pdf'] as const)).map(
          (mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void action(mode)}
              style={{
                minHeight: 44,
                padding: 12,
                borderRadius: 10,
                backgroundColor: palette.primary,
                justifyContent: 'center',
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {mode === 'print'
                  ? 'Imprimir'
                  : mode === 'whatsapp'
                    ? 'PDF para WhatsApp'
                    : 'Compartir PDF'}
              </Text>
            </Pressable>
          ),
        )}
      </View>
      {whatsappPdf && (
        <Text style={{ color: c.muted, fontSize: 12 }}>
          PDF para WhatsApp genera el comprobante del cliente. En Compartir elegí WhatsApp y después
          el chat; el envío se confirma allí.
        </Text>
      )}
      {busy && (
        <ActivityIndicator accessibilityLabel="Preparando documento" color={palette.primary} />
      )}
      {error && (
        <Text accessibilityRole="alert" style={{ color: c.dangerText }}>
          {error}
        </Text>
      )}
      <Text style={{ color: c.muted, fontSize: 12 }}>
        Se abre el servicio de impresión o de archivos del teléfono. No registra una nueva
        operación.
      </Text>
    </View>
  )
}
