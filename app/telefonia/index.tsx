import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/src/components/EmptyState';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAccount } from '@/src/contexts/AccountContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { type AppMobilePlan } from '@/src/services/mobilePlans';
import { openMobileInterestWhatsApp, openMobileRechargeWhatsApp } from '@/src/services/whatsapp';
import { colors, radius, shadows, spacing, tabScrollBottom } from '@/src/theme';
import { formatCurrency } from '@/src/utils/format';

type OfferPlan = {
  id: string;
  displayName: string;
  monthlyPrice: number;
  dataLabel: string;
  internetDetail: string | null;
  voiceMinutes: string;
  sms: string;
  benefits: string;
};

function catalogToOffer(plan: AppMobilePlan): OfferPlan {
  const internetDetail =
    plan.portGb > 0 || plan.bonusGb > 0
      ? [
          `${plan.dataGb || plan.totalGb}GB`,
          plan.portGb > 0 ? `${plan.portGb}GB na portabilidade` : null,
          plan.bonusGb > 0 ? `${plan.bonusGb}GB de bônus` : null,
        ]
          .filter(Boolean)
          .join(' + ')
      : null;

  return {
    id: plan.id,
    displayName: plan.displayName,
    monthlyPrice: plan.monthlyPrice,
    dataLabel:
      plan.totalGb > 0
        ? `${plan.totalGb} GB`
        : plan.dataGb > 0
          ? `${plan.dataGb} GB`
          : '—',
    internetDetail,
    voiceMinutes: plan.voiceMinutes || '—',
    sms: plan.sms || '—',
    benefits: plan.benefits || '',
  };
}

function toNum(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function usageRatio(
  used: number | string | null | undefined,
  total: number | string | null | undefined
) {
  const u = toNum(used);
  const t = toNum(total);
  if (u == null || t == null || t <= 0) return 0;
  return Math.min(1, Math.max(0, u / t));
}

function formatQty(value: number | string | null | undefined) {
  const n = toNum(value);
  if (n == null) return '—';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace(/\.0$/, '');
}

function friendlyPlan(name?: string | null, dataGb?: number | null) {
  const text = String(name || '').trim();
  const port = text.match(/(\d+)\s*GB\s*\+\s*(\d+)\s*GB\s*PORTIN/i);
  if (port) {
    return {
      title: `Plano ${port[1]} GB`,
      detail: `+ ${port[2]} GB na portabilidade`,
    };
  }
  const named = text.match(/TRTELECOM[\s_]*([A-Z]+)?[\s_]*(\d+)\s*GB/i);
  if (named?.[2]) {
    const line = named[1] ? named[1].charAt(0) + named[1].slice(1).toLowerCase() : null;
    return {
      title: line ? `${line} ${named[2]} GB` : `Plano ${named[2]} GB`,
      detail: null as string | null,
    };
  }
  if (dataGb != null) {
    return { title: `Plano ${dataGb} GB`, detail: null as string | null };
  }
  return {
    title: text.replace(/^TRTELECOM\s*/i, '').trim() || 'Seu plano',
    detail: null as string | null,
  };
}

function MiniStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.miniStat}>
      <View style={styles.miniStatIcon}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatHint}>{hint}</Text>
    </View>
  );
}

export default function TelefoniaScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { mvno, mobilePlans: catalogPlans, mobileReady, reloadMobile } =
    useAccount();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hasLine = Boolean(mvno?.hasLine && mvno.line);

  const offers = useMemo(
    () => (hasLine ? [] : catalogPlans.map(catalogToOffer)),
    [catalogPlans, hasLine]
  );

  const selected =
    offers.find((plan) => plan.id === selectedId) ?? offers[0] ?? null;

  useFocusEffect(
    useCallback(() => {
      if (mobileReady) return undefined;

      let active = true;
      setLoading(true);
      void reloadMobile().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [mobileReady, reloadMobile])
  );

  useEffect(() => {
    setSelectedId((current) => {
      if (current && offers.some((plan) => plan.id === current)) return current;
      return offers[0]?.id ?? null;
    });
  }, [offers]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reloadMobile();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleInterest(plan: OfferPlan) {
    if (!user) return;
    await openMobileInterestWhatsApp({
      customerName: user.name,
      customerDocument: user.document,
      customerPhone: user.phone,
      customerLogin: user.login,
      contractId: user.plan.contractId,
      planName: plan.displayName,
      totalGb: Number(String(plan.dataLabel).replace(/\D/g, '')) || 0,
      monthlyPrice: plan.monthlyPrice,
      voiceMinutes: plan.voiceMinutes,
      sms: plan.sms,
    });
  }

  const line = mvno?.line;
  const consumption = mvno?.consumption;
  const planInfo = friendlyPlan(line?.planName, line?.planDataGb ?? null);
  const dataRatio = usageRatio(consumption?.dataUsed, consumption?.dataTotal);
  const dataLeft = (() => {
    const used = toNum(consumption?.dataUsed);
    const total = toNum(consumption?.dataTotal);
    if (used == null || total == null) return toNum(consumption?.dataAvailable);
    return Math.max(0, Math.round((total - used) * 10) / 10);
  })();
  const dataExhausted = dataLeft === 0 && toNum(consumption?.dataTotal) != null;
  const isActive = /ativa|active/i.test(String(line?.statusLabel || ''));

  const voiceLeft = (() => {
    const used = toNum(consumption?.voiceUsed);
    const total = toNum(consumption?.voiceTotal);
    if (used == null || total == null) return null;
    return Math.max(0, Math.round((total - used) * 10) / 10);
  })();

  const smsLeft = (() => {
    const used = toNum(consumption?.smsUsed);
    const total = toNum(consumption?.smsTotal);
    if (used == null || total == null) return null;
    return Math.max(0, total - used);
  })();

  async function handleRecharge() {
    if (!user || !line) return;
    const unit = consumption?.dataUnit || 'GB';
    const leftLabel =
      dataLeft == null
        ? null
        : dataExhausted
          ? `Esgotada (0 ${unit})`
          : `${formatQty(dataLeft)} ${unit}`;

    await openMobileRechargeWhatsApp({
      customerName: user.name,
      customerDocument: user.document,
      customerPhone: user.phone,
      customerLogin: user.login,
      contractId: user.plan.contractId,
      lineMsisdn: line.msisdnLabel,
      planName: line.planName,
      planMonthlyPrice: line.planMonthlyPrice,
      dataLeftLabel: leftLabel,
    });
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Telefonia móvel"
        subtitle={
          hasLine
            ? 'Plano atual e consumo da linha'
            : 'Planos com internet, voz e WhatsApp'
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + tabScrollBottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Carregando telefonia…</Text>
          </View>
        ) : hasLine && line ? (
          <View style={styles.subscriberBlock}>
            <View style={styles.identityCard}>
              <View style={styles.identityMedia}>
                <Image
                  source={require('../../assets/images/telefonia-movel-banner.png')}
                  style={styles.identityImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(7,27,56,0.15)', 'rgba(7,27,56,0.92)']}
                  style={styles.identityOverlay}
                >
                  <View style={styles.identityTop}>
                    <Text style={styles.identityEyebrow}>SUA LINHA</Text>
                    <View
                      style={[
                        styles.statusChip,
                        isActive ? styles.statusChipOn : styles.statusChipOff,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: isActive
                              ? '#4ADE9B'
                              : 'rgba(255,255,255,0.55)',
                          },
                        ]}
                      />
                      <Text style={styles.statusChipText}>{line.statusLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.identityNumber}>{line.msisdnLabel}</Text>
                </LinearGradient>
              </View>

              <View style={styles.identityBody}>
                <View style={styles.planRow}>
                  <View style={styles.planCopy}>
                    <Text style={styles.planTitle}>{planInfo.title}</Text>
                    {planInfo.detail ? (
                      <Text style={styles.planDetail}>{planInfo.detail}</Text>
                    ) : null}
                  </View>
                  {line.planMonthlyPrice != null ? (
                    <View style={styles.priceBox}>
                      <Text style={styles.priceAmount}>
                        {formatCurrency(line.planMonthlyPrice)}
                      </Text>
                      <Text style={styles.pricePeriod}>por mês</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.dataCard}>
              <LinearGradient
                colors={
                  dataExhausted
                    ? ['#FFF4F0', '#FFE8E2']
                    : [colors.accentUltraSoft, '#E8F2FF']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dataHero}
              >
                <Text style={styles.dataEyebrow}>
                  {dataExhausted ? 'FRANQUIA ESGOTADA' : 'INTERNET DISPONÍVEL'}
                </Text>
                <Text
                  style={[
                    styles.dataBig,
                    dataExhausted && { color: colors.danger },
                  ]}
                >
                  {formatQty(dataLeft)}
                  <Text style={styles.dataUnit}>
                    {' '}
                    {consumption?.dataUnit || 'GB'}
                  </Text>
                </Text>
                <Text style={styles.dataSub}>
                  {formatQty(consumption?.dataUsed)} de{' '}
                  {formatQty(consumption?.dataTotal)}{' '}
                  {consumption?.dataUnit || 'GB'} usados
                </Text>

                <View style={styles.dataTrack}>
                  <View
                    style={[
                      styles.dataFill,
                      {
                        width: `${Math.round(dataRatio * 100)}%`,
                        backgroundColor: dataExhausted
                          ? colors.danger
                          : colors.accent,
                      },
                    ]}
                  />
                </View>
              </LinearGradient>

              {consumption ? (
                <View style={styles.miniRow}>
                  <MiniStat
                    icon="call-outline"
                    label="Minutos"
                    value={
                      voiceLeft == null
                        ? '—'
                        : voiceLeft === 0
                          ? '0'
                          : formatQty(voiceLeft)
                    }
                    hint={
                      voiceLeft == null
                        ? 'sem dados'
                        : `${formatQty(consumption.voiceUsed)} / ${formatQty(consumption.voiceTotal)} min`
                    }
                  />
                  <MiniStat
                    icon="chatbubble-ellipses-outline"
                    label="SMS"
                    value={
                      smsLeft == null
                        ? '—'
                        : smsLeft === 0
                          ? '0'
                          : formatQty(smsLeft)
                    }
                    hint={
                      smsLeft == null
                        ? 'sem dados'
                        : `${formatQty(consumption.smsUsed)} / ${formatQty(consumption.smsTotal)}`
                    }
                  />
                </View>
              ) : (
                <Text style={styles.emptyUsage}>
                  Consumo indisponível no momento. Puxe para atualizar.
                </Text>
              )}
            </View>

            <Pressable
              onPress={() => void handleRecharge()}
              style={({ pressed }) => [
                styles.rechargeWrap,
                pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
              ]}
            >
              <LinearGradient
                colors={
                  dataExhausted
                    ? ['#1FAD5A', '#128C45']
                    : [colors.primaryLight, colors.primaryDark]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.rechargeBtn}
              >
                <View style={styles.rechargeGlow} />
                <View style={styles.rechargeInner}>
                  <View style={styles.rechargeLead}>
                    <View style={styles.rechargeIcon}>
                      <Ionicons
                        name={dataExhausted ? 'flash' : 'phone-portrait-outline'}
                        size={18}
                        color={colors.white}
                      />
                    </View>
                    <View style={styles.rechargeCopy}>
                      <Text style={styles.rechargeTitle}>
                        {dataExhausted ? 'Recarregar agora' : 'Recarregar chip'}
                      </Text>
                      <Text style={styles.rechargeHint}>
                        {dataExhausted
                          ? 'Sua franquia acabou · fale no WhatsApp'
                          : 'Peça mais dados em poucos toques'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rechargeAction}>
                    <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
                    <Text style={styles.rechargeActionText}>Recarregar</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadIcon}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={18}
                  color={colors.accent}
                />
              </View>
              <View style={styles.sectionHeadCopy}>
                <Text style={styles.sectionTitle}>Planos disponíveis</Text>
                <Text style={styles.sectionHint}>
                  {offers.length > 1
                    ? `${offers.length} opções · toque para ver detalhes`
                    : offers.length === 1
                      ? '1 opção · toque para ver detalhes'
                      : 'Nenhum plano liberado no painel'}
                </Text>
              </View>
            </View>

            {offers.length === 0 ? (
              <EmptyState
                icon="phone-portrait-outline"
                title="Nenhum plano disponível"
                description="Assim que o time liberar os planos no painel, eles aparecem aqui."
              />
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {offers.map((plan) => {
                    const on = selected?.id === plan.id;
                    return (
                      <Pressable
                        key={plan.id}
                        onPress={() => setSelectedId(plan.id)}
                        style={({ pressed }) => [
                          styles.chip,
                          on && styles.chipOn,
                          pressed && { opacity: 0.92 },
                        ]}
                      >
                        {on ? <View style={styles.chipDot} /> : null}
                        <Text style={[styles.chipTitle, on && styles.chipTitleOn]}>
                          {plan.displayName}
                        </Text>
                        <Text style={[styles.chipGb, on && styles.chipGbOn]}>
                          {plan.dataLabel}
                        </Text>
                        <Text style={[styles.chipPrice, on && styles.chipPriceOn]}>
                          {formatCurrency(plan.monthlyPrice)}
                          <Text
                            style={[
                              styles.chipPriceSuffix,
                              on && styles.chipPriceSuffixOn,
                            ]}
                          >
                            /mês
                          </Text>
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {selected ? (
                  <View style={styles.detailCard}>
                    <View style={styles.detailHero}>
                      <Image
                        source={require('../../assets/images/telefonia-movel-banner.png')}
                        style={styles.detailHeroImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['rgba(7,27,56,0.12)', 'rgba(7,27,56,0.9)']}
                        style={styles.detailHeroOverlay}
                      >
                        <Text style={styles.detailEyebrow}>PLANO SELECIONADO</Text>
                        <Text style={styles.detailName}>{selected.displayName}</Text>
                        <View style={styles.detailPriceRow}>
                          <Text style={styles.detailPrice}>
                            {formatCurrency(selected.monthlyPrice)}
                          </Text>
                          <Text style={styles.detailPriceSuffix}>/mês</Text>
                        </View>
                        <View style={styles.detailGbPill}>
                          <Ionicons
                            name="cellular-outline"
                            size={16}
                            color="#4ADE9B"
                          />
                          <Text style={styles.detailGbText}>{selected.dataLabel}</Text>
                        </View>
                      </LinearGradient>
                    </View>

                    <View style={styles.detailBody}>
                      {selected.internetDetail ? (
                        <View style={styles.infoBlock}>
                          <Text style={styles.infoLabel}>Internet</Text>
                          <Text style={styles.infoValue}>
                            {selected.internetDetail}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.metaGrid}>
                        <View style={styles.metaItem}>
                          <Ionicons
                            name="call-outline"
                            size={18}
                            color={colors.accent}
                          />
                          <Text style={styles.metaLabel}>Voz</Text>
                          <Text style={styles.metaValue}>
                            {selected.voiceMinutes}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={18}
                            color={colors.accent}
                          />
                          <Text style={styles.metaLabel}>SMS</Text>
                          <Text style={styles.metaValue}>{selected.sms}</Text>
                        </View>
                      </View>

                      {selected.benefits ? (
                        <View style={styles.benefitsBox}>
                          <Text style={styles.infoLabel}>Benefícios</Text>
                          {selected.benefits.split(',').map((item) => (
                            <View key={item} style={styles.benefitRow}>
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color={colors.success}
                              />
                              <Text style={styles.benefitText}>{item.trim()}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      <Pressable
                        onPress={() => void handleInterest(selected)}
                        style={({ pressed }) => [
                          styles.cta,
                          pressed && {
                            opacity: 0.92,
                            transform: [{ scale: 0.985 }],
                          },
                        ]}
                      >
                        <Ionicons
                          name="logo-whatsapp"
                          size={20}
                          color={colors.white}
                        />
                        <Text style={styles.ctaText}>Quero este plano</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  subscriberBlock: {
    gap: spacing.md,
  },
  identityCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  identityMedia: {
    height: 168,
    backgroundColor: colors.primaryDark,
  },
  identityImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  identityOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  identityEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipOn: {
    backgroundColor: 'rgba(74,222,155,0.18)',
  },
  statusChipOff: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusChipText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  identityNumber: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  identityBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planCopy: {
    flex: 1,
    gap: 4,
  },
  planTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  planDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  pricePeriod: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  dataCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  dataHero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  dataEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dataBig: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 62,
  },
  dataUnit: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  dataSub: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  dataTrack: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(14,44,91,0.08)',
    overflow: 'hidden',
  },
  dataFill: {
    height: '100%',
    borderRadius: 999,
  },
  miniRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  miniStat: {
    flex: 1,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: colors.accentUltraSoft,
    gap: 4,
  },
  miniStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    marginBottom: 4,
  },
  miniStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  miniStatValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  miniStatHint: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyUsage: {
    padding: spacing.lg,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  rechargeWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    ...shadows.card,
  },
  rechargeBtn: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: spacing.md,
  },
  rechargeGlow: {
    position: 'absolute',
    top: -36,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  rechargeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    zIndex: 1,
  },
  rechargeLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rechargeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  rechargeCopy: {
    flex: 1,
    gap: 2,
  },
  rechargeTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  rechargeHint: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600',
  },
  rechargeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  rechargeActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#C9DDF8',
  },
  sectionHeadIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  sectionHeadCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipsRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    minWidth: 118,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.card,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE9B',
    marginBottom: 8,
  },
  chipTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  chipTitleOn: {
    color: colors.white,
  },
  chipGb: {
    marginTop: 4,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  chipGbOn: {
    color: '#4ADE9B',
  },
  chipPrice: {
    marginTop: 8,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  chipPriceOn: {
    color: colors.white,
  },
  chipPriceSuffix: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  chipPriceSuffixOn: {
    color: 'rgba(255,255,255,0.7)',
  },
  detailCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  detailHero: {
    height: 188,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.primaryDark,
  },
  detailHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  detailHeroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xl,
  },
  detailEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  detailName: {
    marginTop: 4,
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
  },
  detailPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: spacing.sm,
  },
  detailPrice: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '900',
  },
  detailPriceSuffix: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailGbPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(74,222,155,0.16)',
  },
  detailGbText: {
    color: '#4ADE9B',
    fontWeight: '900',
    fontSize: 13,
  },
  detailBody: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoBlock: {
    gap: 4,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metaItem: {
    flex: 1,
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentUltraSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  benefitsBox: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  cta: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  ctaText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
});
