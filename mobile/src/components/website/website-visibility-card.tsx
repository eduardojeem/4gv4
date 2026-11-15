import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
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
import { saveCompanyInfo, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  buildVisibilityTogglePatch,
  isActivatingPublication,
  mergeSetting,
  publicationIssues,
  publicationToggleCopy,
  visibilitySummary,
  type CommerceMode,
  type CompanyInfo,
} from '@/lib/website-model';
import {
  Notice,
  Section,
  StatusPill,
  ToggleRow,
  websiteStyles,
} from './website-ui';

const confirmDialog = (
  title: string,
  message: string,
  confirmLabel: string,
  destructive = false,
) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

/**
 * Controles unificados para activar o desactivar la tienda online pública y
 * la aparición en el directorio del Marketplace.
 * - `mode="immediate"`: guarda al instante en el servidor (pantalla principal Sitio web).
 * - `mode="draft"`: actualiza el borrador de la pantalla para guardarse junto con el formulario.
 */
export function WebsiteVisibilityCard({
  company,
  commerceMode = 'cart',
  mode,
  onDraftPatch,
  hideBusinessShortcut = false,
  hideDomainShortcut = false,
}: {
  company: CompanyInfo;
  commerceMode?: CommerceMode;
  mode: 'immediate' | 'draft';
  onDraftPatch?: (patch: Partial<CompanyInfo>) => void;
  hideBusinessShortcut?: boolean;
  hideDomainShortcut?: boolean;
}) {
  const colors = usePalette();
  const { applySaved, canEdit } = useWebsite();
  const [saving, setSaving] = useState(false);

  const summary = visibilitySummary(company);
  const issues = publicationIssues(company, commerceMode);
  const hasSlug = Boolean(company.slug?.trim());

  const applyImmediate = async (
    target: 'storefront' | 'marketplace' | 'all',
    enabled: boolean,
  ) => {
    if (!canEdit || saving) return;
    const nextPatch = buildVisibilityTogglePatch(company, target, enabled);
    const nextCompany = mergeSetting<CompanyInfo>(company, nextPatch);
    const activating = isActivatingPublication(company, nextCompany);

    if (activating) {
      if (!nextCompany.slug?.trim()) {
        Alert.alert(
          'Falta la dirección web',
          'Antes de publicar elegí una dirección web (slug) para tu tienda.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Configurar ruta',
              onPress: () => router.push('/admin/website/domain' as never),
            },
          ],
        );
        return;
      }
      const nextIssues = publicationIssues(nextCompany, commerceMode);
      if (nextIssues.length > 0) {
        Alert.alert(
          'Antes de publicar',
          nextIssues.join('\n'),
          [
            { text: 'Cancelar', style: 'cancel' },
            ...(hideBusinessShortcut
              ? []
              : [
                  {
                    text: 'Completar datos',
                    onPress: () =>
                      router.push('/admin/website/business' as never),
                  },
                ]),
          ],
        );
        return;
      }
    }

    const copy = publicationToggleCopy(company, nextCompany);
    const ok = await confirmDialog(
      copy.title,
      copy.message,
      copy.confirmLabel,
      copy.destructive,
    );
    if (!ok) return;

    setSaving(true);
    try {
      const result = await saveCompanyInfo(company, nextPatch, activating);
      applySaved({
        company_info: {
          ...(result ?? nextCompany),
          storefrontPublic: nextCompany.storefrontPublic === true,
          marketplacePublic:
            nextCompany.storefrontPublic === true &&
            nextCompany.marketplacePublic === true,
        },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert(
        'No pudimos cambiar la visibilidad',
        websiteErrorMessage(
          error,
          'No pudimos actualizar el estado público. Revisá tu conexión e intentá nuevamente.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (
    target: 'storefront' | 'marketplace' | 'all',
    enabled: boolean,
  ) => {
    if (mode === 'draft') {
      const nextPatch = buildVisibilityTogglePatch(company, target, enabled);
      onDraftPatch?.(nextPatch);
      void Haptics.selectionAsync();
      return;
    }
    void applyImmediate(target, enabled);
  };

  return (
    <Section
      title="Visibilidad pública"
      icon="globe-outline"
      hint="Activá o desactivá cuándo querés aparecer en línea."
      right={
        <View style={styles.rightRow}>
          {saving ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : null}
          <StatusPill label={summary.statusLabel} tone={summary.statusTone} />
        </View>
      }
    >
      <ToggleRow
        label="Tienda online pública"
        hint={
          summary.storefrontPublic
            ? 'Activa: cualquier persona con tu enlace puede ver la tienda y comprar o consultar.'
            : 'Desactivada: quienes abran tu enlace verán un aviso de tienda cerrada.'
        }
        badge={summary.storefrontPublic ? 'Activa' : undefined}
        value={summary.storefrontPublic}
        disabled={saving || (mode === 'immediate' && !canEdit)}
        onValueChange={(value) => handleToggle('storefront', value)}
      />

      <ToggleRow
        label="Visible en el Marketplace"
        hint={
          summary.marketplacePublic
            ? 'Tu negocio y productos visibles aparecen en el directorio general de MiTiendaPy.'
            : summary.storefrontPublic
              ? 'Oculta en el catálogo general; solo accesible con tu enlace directo.'
              : 'Al activarlo, publica también tu tienda online y te suma al Marketplace.'
        }
        badge={summary.marketplacePublic ? 'Activa' : undefined}
        value={summary.marketplacePublic}
        disabled={saving || (mode === 'immediate' && !canEdit)}
        onValueChange={(value) => handleToggle('marketplace', value)}
      />

      {!summary.marketplacePublic ? (
        <Pressable
          onPress={() => handleToggle('all', true)}
          disabled={saving || (mode === 'immediate' && !canEdit)}
          accessibilityRole="button"
          style={[
            websiteStyles.primaryButton,
            { opacity: saving ? 0.65 : 1 },
          ]}
        >
          <Ionicons name="rocket-outline" size={17} color="#fff" />
          <Text style={websiteStyles.primaryText}>
            {summary.storefrontPublic
              ? 'Sumar al Marketplace'
              : 'Activar web y Marketplace'}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => handleToggle('all', false)}
          disabled={saving || (mode === 'immediate' && !canEdit)}
          accessibilityRole="button"
          style={[
            styles.pauseBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              opacity: saving ? 0.65 : 1,
            },
          ]}
        >
          <Ionicons name="pause-circle-outline" size={16} color={colors.muted} />
          <Text style={[styles.pauseText, { color: colors.text }]}>
            Pausar web y Marketplace
          </Text>
        </Pressable>
      )}

      {!summary.storefrontPublic && !hasSlug ? (
        <Notice
          tone="warning"
          text="Falta definir la dirección web (slug) de tu tienda para poder publicarla."
          actionLabel={hideDomainShortcut ? undefined : 'Configurar enlace'}
          onAction={
            hideDomainShortcut
              ? undefined
              : () => router.push('/admin/website/domain' as never)
          }
        />
      ) : null}

      {!summary.storefrontPublic && issues.length > 0 ? (
        <Notice
          tone="warning"
          text={`Para publicar primero completá: ${issues.join(' ')}`}
          actionLabel={hideBusinessShortcut ? undefined : 'Completar datos'}
          onAction={
            hideBusinessShortcut
              ? undefined
              : () => router.push('/admin/website/business' as never)
          }
        />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  pauseText: { fontSize: 13, fontWeight: '700' },
});
