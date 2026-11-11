import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  Field,
  Notice,
  SaveBar,
  Section,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
} from '@/components/website/website-ui';
import { SITE_URL } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { saveCompanyInfo, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  isActivatingPublication,
  isDirty,
  mergeSetting,
  publicStoreUrl,
  publicationIssues,
  slugIssue,
  type CompanyInfo,
  type WebsiteSettings,
} from '@/lib/website-model';
import { remainingWebsiteEdits } from '@/lib/website-save-state';

const confirm = (title: string, message: string, action: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: action, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

export default function DomainScreen() {
  return (
    <WebsiteGate title="Dirección y publicación">
      {(settings) => <DomainEditor settings={settings} />}
    </WebsiteGate>
  );
}

function DomainEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const saved = settings.company_info;
  const [patch, setPatch] = useState<Partial<CompanyInfo>>({});
  const [saving, setSaving] = useState(false);

  const company = useMemo(
    () => mergeSetting<CompanyInfo>(saved, patch),
    [saved, patch],
  );
  const dirty = isDirty(saved, company);
  const slug = company.slug ?? '';
  const slugError =
    slug !== (saved.slug ?? '') ? (slugIssue(slug) ?? undefined) : undefined;
  const set = (next: Partial<CompanyInfo>) =>
    setPatch((current) => ({ ...current, ...next }));
  const published = company.storefrontPublic === true;

  const mode = settings.checkout?.commerceMode ?? 'cart';
  const pubIssues = useMemo(
    () => publicationIssues(company, mode),
    [company, mode],
  );

  const save = useCallback(async () => {
    if (slugError) {
      Alert.alert('Revisá la dirección', slugError);
      return false;
    }
    const slugChanged = (patch.slug ?? saved.slug) !== saved.slug;
    if (
      slugChanged &&
      !(await confirm(
        '¿Cambiar la dirección?',
        `Tu tienda va a pasar a ${publicStoreUrl(SITE_URL, slug)?.replace(/^https?:\/\//, '')}. Los enlaces viejos redirigen a la nueva, pero conviene actualizar los que compartiste.`,
        'Cambiar',
      ))
    )
      return false;

    const activating = isActivatingPublication(saved, company);
    if (activating) {
      if (pubIssues.length) {
        Alert.alert('Antes de publicar', pubIssues.join('\n'));
        return false;
      }
      if (
        !(await confirm(
          '¿Publicar tu tienda?',
          'Cualquier persona con el enlace va a poder verla y hacer pedidos o consultas.',
          'Publicar',
        ))
      )
        return false;
    }
    setSaving(true);
    try {
      const result = await saveCompanyInfo(saved, patch, activating);
      applySaved({
        company_info: {
          ...(result ?? company),
          storefrontPublic: company.storefrontPublic,
          marketplacePublic:
            company.storefrontPublic === true &&
            company.marketplacePublic === true,
        },
      });
      setPatch((current) => remainingWebsiteEdits(current, patch));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(
          error,
          'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.',
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [slugError, patch, saved, slug, company, pubIssues, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  const preview = publicStoreUrl(SITE_URL, slug);

  return (
    <WebsiteScreen
      saving={saving}
      title="Dirección y publicación"
      subtitle="Enlace público y visibilidad"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setPatch({})}
        />
      }
    >
      <OfflineNotice />

      <Section
        title="Enlace público de tu tienda"
        icon="link-outline"
        right={
          <StatusPill
            label={published ? 'Pública' : 'No publicada'}
            tone={published ? 'success' : 'warning'}
          />
        }
      >
        <View
          style={[
            styles.urlBox,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <Text
            selectable
            numberOfLines={1}
            style={[styles.url, { color: palette.primary }]}
          >
            {preview ? preview.replace(/^https?:\/\//, '') : 'Sin dirección'}
          </Text>
          {preview ? (
            <View style={styles.urlActions}>
              <Pressable
                onPress={() => void Share.share({ message: preview })}
                style={[styles.iconPill, { borderColor: colors.border }]}
              >
                <Ionicons
                  name="share-outline"
                  size={15}
                  color={palette.primary}
                />
                <Text style={styles.iconPillText}>Compartir</Text>
              </Pressable>
              <Pressable
                onPress={() => void WebBrowser.openBrowserAsync(preview)}
                style={[styles.iconPill, { borderColor: colors.border }]}
              >
                <Ionicons name="open-outline" size={15} color={colors.text} />
                <Text style={[styles.iconPillText, { color: colors.text }]}>
                  Abrir
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Field
          label="Dirección (ruta)"
          value={slug}
          onChangeText={(value) => set({ slug: value.trim().toLowerCase() })}
          placeholder="mi-tienda"
          autoCapitalize="none"
          maxLength={50}
          error={slugError}
          help="Usá letras minúsculas, números y guiones (por ejemplo: tienda-san-jose)."
        />
      </Section>

      {pubIssues.length > 0 ? (
        <Section
          title="Requisitos para publicar"
          icon="checkmark-circle-outline"
          hint="Completá estos puntos antes de hacer pública tu tienda:"
        >
          {pubIssues.map((msg, i) => (
            <Notice
              key={i}
              tone="warning"
              text={msg}
              actionLabel="Ir a Negocio y contacto"
              onAction={() => router.push('/admin/website/business' as never)}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Visibilidad" icon="eye-outline">
        <ToggleRow
          label="Tienda publicada"
          hint="Visible para cualquier persona con el enlace"
          value={published}
          onValueChange={(value) =>
            set({
              storefrontPublic: value,
              ...(value ? {} : { marketplacePublic: false }),
            })
          }
        />
        <ToggleRow
          label="Aparecer en el marketplace"
          hint="Tu comercio se lista en el directorio de MiTiendaPy"
          value={published && company.marketplacePublic === true}
          disabled={!published}
          onValueChange={(value) => set({ marketplacePublic: value })}
        />
        {!published ? (
          <Notice
            tone="warning"
            text="Mientras no esté publicada, quien abra el enlace ve un aviso de tienda cerrada."
          />
        ) : null}
      </Section>

      <Section title="Dominio propio" icon="globe-outline">
        <Text style={[styles.muted, { color: colors.muted }]}>
          Tu tienda ya funciona lista en nuestra dirección con HTTPS automático.
          Dominios personalizados (.com.py / .com) estarán disponibles próximamente.
        </Text>
        <Pressable
          onPress={() => router.push('/admin/website/business' as never)}
          style={[
            websiteStyles.secondaryButton,
            { borderColor: colors.border },
          ]}
        >
          <Ionicons name="storefront-outline" size={16} color={colors.text} />
          <Text style={[websiteStyles.secondaryText, { color: colors.text }]}>
            Revisar datos del negocio
          </Text>
        </Pressable>
      </Section>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  urlBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  url: { fontSize: 15, fontWeight: '800' },
  urlActions: { flexDirection: 'row', gap: 8 },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  iconPillText: { fontSize: 12, fontWeight: '800', color: palette.primary },
  muted: { fontSize: 13, lineHeight: 19 },
});
