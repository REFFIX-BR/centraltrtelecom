import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchCatalogPlans,
  hireSpeedLabel,
  matchHireOfferSpeed,
  pickHirePlans,
  type CatalogPlan,
} from '@/src/services/plans';
import { openHirePlanWhatsApp } from '@/src/services/whatsapp';
import { colors, radius, spacing } from '@/src/theme';
import { formatCurrency, onlyDigits } from '@/src/utils/format';

type Props = {
  visible: boolean;
  document?: string;
  onClose: () => void;
};

export function HirePlansModal({ visible, document, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setError(null);
    setLoading(true);

    void (async () => {
      try {
        const catalog = await fetchCatalogPlans();
        const isPj = onlyDigits(document || '').length === 14;
        const next = pickHirePlans(catalog, { isPj });
        if (!active) return;
        setPlans(next);
        if (!next.length) {
          setError('Nenhum plano disponível no momento. Fale conosco no WhatsApp.');
        }
      } catch (fetchError) {
        if (!active) return;
        setPlans([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Não foi possível carregar os planos.'
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [visible, document]);

  async function handleSelect(plan: CatalogPlan) {
    if (sending) return;
    setSending(true);
    const opened = await openHirePlanWhatsApp({
      planName: plan.displayName,
      speedMbps: matchHireOfferSpeed(plan.downloadMbps) ?? plan.downloadMbps,
      monthlyPrice: plan.monthlyPrice,
      customerDocument: document,
    });
    setSending(false);

    if (!opened) {
      Alert.alert(
        'WhatsApp indisponível',
        'Não foi possível abrir o WhatsApp. Tente novamente.'
      );
      return;
    }

    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>CONTRATAR</Text>
          <Text style={styles.title}>Escolha seu plano</Text>
          <Text style={styles.subtitle}>
            Selecione 50 Mbps, 650 Mbps ou 1 Gbps. Vamos te atender no WhatsApp
            para concluir a contratação.
          </Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>Buscando planos...</Text>
            </View>
          ) : error && plans.length === 0 ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {plans.map((plan) => {
                const featured =
                  matchHireOfferSpeed(plan.downloadMbps) === 650;
                return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="button"
                  disabled={sending}
                  onPress={() => void handleSelect(plan)}
                  style={({ pressed }) => [
                    styles.option,
                    featured && styles.optionFeatured,
                    pressed && styles.optionPressed,
                    sending && styles.optionDisabled,
                  ]}
                >
                  <View style={styles.optionTop}>
                    <Text
                      style={[
                        styles.optionName,
                        featured && styles.optionNameFeatured,
                      ]}
                      numberOfLines={1}
                    >
                      {plan.displayName}
                    </Text>
                    {featured ? (
                      <View style={styles.recommended}>
                        <Text style={styles.recommendedText}>Em vigor</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.optionMeta,
                      featured && styles.optionMetaFeatured,
                    ]}
                  >
                    {hireSpeedLabel(plan.downloadMbps)}
                  </Text>
                  <View style={styles.optionFooter}>
                    <Text
                      style={[
                        styles.optionPrice,
                        featured && styles.optionPriceFeatured,
                      ]}
                    >
                      {formatCurrency(plan.monthlyPrice)}
                      <Text style={styles.optionPriceSuffix}>/mês</Text>
                    </Text>
                    <View
                      style={[
                        styles.optionCta,
                        featured && styles.optionCtaFeatured,
                      ]}
                    >
                      <Ionicons
                        name="logo-whatsapp"
                        size={14}
                        color={featured ? colors.primary : colors.success}
                      />
                      <Text
                        style={[
                          styles.optionCtaText,
                          featured && styles.optionCtaTextFeatured,
                        ]}
                      >
                        Quero este
                      </Text>
                    </View>
                  </View>
                </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            disabled={sending}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelPressed,
            ]}
          >
            <Text style={styles.cancelText}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '86%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  loadingBox: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  option: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentUltraSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  optionFeatured: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.94,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionName: {
    flex: 1,
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  optionNameFeatured: {
    color: colors.white,
  },
  recommended: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  recommendedText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  optionMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  optionMetaFeatured: {
    color: 'rgba(255,255,255,0.78)',
  },
  optionFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionPrice: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  optionPriceFeatured: {
    color: colors.white,
  },
  optionPriceSuffix: {
    fontSize: 12,
    fontWeight: '700',
  },
  optionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  optionCtaFeatured: {
    backgroundColor: colors.white,
  },
  optionCtaText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  optionCtaTextFeatured: {
    color: colors.primary,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.sm,
  },
  cancelPressed: {
    opacity: 0.7,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
});
