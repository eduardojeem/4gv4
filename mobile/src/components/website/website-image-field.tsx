import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { palette, usePalette } from '@/lib/palette';
import {
  uploadWebsiteImage,
  websiteErrorMessage,
  type PickedImage,
  type WebsiteImageKind,
} from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import type { WebsiteMediaSection } from '@/lib/website-model';
import { WebsiteMediaLibrarySheet } from './website-media-sheet';
import { useWebsiteEditor } from './website-ui';

const MEDIA_SECTION_BY_KIND: Record<WebsiteImageKind, WebsiteMediaSection> = {
  logo: 'logo',
  banner: 'promotions',
  aviso: 'announcements',
  gallery: 'gallery',
  brand: 'brands',
};

/**
 * Elegir, reutilizar del historial o subir una imagen del sitio.
 * La nueva solo reemplaza a la anterior cuando el servidor confirmó la subida.
 */
export function WebsiteImageField({
  label,
  value,
  kind,
  slideId,
  onUploaded,
  onClear,
  aspect = 'square',
  help,
  allowHistory = true,
}: {
  label: string;
  value: string | null | undefined;
  kind: WebsiteImageKind;
  slideId?: string;
  onUploaded: (url: string) => void;
  onClear?: () => void;
  aspect?: 'square' | 'wide';
  help?: string;
  allowHistory?: boolean;
}) {
  const colors = usePalette();
  const editor = useWebsiteEditor();
  const { mediaQuota, reloadMedia } = useWebsite();
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [failed, setFailed] = useState<{
    image: PickedImage;
    message: string;
  } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const upload = async (image: PickedImage) => {
    setUploading(true);
    editor.uploadChanged(true);
    setFailed(null);
    setPreview(image.uri);
    try {
      const url = await uploadWebsiteImage(kind, image, slideId);
      onUploaded(url);
      setPreview(null);
      void reloadMedia();
    } catch (error) {
      setFailed({
        image,
        message: websiteErrorMessage(
          error,
          'No pudimos subir la imagen. Revisá tu conexión e intentá de nuevo.',
        ),
      });
      setPreview(null);
    } finally {
      setUploading(false);
      editor.uploadChanged(false);
    }
  };

  const pick = async () => {
    if (mediaQuota.isAtLimit) {
      Alert.alert(
        'Límite de 20 imágenes alcanzado',
        'Elegí una imagen que ya está en tu historial o eliminá alguna para subir una nueva.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir historial', onPress: () => setLibraryOpen(true) },
        ],
      );
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Sin acceso a tus fotos',
        'Habilitá el acceso a la galería en los ajustes del teléfono para elegir una imagen.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Comprime en el teléfono; el servidor además la redimensiona y optimiza.
      quality: 0.78,
      allowsEditing: true,
      aspect: aspect === 'wide' ? [16, 9] : [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    // Los mismos límites que el servidor: logo 2 MB, banners/otros 5 MB.
    const maxMb = kind === 'logo' ? 2 : 5;
    if (asset.fileSize && asset.fileSize > maxMb * 1024 * 1024) {
      Alert.alert(
        'Imagen muy pesada',
        `Elegí una imagen de hasta ${maxMb} MB.`,
      );
      return;
    }
    void upload({
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    });
  };

  const shown = preview || value || null;
  const isContain = kind === 'logo' || kind === 'brand';

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <View style={styles.headerActions}>
          {allowHistory ? (
            <Pressable
              onPress={() => setLibraryOpen(true)}
              disabled={uploading || editor.saving}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Abrir historial de medios para ${label}`}
              style={[
                styles.historyPill,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <Ionicons
                name="images-outline"
                size={12}
                color={palette.primary}
              />
              <Text style={styles.historyText}>
                Historial ({mediaQuota.count}/{mediaQuota.limit})
              </Text>
            </Pressable>
          ) : null}
          {shown && onClear && !uploading ? (
            <Pressable
              onPress={onClear}
              disabled={editor.saving}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${label}`}
            >
              <Text style={styles.clearLink}>Quitar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={pick}
        disabled={uploading || editor.saving}
        accessibilityRole="button"
        accessibilityLabel={shown ? `Cambiar ${label}` : `Elegir ${label}`}
        style={[
          styles.box,
          aspect === 'wide' ? styles.wide : styles.square,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        {shown ? (
          <Image
            source={{ uri: shown }}
            style={StyleSheet.absoluteFill}
            contentFit={isContain ? 'contain' : 'cover'}
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons
              name={
                mediaQuota.isAtLimit ? 'albums-outline' : 'cloud-upload-outline'
              }
              size={26}
              color={colors.muted}
            />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {mediaQuota.isAtLimit ? 'Usar del historial' : 'Elegir imagen'}
            </Text>
          </View>
        )}
        {uploading ? (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.overlayText}>Subiendo…</Text>
          </View>
        ) : null}
      </Pressable>

      {failed ? (
        <View style={styles.errorRow}>
          <Text style={styles.error}>{failed.message}</Text>
          <Pressable
            onPress={() => upload(failed.image)}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.retry}>Reintentar</Text>
          </Pressable>
        </View>
      ) : help ? (
        <Text style={[styles.help, { color: colors.muted }]}>{help}</Text>
      ) : null}

      {allowHistory ? (
        <WebsiteMediaLibrarySheet
          visible={libraryOpen}
          defaultSection={MEDIA_SECTION_BY_KIND[kind]}
          onClose={() => setLibraryOpen(false)}
          onSelect={(url) => onUploaded(url)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 13, fontWeight: '700' },
  historyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  historyText: { color: palette.primary, fontSize: 11, fontWeight: '800' },
  clearLink: { color: palette.danger, fontSize: 12, fontWeight: '700' },
  box: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: { width: 120, height: 120 },
  wide: { width: '100%', aspectRatio: 16 / 9 },
  empty: { alignItems: 'center', gap: 4 },
  emptyText: { fontSize: 12, fontWeight: '700' },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2,6,23,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  overlayText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  error: { flex: 1, color: palette.danger, fontSize: 12, fontWeight: '600' },
  retry: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  help: { fontSize: 12 },
});
