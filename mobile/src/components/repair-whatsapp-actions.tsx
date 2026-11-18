import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native'
import { BottomSheet } from './bottom-sheet'
import { apiFetch } from '@/lib/api'
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context'
import { usePalette } from '@/lib/palette'
type Draft = { phone: string; message: string; preparedAt: string; epoch: number; repairId: string }
export function RepairWhatsAppActions({ repairId,compact=false }: { repairId: string;compact?:boolean }) {
  const c = usePalette(),
    scope = useSyncExternalStore(subscribePrivateCacheContext, getPrivateCacheContext),
    sequence = useRef(0),
    lock = useRef(false)
  const [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<{ epoch: number; text: string } | null>(null)
  useEffect(
    () => () => {
      sequence.current++
    },
    [repairId],
  )
  const current = draft?.epoch === scope.epoch && draft.repairId === repairId ? draft : null
  const close = () => {
    sequence.current++
    setDraft(null)
    setError(null)
  }
  const prepare = async () => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(null)
    const epoch = getPrivateCacheContext().epoch,
      id = ++sequence.current
    try {
      const result = await apiFetch<Omit<Draft, 'epoch' | 'repairId'>>(
        '/api/repairs/' + encodeURIComponent(repairId) + '/share',
      )
      if (id !== sequence.current || epoch !== getPrivateCacheContext().epoch) return
      if (!/^[1-9]\d{7,14}$/.test(result.phone) || !result.message?.trim())
        throw new Error('El aviso está incompleto. Revisá los datos del cliente.')
      setDraft({ ...result, epoch, repairId })
    } catch (e) {
      if (id === sequence.current && epoch === getPrivateCacheContext().epoch)
        setError({ epoch, text: e instanceof Error ? e.message : 'No pudimos preparar el aviso.' })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const open = async () => {
    if (!current || current.epoch !== getPrivateCacheContext().epoch || !current.message.trim())
      return
    try {
      await Linking.openURL(
        'https://wa.me/' + current.phone + '?text=' + encodeURIComponent(current.message),
      )
    } catch {
      setError({
        epoch: current.epoch,
        text: 'No pudimos abrir WhatsApp. Revisá que esté instalado y volvé a intentar.',
      })
    }
  }
  const failure = error?.epoch === scope.epoch ? error.text : null
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Avisar estado por WhatsApp"
        disabled={busy}
        onPress={() => void prepare()}
        style={{
          minHeight: 44,
          padding: 12,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 12,
          justifyContent: 'center',
        }}
      >
        {busy ? (
          <ActivityIndicator color={c.text} />
        ) : (
          <Text style={{ color: c.text, fontWeight: '700' }}>{compact?'WhatsApp':'Avisar estado por WhatsApp'}</Text>
        )}
      </Pressable>
      {failure && !current && (
        <Text accessibilityRole="alert" style={{ color: c.dangerText }}>
          {failure}
        </Text>
      )}
      {current && (
        <BottomSheet
          visible
          title="Revisá el aviso de estado"
          subtitle={'WhatsApp del cliente: +' + current.phone}
          onClose={close}
          footer={
            <View style={{ padding: 16, gap: 8 }}>
              <Text style={{ color: c.muted, fontSize: 12 }}>
                WhatsApp se abrirá con este borrador. Revisá el chat y tocá Enviar allí.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={!current.message.trim()}
                onPress={() => void open()}
                style={{
                  minHeight: 44,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: '#15803D',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  Abrir WhatsApp con el aviso
                </Text>
              </Pressable>
            </View>
          }
        >
          <Text style={{ color: c.muted }}>
            Estado consultado al preparar el aviso. Podés editar el mensaje antes de abrir WhatsApp.
          </Text>
          <TextInput
            accessibilityLabel="Mensaje de estado para WhatsApp"
            multiline
            maxLength={4000}
            textAlignVertical="top"
            value={current.message}
            onChangeText={(message) => setDraft({ ...current, message })}
            style={{
              minHeight: 180,
              padding: 12,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 12,
              color: c.text,
            }}
          />
          {failure && (
            <Text accessibilityRole="alert" style={{ color: c.dangerText }}>
              {failure}
            </Text>
          )}
        </BottomSheet>
      )}
    </View>
  )
}
