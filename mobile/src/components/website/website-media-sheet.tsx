import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { palette, usePalette } from '@/lib/palette';
import {
  uploadWebsiteMedia,
  websiteErrorMessage,
} from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import type { WebsiteMediaItem, WebsiteMediaSection } from '@/lib/website-model';
import { Notice, ProgressBar, StatusPill, websiteStyles } from './website-ui';

const SECTION_LABELS: { value: 'all' | WebsiteMediaSection; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'logo', label: 'Logos' },
  { value: 'promotions', label: 'Banners' },
  { value: 'announcements', label: 'Avisos' },
  { value: 'brands', label: 'Marcas' },
  { value: 'gallery', label: 'Galería' },
  { value: 'general', label: 'General' },
];

const sectionName = (s?: string) =>
  SECTION_LABELS.find((item) => item.value === s)?.label ?? 'General';

const formatKb = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export function WebsiteMediaLibrarySheet(props: {
  visible: boolean;
  onClose: () => void;
  /** Si se pasa, al tocar una imagen la elige y cierra la hoja. */
  onSelect?: (url: string, item: WebsiteMediaItem) => void;
  defaultSection?: 'all' | WebsiteMediaSection;
  title?: string;
}) {
  if (!props.visible) return null;
  return (
    <WebsiteMediaLibrarySheetInner
      key={props.defaultSection ?? 'all'}
      visible={props.visible}
      onClose={props.onClose}
      onSelect={props.onSelect}
      defaultSection={props.defaultSection}
      title={props.title}
    />
  );
}

function WebsiteMediaLibrarySheetInner({
  visible,
  onClose,
  onSelect,
  defaultSection = 'all',
  title = 'Historial de medios',
}: {
  visible: boolean;
  onClose: () => void;
  onSelect?: (url: string, item: WebsiteMediaItem) => void;
  defaultSection?: 'all' | WebsiteMediaSection;
  title?: string;
}) {
  const colors = usePalette();
  const { mediaQuota, reloadMedia, removeMediaItem } = useWebsite();
  const [filter, setFilter] = useState<'all' | WebsiteMediaSection>(defaultSection);
  const [query, setQuery] = useState('');
  const [darkBackdrop, setDarkBackdrop] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [inspected, setInspected] = useState<WebsiteMediaItem | null>(null);

  useEffect(() => {
    void reloadMedia();
  }, [reloadMedia]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mediaQuota.items.filter((item) => {
      if (filter !== 'all' && (item.section ?? 'general') !== filter) return false;
      if (q && !(item.name ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mediaQuota.items, filter, query]);

  const ratio = mediaQuota.limit > 0 ? mediaQuota.count / mediaQuota.limit : 0;
  const barColor =
    mediaQuota.isAtLimit
      ? palette.danger
      : ratio >= 0.8
        ? '#D97706'
        : palette.primary;

  const confirmDelete = (item: WebsiteMediaItem) => {
    Alert.alert(
      'Eliminar imagen del almacenamiento',
      `Se va a borrar "${item.name}" definitivamente para liberar 1 espacio. Si la estás usando en el sitio, dejará de verse.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await removeMediaItem({
                id: item.id,
                path: item.path,
                url: item.url,
              });
              if (inspected?.id === item.id) setInspected(null);
            } catch (error) {
              Alert.alert(
                'No pudimos eliminar',
                websiteErrorMessage(
                  error,
                  'No pudimos eliminar la imagen. Intentá de nuevo.',
                ),
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const uploadToLibrary = async () => {
    if (mediaQuota.isAtLimit) {
      Alert.alert(
        'Límite alcanzado',
        `Tu sitio alcanzó el límite de ${mediaQuota.limit} imágenes. Eliminá alguna del historial para subir otra.`,
      );
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Sin acceso a tus fotos',
        'Habilitá el acceso a la galería en ajustes del teléfono.',
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.78,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('Imagen muy pesada', 'Elegí una imagen de hasta 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const targetSection: WebsiteMediaSection =
        filter === 'all' ? 'general' : filter;
      const result = await uploadWebsiteMedia(
        {
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
        },
        targetSection,
        asset.fileName || undefined,
      );
      await reloadMedia();
      if (onSelect) {
        onSelect(result.item.url, result.item);
        onClose();
      }
    } catch (error) {
      Alert.alert(
        'Error al subir',
        websiteErrorMessage(error, 'No pudimos subir la imagen al historial.'),
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      tall
      title={title}
      subtitle={`${mediaQuota.count} de ${mediaQuota.limit} imágenes usadas en tu sitio`}
      onClose={onClose}
    >
      <View style={styles.quotaCard}>
        <View style={styles.quotaTop}>
          <Text style={[styles.quotaLabel, { color: colors.text }]}>
            Espacio usado ({mediaQuota.count}/{mediaQuota.limit})
          </Text>
          <StatusPill
            label={
              mediaQuota.isAtLimit
                ? 'Cupo lleno'
                : `${mediaQuota.limit - mediaQuota.count} disponibles`
            }
            tone={mediaQuota.isAtLimit ? 'danger' : ratio >= 0.8 ? 'warning' : 'success'}
          />
        </View>
        <ProgressBar progress={ratio} color={barColor} />
      </View>

      {mediaQuota.isAtLimit ? (
        <Notice
          tone="warning"
          text="Llegaste al máximo de 20 imágenes guardadas. Eliminá imágenes viejas para poder subir nuevas, o reutilizá una de acá abajo."
        />
      ) : null}

      <View style={styles.toolbar}>
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={15} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre…"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setDarkBackdrop((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Alternar fondo claro u oscuro"
          style={[
            styles.backdropBtn,
            {
              backgroundColor: darkBackdrop ? '#0F172A' : colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name={darkBackdrop ? 'moon' : 'sunny-outline'}
            size={16}
            color={darkBackdrop ? '#F8FAFC' : colors.text}
          />
        </Pressable>
        <Pressable
          onPress={() => void uploadToLibrary()}
          disabled={uploading || mediaQuota.isAtLimit}
          accessibilityRole="button"
          accessibilityLabel="Subir nueva imagen"
          style={[
            styles.uploadSmallBtn,
            {
              backgroundColor: mediaQuota.isAtLimit
                ? colors.border
                : palette.primary,
            },
          ]}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={17} color="#fff" />
          )}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {SECTION_LABELS.map((tab) => {
          const active = filter === tab.value;
          return (
            <Pressable
              key={tab.value}
              onPress={() => setFilter(tab.value)}
              style={[
                websiteStyles.chip,
                {
                  borderColor: active ? palette.primary : colors.border,
                  backgroundColor: active
                    ? `${palette.primary}15`
                    : colors.background,
                },
              ]}
            >
              <Text
                style={[
                  websiteStyles.chipText,
                  { color: active ? palette.primary : colors.text },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {inspected ? (
        <View
          style={[
            styles.inspectBox,
            {
              borderColor: palette.primary,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Image
            source={{ uri: inspected.url }}
            style={[
              styles.inspectImage,
              { backgroundColor: darkBackdrop ? '#0B0F19' : '#F1F5F9' },
            ]}
            contentFit="contain"
          />
          <View style={styles.inspectInfo}>
            <Text numberOfLines={1} style={[styles.inspectName, { color: colors.text }]}>
              {inspected.name}
            </Text>
            <Text style={[styles.inspectMeta, { color: colors.muted }]}>
              {sectionName(inspected.section)}
              {inspected.size ? ` · ${formatKb(inspected.size)}` : ''}
            </Text>
            <View style={styles.inspectActions}>
              {onSelect ? (
                <Pressable
                  onPress={() => {
                    onSelect(inspected.url, inspected);
                    onClose();
                  }}
                  style={[websiteStyles.primaryButton, styles.smallBtn]}
                >
                  <Ionicons name="checkmark" size={14} color="#fff" />
                  <Text style={styles.smallBtnText}>Usar imagen</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void Share.share({ message: inspected.url })}
                  style={[
                    websiteStyles.secondaryButton,
                    styles.smallBtn,
                    { borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="share-outline" size={14} color={colors.text} />
                  <Text style={[styles.smallBtnSec, { color: colors.text }]}>
                    Compartir URL
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => confirmDelete(inspected)}
                style={[
                  websiteStyles.secondaryButton,
                  styles.smallBtn,
                  { borderColor: '#FECACA' },
                ]}
              >
                <Ionicons name="trash-outline" size={14} color={palette.danger} />
                <Text style={[styles.smallBtnSec, { color: palette.danger }]}>
                  Eliminar
                </Text>
              </Pressable>
              <Pressable onPress={() => setInspected(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {mediaQuota.loading && mediaQuota.items.length === 0 ? (
        <View style={styles.emptyBox}>
          <ActivityIndicator color={palette.primary} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Cargando tus imágenes…
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="images-outline" size={32} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {mediaQuota.items.length === 0
              ? 'Todavía no subiste imágenes para tu sitio web.'
              : 'No hay imágenes que coincidan con este filtro.'}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {filtered.map((item) => {
            const busy = deletingId === item.id;
            return (
              <Pressable
                key={item.id || item.url}
                onPress={() => {
                  if (onSelect) {
                    onSelect(item.url, item);
                    onClose();
                  } else {
                    setInspected(item);
                  }
                }}
                onLongPress={() => setInspected(item)}
                accessibilityRole="button"
                accessibilityLabel={
                  onSelect ? `Usar ${item.name}` : `Ver ${item.name}`
                }
                style={[
                  styles.card,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <View
                  style={[
                    styles.thumbWrap,
                    { backgroundColor: darkBackdrop ? '#0B0F19' : '#E2E8F0' },
                  ]}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={StyleSheet.absoluteFill}
                    contentFit={
                      item.section === 'logo' || item.section === 'brands'
                        ? 'contain'
                        : 'cover'
                    }
                  />
                  <Pressable
                    onPress={() => confirmDelete(item)}
                    disabled={busy}
                    hitSlop={6}
                    accessibilityLabel={`Eliminar ${item.name}`}
                    style={styles.deleteDot}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Ionicons name="trash-outline" size={12} color="#fff" />
                    )}
                  </Pressable>
                </View>
                <View style={styles.cardBody}>
                  <Text
                    numberOfLines={1}
                    style={[styles.cardName, { color: colors.text }]}
                  >
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.cardMeta, { color: colors.muted }]}>
                    {sectionName(item.section)}
                    {item.size ? ` · ${formatKb(item.size)}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  quotaCard: { gap: 6 },
  quotaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  quotaLabel: { fontSize: 13, fontWeight: '700' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 6 },
  backdropBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadSmallBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { gap: 8, paddingVertical: 2 },
  inspectBox: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  inspectImage: { width: 72, height: 72, borderRadius: 10 },
  inspectInfo: { flex: 1, gap: 4 },
  inspectName: { fontSize: 14, fontWeight: '800' },
  inspectMeta: { fontSize: 12 },
  inspectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  smallBtn: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9 },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  smallBtnSec: { fontSize: 12, fontWeight: '700' },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: { fontSize: 13, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    position: 'relative',
  },
  deleteDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 8, gap: 2 },
  cardName: { fontSize: 12, fontWeight: '700' },
  cardMeta: { fontSize: 11 },
});
