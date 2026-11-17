import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useSession } from '@/lib/session'
import { palette, usePalette } from '@/lib/palette'
import {
  getPrivateCacheContext,
  isPrivateCacheSnapshotCompatible,
  subscribePrivateCacheContext,
} from '@/lib/private-cache-context'
import {
  fetchMyAppointments,
  fetchMyAppointment,
  myAppointmentError,
  type CustomerBookingItem,
  type CustomerBookingDetail,
} from '@/lib/customer-appointments'
import {
  appointmentManagementPath,
  appointmentStatusLabel,
  formatAppointmentWhen,
  formatAppointmentPrice,
} from '@/lib/customer-appointments-model'
import { openWeb } from '@/lib/marketplace'
const errorText = myAppointmentError
function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  secondary?: boolean
  disabled?: boolean
}) {
  const c = usePalette()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        {
          borderColor: secondary ? c.border : palette.primary,
          backgroundColor: secondary ? c.card : palette.primary,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={{
          fontSize: 14,
          lineHeight: 21,
          fontWeight: '700',
          textAlign: 'center',
          color: secondary ? c.text : '#fff',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
function Frame({ children, title = 'Mis turnos' }: { children: ReactNode; title?: string }) {
  const c = usePalette()
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.flex, { backgroundColor: c.background }]}
    >
      <View style={[styles.header, { backgroundColor: c.card, borderColor: c.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a mi cuenta"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace({ pathname: '/', params: { tab: 'perfil' } } as never)
          }
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={23} color={c.text} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
          {title}
        </Text>
      </View>
      {children}
    </SafeAreaView>
  )
}
function Notice({ message, retry }: { message: string; retry: () => void }) {
  const c = usePalette()
  return (
    <View style={styles.notice}>
      <Ionicons name="cloud-offline-outline" size={28} color={c.muted} />
      <Text accessibilityRole="alert" style={[styles.body, { color: c.text }]}>
        {message}
      </Text>
      <Action label="Reintentar" secondary onPress={retry} />
    </View>
  )
}
function Status({ item }: { item: CustomerBookingItem }) {
  const c = usePalette()
  const color =
    item.status === 'pending'
      ? c.warningText
      : item.status === 'confirmed'
        ? c.successText
        : c.muted
  return (
    <Text style={[styles.status, { color, backgroundColor: c.background }]}>
      {appointmentStatusLabel(item.status)}
    </Text>
  )
}
function useViewerScope() {
  const { session, isLoading } = useSession()
  const [scope, setScope] = useState(getPrivateCacheContext)
  const [revoked, setRevoked] = useState(false)
  useEffect(() => subscribePrivateCacheContext((next, previous) => {
    setScope(next)
    if (next.userId !== previous.userId) setRevoked(false)
    else if (next.access !== previous.access) setRevoked(true)
  }), [])
  const retry = useCallback(() => setRevoked(false), [])
  return { session, isLoading, revoked, retry, key: (session?.user.id ?? '') + ':' + scope.epoch }
}
function SignIn() {
  const c = usePalette()
  return (
    <View style={styles.notice}>
      <Text style={[styles.body, {color:c.text}]}>Iniciá sesión para ver los turnos vinculados a tu cuenta.</Text>
      <Action label="Iniciar sesión" onPress={() => router.push('/sign-in' as never)} />
    </View>
  )
}
export function MyAppointmentsScreen() {
  const viewer = useViewerScope()
  return (
    <Frame>
      {viewer.isLoading ? (
        <ActivityIndicator style={styles.notice} color={palette.primary} />
      ) : !viewer.session ? (
        <SignIn />
      ) : (
        viewer.revoked ? <Notice message="La sesión o el acceso a tu cuenta cambió. Volvé a intentarlo." retry={viewer.retry}/> : <MyBookings key={viewer.key} />
      )}
    </Frame>
  )
}
function MyBookings() {
  const c = usePalette()
  const [kind, setKind] = useState<'upcoming' | 'past'>('upcoming')
  return (
    <View style={styles.flex}>
      <View style={styles.filters}>
        <Text style={[styles.body, { color: c.muted }]}>
          Tus reservas asociadas a esta cuenta, en todas las tiendas.
        </Text>
        <View style={styles.row}>
          {(
            [
              { key: 'upcoming', label: 'Próximos' },
              { key: 'past', label: 'Historial' },
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === tab.key }}
              onPress={() => setKind(tab.key)}
              style={[
                styles.filter,
                {
                  backgroundColor: kind === tab.key ? palette.primary : c.card,
                  borderColor: kind === tab.key ? palette.primary : c.border,
                },
              ]}
            >
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 14,
                  color: kind === tab.key ? '#fff' : c.text,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <BookingList key={kind} kind={kind} />
    </View>
  )
}
function BookingList({ kind }: { kind: 'upcoming' | 'past' }) {
  const c = usePalette()
  const [items, setItems] = useState<CustomerBookingItem[] | null>(null),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [moreError, setMoreError] = useState<string | null>(null),
    [refreshing, setRefreshing] = useState(false),
    [more, setMore] = useState(false)
  const active = useRef(true),
    sequence = useRef(0),
    busyMore = useRef(false),
    origin = useRef(getPrivateCacheContext())
  const current = useCallback(
    () => active.current && isPrivateCacheSnapshotCompatible(origin.current),
    [],
  )
  const reload = useCallback(
    async (pull = true) => {
      if (!active.current || !isPrivateCacheSnapshotCompatible(origin.current)) return
      const run = ++sequence.current
      busyMore.current = false
      setMore(false)
      setRefreshing(pull)
      setError(null)
      setMoreError(null)
      try {
        const page = await fetchMyAppointments(kind)
        if (current() && run === sequence.current) {
          setItems(page.items)
          setCursor(page.nextCursor)
        }
      } catch (reason) {
        if (current() && run === sequence.current) setError(errorText(reason))
      } finally {
        if (current() && run === sequence.current) setRefreshing(false)
      }
    },
    [kind, current],
  )
  useFocusEffect(
    useCallback(() => {
      active.current = true
      void reload(false)
      return () => {
        active.current = false
        sequence.current++
      }
    }, [reload]),
  )
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload(false)
    })
    return () => subscription.remove()
  }, [reload])
  const loadMore = async () => {
    if (!cursor || busyMore.current || refreshing || !current()) return
    busyMore.current = true
    const run = sequence.current
    setMore(true)
    setMoreError(null)
    try {
      const page = await fetchMyAppointments(kind, cursor)
      if (current() && run === sequence.current) {
        setItems((rows) => [
          ...(rows ?? []),
          ...page.items.filter((item) => !rows?.some((row) => row.id === item.id)),
        ])
        setCursor(page.nextCursor)
      }
    } catch (reason) {
      if (current() && run === sequence.current) setMoreError(errorText(reason))
    } finally {
      if (current() && run === sequence.current) {
        busyMore.current = false
        setMore(false)
      }
    }
  }
  if (items === null)
    return error ? (
      <Notice message={error} retry={() => void reload(false)} />
    ) : (
      <ActivityIndicator
        accessibilityLabel="Cargando turnos"
        color={palette.primary}
        style={styles.notice}
      />
    )
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void reload()}
          tintColor={palette.primary}
        />
      }
      ListHeaderComponent={error ? <Notice message={error} retry={() => void reload()} /> : null}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="calendar-clear-outline" size={36} color={c.muted} />
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            {kind === 'upcoming'
              ? 'No hay próximos turnos en esta cuenta'
              : 'Todavía no hay turnos en el historial'}
          </Text>
          <Text style={[styles.body, { color: c.muted }]}>
            Si reservaste sin iniciar sesión, usá el enlace de confirmación o pedí al negocio que
            vincule tu ficha. No asociamos turnos solo por nombre o teléfono.
          </Text>
          <Action
            label="Ver tiendas"
            onPress={() => router.replace({ pathname: '/', params: { tab: 'tiendas' } } as never)}
          />
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={23} color={palette.primary} />
            <Text style={[styles.sectionTitle, styles.flex, { color: c.text }]}>
              {item.serviceName}
            </Text>
          </View>
          <Status item={item} />
          <Text style={[styles.store, { color: c.text }]}>{item.store.name}</Text>
          <Text style={[styles.body, { color: c.text }]}>
            {formatAppointmentWhen(item.startsAt, item.store.timeZone)}
          </Text>
          <Text style={[styles.small, { color: c.muted }]}>
            Hora de la tienda · {item.store.timeZone}
          </Text>
          <Text style={[styles.body, { color: c.muted }]}>
            {item.professionalName ? 'Con ' + item.professionalName : 'Profesional sin asignar'}
          </Text>
          <Action
            label={'Ver detalle de ' + item.serviceName}
            secondary
            onPress={() =>
              router.push({ pathname: '/mis-turnos/[id]', params: { id: item.id } } as never)
            }
          />
        </View>
      )}
      ListFooterComponent={
        <View style={{ gap: 10, paddingVertical: 8 }}>
          {moreError ? (
            <Text accessibilityRole="alert" style={[styles.body, { color: c.dangerText }]}>
              {moreError}
            </Text>
          ) : null}
          {cursor ? (
            <Action
              label={more ? 'Cargando…' : moreError ? 'Reintentar más turnos' : 'Cargar más turnos'}
              disabled={more || refreshing}
              secondary
              onPress={() => void loadMore()}
            />
          ) : null}
        </View>
      }
    />
  )
}
export function MyAppointmentDetailScreen({ id }: { id: string | undefined }) {
  const viewer = useViewerScope()
  return (
    <Frame title="Detalle de mi turno">
      {viewer.isLoading ? (
        <ActivityIndicator style={styles.notice} color={palette.primary} />
      ) : !viewer.session ? (
        <SignIn />
      ) : (
        viewer.revoked ? <Notice message="La sesión o el acceso a tu cuenta cambió. Volvé a intentarlo." retry={viewer.retry}/> : <BookingDetails key={viewer.key + ':' + id} id={id} />
      )}
    </Frame>
  )
}
function BookingDetails({ id }: { id: string | undefined }) {
  const c = usePalette()
  const [appointment, setAppointment] = useState<CustomerBookingDetail | null>(null),
    [error, setError] = useState<string | null>(null),
    [webError, setWebError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const active = useRef(true),
    sequence = useRef(0),
    origin = useRef(getPrivateCacheContext())
  const current = useCallback(
    () => active.current && isPrivateCacheSnapshotCompatible(origin.current),
    [],
  )
  const reload = useCallback(async () => {
    if (!current()) return
    const run = ++sequence.current
    setLoading(true)
    setError(null)
    try {
      if (!id) throw new Error('No se indicó el turno.')
      const result = await fetchMyAppointment(id)
      if (current() && run === sequence.current) setAppointment(result.appointment)
    } catch (reason) {
      if (current() && run === sequence.current) setError(errorText(reason))
    } finally {
      if (current() && run === sequence.current) setLoading(false)
    }
  }, [id, current])
  useEffect(() => {
    active.current = true
    queueMicrotask(() => {
      if (active.current) void reload()
    })
    return () => {
      active.current = false
      // El indicador active descarta las respuestas posteriores al desmontaje.
    }
  }, [reload])
  const browse = async (path: string) => {
    if (!current() || busy) return
    setBusy(true)
    setWebError(null)
    try {
      await openWeb(path)
      if (current()) void reload()
    } catch {
      if (current()) setWebError('No se pudo abrir el sitio de la tienda. Intentá de nuevo.')
    } finally {
      if (current()) setBusy(false)
    }
  }
  if (loading)
    return (
      <ActivityIndicator
        accessibilityLabel="Cargando detalle"
        style={styles.notice}
        color={palette.primary}
      />
    )
  if (error || !appointment)
    return <Notice message={error ?? 'El turno no está disponible.'} retry={() => void reload()} />
  const manage = appointmentManagementPath(appointment.managePath)
  const store = '/' + encodeURIComponent(appointment.store.slug)
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void reload()}
          tintColor={palette.primary}
        />
      }
    >
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
          {appointment.serviceName}
        </Text>
        <Status item={appointment} />
        <Text style={[styles.store, { color: c.text }]}>{appointment.store.name}</Text>
        <Text style={[styles.body, { color: c.text }]}>
          Inicio: {formatAppointmentWhen(appointment.startsAt, appointment.store.timeZone)}
        </Text>
        <Text style={[styles.body, { color: c.text }]}>
          Fin: {formatAppointmentWhen(appointment.endsAt, appointment.store.timeZone)}
        </Text>
        <Text style={[styles.small, { color: c.muted }]}>
          Horarios de la tienda · {appointment.store.timeZone}
        </Text>
        <Text style={[styles.body, { color: c.text }]}>
          {appointment.professionalName
            ? 'Te atiende ' + appointment.professionalName
            : 'Todavía no se asignó un profesional.'}
        </Text>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          {formatAppointmentPrice(appointment.price, appointment.store.currency)}
        </Text>
        {appointment.attentionMode === 'home' ? (
          <Text style={[styles.body, { color: c.text }]}>
            Atención a domicilio{appointment.address ? ' · ' + appointment.address : ''}
          </Text>
        ) : appointment.attentionMode === 'local' ? (
          <Text style={[styles.body, { color: c.muted }]}>Atención en el local de la tienda</Text>
        ) : null}
      </View>
      {webError ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: c.dangerText }]}>
          {webError}
        </Text>
      ) : null}
      {manage ? (
        <>
          <Action
            label="Cambiar o cancelar en la tienda"
            disabled={busy}
            onPress={() => void browse(manage)}
          />
          <Text style={[styles.small, { color: c.muted }]}>
            Se abre tu enlace de gestión en el sitio de la tienda. Allí se validan los horarios
            disponibles y las condiciones antes de confirmar.
          </Text>
        </>
      ) : (
        <Text style={[styles.body, { color: c.muted }]}>
          Este turno no admite cambios desde su enlace. Si necesitás ayuda, consultá con la tienda.
        </Text>
      )}
      <Action
        label="Ver tienda"
        secondary
        disabled={busy}
        onPress={() => void browse(store + '/inicio')}
      />
      <Action
        label="Reservar otro turno"
        secondary
        disabled={busy}
        onPress={() => void browse(store + '/turnos')}
      />
    </ScrollView>
  )
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  back: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 23, fontWeight: '800', flexShrink: 1 },
  filters: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  filter: {
    flex: 1,
    minHeight: 44,
    padding: 11,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  content: { padding: 16, gap: 14, paddingBottom: 30 },
  card: { padding: 17, borderWidth: 1, borderRadius: 18, gap: 11, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', lineHeight: 25 },
  store: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 18 },
  status: {
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  action: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: 'center',
  },
  notice: { padding: 24, gap: 14, alignItems: 'stretch' },
  empty: { paddingVertical: 28, gap: 15 },
})
