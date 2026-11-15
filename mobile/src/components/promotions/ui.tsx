import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { usePalette } from '@/lib/palette'
import { usePanel } from '@/lib/panel'
import { navigationColor, navigationInk } from '@/lib/bottom-nav-model'
import {
  getPrivateCacheContext,
  isPrivateCacheSnapshotCompatible,
} from '@/lib/private-cache-context'
import { promotionsError } from '@/lib/promotions'
import { localDate } from '@/lib/promotions-model'
export function usePromotionColors() {
  const colors = usePalette()
  const { data } = usePanel()
  const brand = navigationColor(data?.organization.brandColor, data?.organization.customBrandColor)
  return { ...colors, brand, ink: navigationInk(brand) }
}
export function Card({ children }: { children: ReactNode }) {
  const c = usePromotionColors()
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      {children}
    </View>
  )
}
export function Heading({ children }: { children: ReactNode }) {
  const c = usePromotionColors()
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>
      {children}
    </Text>
  )
}
export function Copy({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  const c = usePromotionColors()
  return <Text style={[styles.copy, { color: warning ? c.warningText : c.muted }]}>{children}</Text>
}
export function Action({
  title,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  secondary?: boolean
  danger?: boolean
}) {
  const c = usePromotionColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        {
          borderColor: danger ? c.dangerText : c.brand,
          backgroundColor: secondary ? 'transparent' : danger ? c.dangerText : c.brand,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.actionText,
          { color: secondary ? (danger ? c.dangerText : c.brand) : danger ? '#fff' : c.ink },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  )
}
export function Notice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <Text
        accessibilityRole="alert"
        style={{ color: usePromotionColors().warningText, fontSize: 14, lineHeight: 21 }}
      >
        {message}
      </Text>
      {onRetry ? <Action title="Reintentar" secondary onPress={onRetry} /> : null}
    </Card>
  )
}
export function Loading() {
  const c = usePromotionColors()
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={c.brand} />
      <Copy>Cargando…</Copy>
    </View>
  )
}
export type Field = {
  key: string
  label: string
  type?: 'number' | 'multiline' | 'toggle' | 'choice' | 'date'
  hint?: string
  options?: { value: string; label: string }[]
  visible?: boolean
  disabled?: boolean
  maxLength?: number
}
export function Fields({
  fields,
  values,
  onChange,
  disabled = false,
}: {
  fields: Field[]
  values: object
  onChange: (key: string, value: string | boolean) => void
  disabled?: boolean
}) {
  const c = usePromotionColors()
  const valuesByKey = values as Record<string, unknown>
  return (
    <View style={{ gap: 16 }}>
      {fields
        .filter((f) => f.visible !== false)
        .map((f) => {
          const value = valuesByKey[f.key]
          const blocked = disabled || f.disabled
          const string = String(value ?? '')
          return (
            <View key={f.key} style={{ gap: 7 }}>
              <Text style={[styles.label, { color: c.text }]}>{f.label}</Text>
              {f.type === 'toggle' ? (
                <Switch
                  accessibilityLabel={f.label}
                  disabled={blocked}
                  value={value === true}
                  onValueChange={(next) => onChange(f.key, next)}
                  trackColor={{ true: c.brand }}
                />
              ) : f.type === 'choice' ? (
                <View style={{ gap: 6 }}>
                  {f.options?.map((option) => (
                    <Pressable
                      key={option.value}
                      disabled={blocked}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityState={{ checked: string === option.value, disabled: blocked }}
                      onPress={() => onChange(f.key, option.value)}
                      style={[
                        styles.choice,
                        {
                          borderColor: string === option.value ? c.brand : c.border,
                          backgroundColor: string === option.value ? c.accentSoft : c.card,
                          opacity: blocked ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: c.text, fontSize: 14, lineHeight: 21 }}>
                        {string === option.value ? '●  ' : '○  '}
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : f.type === 'date' ? (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      accessibilityLabel={f.label + ' — fecha'}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={c.muted}
                      maxLength={10}
                      value={string.split(' ')[0] ?? ''}
                      onChangeText={(date) =>
                        onChange(f.key, date + ' ' + (string.split(' ')[1] ?? '09:00'))
                      }
                      editable={!blocked}
                      autoCapitalize="none"
                      style={[
                        styles.input,
                        {
                          flex: 2,
                          borderColor: c.border,
                          color: c.text,
                          backgroundColor: c.background,
                        },
                      ]}
                    />
                    <TextInput
                      accessibilityLabel={f.label + ' — hora'}
                      placeholder="HH:mm"
                      placeholderTextColor={c.muted}
                      maxLength={5}
                      value={string.split(' ')[1] ?? ''}
                      onChangeText={(time) =>
                        onChange(f.key, (string.split(' ')[0] ?? '') + ' ' + time)
                      }
                      editable={!blocked}
                      style={[
                        styles.input,
                        {
                          flex: 1,
                          borderColor: c.border,
                          color: c.text,
                          backgroundColor: c.background,
                        },
                      ]}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {[0, 7, 30].map((days) => (
                      <Pressable
                        key={days}
                        disabled={blocked}
                        accessibilityRole="button"
                        accessibilityLabel={f.label + (days ? ' en ' + days + ' días' : ' ahora')}
                        onPress={() =>
                          onChange(f.key, localDate(new Date(Date.now() + days * 86400000)))
                        }
                        style={[styles.chip, { borderColor: c.border }]}
                      >
                        <Text style={{ color: c.brand, fontSize: 12 }}>
                          {days ? 'En ' + days + ' días' : 'Ahora'}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      disabled={blocked}
                      onPress={() => onChange(f.key, '')}
                      accessibilityRole="button"
                      style={[styles.chip, { borderColor: c.border }]}
                    >
                      <Text style={{ color: c.muted, fontSize: 12 }}>Quitar fecha</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <TextInput
                  accessibilityLabel={f.label}
                  placeholderTextColor={c.muted}
                  value={string}
                  editable={!blocked}
                  multiline={f.type === 'multiline'}
                  keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                  autoCapitalize={f.key === 'code' ? 'characters' : 'sentences'}
                  maxLength={f.maxLength ?? (f.type === 'multiline' ? 4000 : 180)}
                  onChangeText={(next) => onChange(f.key, next)}
                  style={[
                    styles.input,
                    {
                      minHeight: f.type === 'multiline' ? 90 : 46,
                      textAlignVertical: f.type === 'multiline' ? 'top' : 'center',
                      borderColor: c.border,
                      color: c.text,
                      backgroundColor: c.background,
                    },
                  ]}
                />
              )}
              {f.hint ? <Copy>{f.hint}</Copy> : null}
            </View>
          )
        })}
    </View>
  )
}
export function useResource<T>(loader: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    loader: typeof loader | null
    value: T | null
    error: string | null
    loading: boolean
  }>({ loader: null, value: null, error: null, loading: true })
  useEffect(() => {
    let active = true
    const scope = getPrivateCacheContext()
    queueMicrotask(() => {
      if (active) setState({ loader, value: null, error: null, loading: true })
    })
    loader()
      .then((value) => {
        if (active && isPrivateCacheSnapshotCompatible(scope))
          setState({ loader, value, error: null, loading: false })
      })
      .catch((reason) => {
        if (active && isPrivateCacheSnapshotCompatible(scope))
          setState({ loader, value: null, error: promotionsError(reason), loading: false })
      })
    return () => {
      active = false
    }
  }, [loader, attempt])
  const refresh = useCallback(() => setAttempt((n) => n + 1), [])
  return {
    data: state.loader === loader ? state.value : null,
    error: state.loader === loader ? state.error : null,
    loading: state.loader !== loader || state.loading,
    refresh,
  }
}
export function useMutation(onDone?: () => void) {
  const mounted = useRef(true),
    origin = useRef(getPrivateCacheContext()),
    locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const current = () => mounted.current && isPrivateCacheSnapshotCompatible(origin.current)
  const run = async (work: () => Promise<unknown>, success = 'Cambios guardados') => {
    if (!current() || locked.current) return false
    locked.current = true
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await work()
      if (!current()) return false
      setMessage(success)
      onDone?.()
      return true
    } catch (reason) {
      if (current()) setError(promotionsError(reason))
      return false
    } finally {
      locked.current = false
      if (current()) setBusy(false)
    }
  }
  return {
    busy,
    error,
    message,
    run,
    clear: () => {
      setError(null)
      setMessage(null)
    },
  }
}
export function Feedback({ error, message }: { error: string | null; message?: string | null }) {
  return error ? <Notice message={error} /> : message ? <Copy>{message}</Copy> : null
}
export function confirmAction(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', onPress: onConfirm },
  ])
}
export const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '700', lineHeight: 25 },
  copy: { fontSize: 13, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 21 },
  action: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontWeight: '700', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minWidth: 0 },
  choice: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 46 },
  chip: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  loading: { padding: 30, gap: 12, alignItems: 'center' },
})
