import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, usePalette } from '@/lib/palette';
import { uploadWebsiteImage, websiteErrorMessage, type PickedImage } from '@/lib/website-admin';

/**
 * Elegir y subir una imagen del sitio (logo o banner). La nueva solo reemplaza
 * a la anterior cuando el servidor confirmó la subida; si falla, queda la que
 * estaba y se puede reintentar. Nada se borra del almacenamiento.
 */
export function WebsiteImageField({
  label,
  value,
  kind,
  slideId,
  onUploaded,
  aspect = 'square',
  help,
}: {
  label: string;
  value: string | null | undefined;
  kind: 'logo' | 'banner';
  slideId?: string;
  onUploaded: (url: string) => void;
  aspect?: 'square' | 'wide';
  help?: string;
}) {
  const colors = usePalette();
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState<{ image: PickedImage; message: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const upload = async (image: PickedImage) => {
    setUploading(true);
    setFailed(null);
    setPreview(image.uri);
    try {
      const url = await uploadWebsiteImage(kind, image, slideId);
      onUploaded(url);
      setPreview(null);
    } catch (error) {
      setFailed({ image, message: websiteErrorMessage(error, 'No pudimos subir la imagen. Revisá tu conexión e intentá de nuevo.') });
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Sin acceso a tus fotos', 'Habilitá el acceso a la galería en los ajustes del teléfono para elegir una imagen.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Comprime en el teléfono; el servidor además la redimensiona y optimiza.
      quality: 0.75,
      allowsEditing: true,
      aspect: aspect === 'wide' ? [16, 9] : [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    // Los mismos límites que el servidor: logo 2 MB, banners 5 MB.
    const maxMb = kind === 'logo' ? 2 : 5;
    if (asset.fileSize && asset.fileSize > maxMb * 1024 * 1024) {
      Alert.alert('Imagen muy pesada', `Elegí una imagen de hasta ${maxMb} MB.`);
      return;
    }
    void upload({ uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
  };

  const shown = preview || value || null;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Pressable
        onPress={pick}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel={shown ? `Cambiar ${label}` : `Elegir ${label}`}
        style={[styles.box, aspect === 'wide' ? styles.wide : styles.square, { borderColor: colors.border, backgroundColor: colors.background }]}>
        {shown ? (
          <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} contentFit={kind === 'logo' ? 'contain' : 'cover'} />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="image-outline" size={26} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>Elegir imagen</Text>
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
          <Pressable onPress={() => upload(failed.image)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.retry}>Reintentar</Text>
          </Pressable>
        </View>
      ) : help ? (
        <Text style={[styles.help, { color: colors.muted }]}>{help}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700' },
  box: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  square: { width: 120, height: 120 },
  wide: { width: '100%', aspectRatio: 16 / 9 },
  empty: { alignItems: 'center', gap: 4 },
  emptyText: { fontSize: 12, fontWeight: '700' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,6,23,0.55)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  overlayText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  error: { flex: 1, color: palette.danger, fontSize: 12, fontWeight: '600' },
  retry: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  help: { fontSize: 12 },
});
