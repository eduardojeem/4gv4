import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { fetchReviews, moderateReview, REVIEW_STATUS, type Review, type ReviewStats, type ReviewStatus } from '@/lib/admin';
import { palette, usePalette } from '@/lib/palette';

type Colors = ReturnType<typeof usePalette>;

const FILTERS: { key: ReviewStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Por revisar' },
  { key: 'published', label: 'Publicadas' },
  { key: 'hidden', label: 'Ocultas' },
  { key: 'rejected', label: 'Rechazadas' },
  { key: 'all', label: 'Todas' },
];
const REASONS = ['Lenguaje ofensivo', 'No es una experiencia real', 'Spam o publicidad', 'Datos personales'];
const date = (iso: string) => new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });

/** Reseñas, como /admin/reviews: aprobar, rechazar u ocultar y responder como negocio. */
export default function ReviewsScreen() {
  const colors = usePalette();
  const [status, setStatus] = useState<ReviewStatus | 'all'>('pending');
  const [rows, setRows] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Review | null>(null);

  useEffect(() => {
    let active = true;
    fetchReviews({ status, offset: 0 })
      .then((data) => {
        if (!active) return;
        setRows(data.reviews);
        setStats(data.stats);
        setTotal(data.pagination.total);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar las reseñas.'))
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [status, attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = () => {
    if (loadingMore || loading || rows.length >= total) return;
    setLoadingMore(true);
    fetchReviews({ status, offset: rows.length })
      .then((data) => setRows((list) => [...list, ...data.reviews.filter((row) => !list.some((item) => item.id === row.id))]))
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Text style={[styles.topTitle, { color: colors.text }]}>Reseñas</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            {stats && (
              <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.average}>
                  <Text style={[styles.averageValue, { color: colors.text }]}>{stats.average.toFixed(1)}</Text>
                  <Stars value={Math.round(stats.average)} size={14} />
                  <Text style={[styles.tiny, { color: colors.muted }]}>{stats.published} publicadas</Text>
                </View>
                <View style={styles.flex}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = Number(stats.breakdown?.[star] ?? 0);
                    const max = Math.max(1, ...[1, 2, 3, 4, 5].map((value) => Number(stats.breakdown?.[value] ?? 0)));
                    return (
                      <View key={star} style={styles.breakdown}>
                        <Text style={[styles.tiny, { color: colors.muted }]}>{star}</Text>
                        <View style={[styles.bar, { backgroundColor: colors.background }]}>
                          <View style={[styles.barFill, { width: `${Math.round((count / max) * 100)}%` }]} />
                        </View>
                        <Text style={[styles.tiny, styles.count, { color: colors.muted }]}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((item) => {
                const isSelected = status === item.key;
                const amount = item.key === 'pending' ? stats?.pending : undefined;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setLoading(true);
                      setStatus(item.key);
                    }}
                    style={[styles.chip, { borderColor: isSelected ? palette.primary : colors.border, backgroundColor: isSelected ? palette.primary : colors.card }]}>
                    <Text style={[styles.chipText, { color: isSelected ? '#fff' : colors.text }]}>
                      {item.label}
                      {amount ? ` · ${amount}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={34} color={colors.muted} />
              <Text style={[styles.bold, styles.centerText, { color: colors.text }]}>{error ?? (status === 'pending' ? 'No hay reseñas por revisar' : 'No hay reseñas en este estado')}</Text>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loading} color={palette.primary} /> : null}
        renderItem={({ item }) => <ReviewRow review={item} colors={colors} onPress={() => setSelected(item)} />}
      />

      {selected && (
        <ReviewSheet
          review={selected}
          colors={colors}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </View>
  );
}

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons key={star} name={star <= value ? 'star' : 'star-outline'} size={size} color="#F59E0B" />
      ))}
    </View>
  );
}

function ReviewRow({ review, colors, onPress }: { review: Review; colors: Colors; onPress: () => void }) {
  const status = REVIEW_STATUS[review.moderation_status] ?? REVIEW_STATUS.pending;
  const verified = review.verification_type === 'purchase' || review.verification_type === 'repair';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.rowTop}>
        <Stars value={review.rating} />
        <Text numberOfLines={1} style={[styles.bold, styles.flex, { color: colors.text }]}>{review.reviewer_name}</Text>
        <View style={[styles.tag, { backgroundColor: `${status.color}1A` }]}>
          <Text style={[styles.tagText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      {review.comment ? <Text numberOfLines={3} style={[styles.small, { color: colors.text }]}>{review.comment}</Text> : null}
      <Text style={[styles.tiny, { color: colors.muted }]}>
        {date(review.created_at)}
        {verified ? ` · compra verificada` : ''}
        {review.business_response ? ' · respondida' : ''}
      </Text>
    </Pressable>
  );
}

function ReviewSheet({ review, colors, onClose, onChanged }: { review: Review; colors: Colors; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<'view' | 'reject' | 'hide'>('view');
  const [reason, setReason] = useState('');
  const [response, setResponse] = useState(review.business_response ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = (key: string, input: Parameters<typeof moderateReview>[1]) => {
    setBusy(key);
    setError(null);
    moderateReview(review.id, input)
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onChanged();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo guardar.'))
      .finally(() => setBusy(null));
  };

  const status = review.moderation_status;
  const input = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }];

  return (
    <BottomSheet visible tall title={review.reviewer_name} subtitle={`${REVIEW_STATUS[status]?.label ?? status} · ${date(review.created_at)}`} onClose={() => !busy && onClose()}>
      <Stars value={review.rating} size={18} />
      <Text style={[styles.comment, { color: colors.text }]}>{review.comment || 'Sin comentario.'}</Text>
      {review.reviewer_email ? <Text style={[styles.tiny, { color: colors.muted }]}>{review.reviewer_email}</Text> : null}

      {mode === 'view' ? (
        <>
          <View style={styles.actions}>
            {status !== 'published' && <Action label="Publicar" icon="checkmark-circle-outline" color={palette.success} busy={busy === 'publish'} onPress={() => save('publish', { moderation_status: 'published' })} colors={colors} />}
            {status === 'pending' && <Action label="Rechazar" icon="close-circle-outline" color={palette.danger} onPress={() => setMode('reject')} colors={colors} />}
            {status === 'published' && <Action label="Ocultar" icon="eye-off-outline" color={colors.muted} onPress={() => setMode('hide')} colors={colors} />}
          </View>
          <Text style={[styles.label, { color: colors.text }]}>Respuesta del negocio</Text>
          <TextInput value={response} onChangeText={setResponse} multiline maxLength={1000} placeholder="¡Gracias por tu compra! …" placeholderTextColor={colors.muted} style={[input, styles.multiline]} />
          <Pressable onPress={() => save('response', { business_response: response.trim() || null })} disabled={Boolean(busy) || response.trim() === (review.business_response ?? '') || (response.trim().length > 0 && response.trim().length < 2)} style={[styles.primary, { opacity: busy || response.trim() === (review.business_response ?? '') ? 0.6 : 1 }]}>
            {busy === 'response' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{response.trim() ? 'Guardar respuesta' : 'Quitar respuesta'}</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.text }]}>{mode === 'reject' ? 'Motivo del rechazo' : 'Motivo para ocultarla'}</Text>
          <View style={styles.actions}>
            {REASONS.map((text) => (
              <Pressable key={text} onPress={() => setReason(text)} style={[styles.reason, { borderColor: reason === text ? palette.primary : colors.border, backgroundColor: reason === text ? 'rgba(37,99,235,0.08)' : colors.background }]}>
                <Text style={[styles.tiny, { color: reason === text ? palette.primary : colors.text, fontWeight: '700' }]}>{text}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={reason} onChangeText={setReason} maxLength={500} placeholder="Queda guardado en la moderación" placeholderTextColor={colors.muted} style={input} />
          <View style={styles.actions}>
            <Pressable onPress={() => setMode('view')} style={[styles.secondary, { borderColor: colors.border }]}>
              <Text style={[styles.bold, { color: colors.text }]}>Volver</Text>
            </Pressable>
            <Pressable
              onPress={() => save(mode, { moderation_status: mode === 'reject' ? 'rejected' : 'hidden', moderation_reason: reason.trim() })}
              disabled={Boolean(busy) || reason.trim().length < 3}
              style={[styles.danger, { opacity: busy || reason.trim().length < 3 ? 0.6 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === 'reject' ? 'Rechazar' : 'Ocultar'}</Text>}
            </Pressable>
          </View>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

function Action({ label, icon, color, busy, onPress, colors }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; busy?: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={[styles.actionBtn, { borderColor: colors.border }]}>
      {busy ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={18} color={color} />}
      <Text style={[styles.small, { color, fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerText: { textAlign: 'center' },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800' },
  loading: { paddingVertical: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingTop: 14, paddingBottom: 2 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  header: { gap: 10, marginBottom: 4 },
  summary: { flexDirection: 'row', gap: 16, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  average: { alignItems: 'center', gap: 3 },
  averageValue: { fontSize: 32, fontWeight: '900' },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 1 },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#F59E0B' },
  count: { width: 24, textAlign: 'right' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  row: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stars: { flexDirection: 'row', gap: 1 },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  comment: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  reason: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  primary: { borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  secondary: { flex: 1, borderWidth: 1, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  danger: { flex: 1, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.danger },
});
