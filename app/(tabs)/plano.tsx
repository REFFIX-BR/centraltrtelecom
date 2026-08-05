import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/src/components/Card';
import { TabHeader } from '@/src/components/TabHeader';
import { useAccount } from '@/src/contexts/AccountContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { formatConnectedTime } from '@/src/services/connection';
import {
  fetchConnectionHistory,
  summarizeConnectionHistory,
  type ConnectionSession,
} from '@/src/services/connectionHistory';
import { pickNextInvoice } from '@/src/services/invoices';
import {
  submitUpgradeSale,
  type UpgradeOffer,
} from '@/src/services/commercial';
import { openUpgradeWhatsApp } from '@/src/services/whatsapp';
import {
  customerKeyFrom,
  daysLeftLabel,
  promotePendingToActivated,
  savePendingUpgrade,
  type ActivatedUpgrade,
  type PendingUpgrade,
} from '@/src/services/pendingUpgrade';
import {
  classifySaleStatus,
  type UpgradeProgressStep,
} from '@/src/services/saleStatus';
import { loadAndSyncUpgrade, syncPendingUpgradeFromComercial } from '@/src/services/syncUpgradeStatus';
import { speedGainLabel } from '@/src/services/plans';
import { colors, radius, shadows, spacing, tabScrollBottom } from '@/src/theme';
import { formatCurrency } from '@/src/utils/format';

function planStatusLabel(status: string | undefined): string {
  const value = (status || '').trim().toUpperCase();
  if (!value || value === 'DESCONHECIDO') return 'Não informado';
  if (value === 'ACTIVE' || value === 'ATIVO') return 'Ativo';
  if (value === 'BLOCKED' || value === 'BLOQUEADO') return 'Bloqueado';
  if (value.includes('SUSP')) return 'Suspenso por débito';
  return status?.trim() || 'Não informado';
}

function dueDayLabel(dueDate?: string): string {
  if (!dueDate) return 'Não informado';
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return `Dia ${String(date.getDate()).padStart(2, '0')}/cada mês`;
}

function UpgradePulseCue({
  title,
  subtitle,
  pending = false,
  onPress,
}: {
  title: string;
  subtitle: string;
  pending?: boolean;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const accent = pending ? '#F5C84C' : '#4ADE9B';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.55],
  });
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });
  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pending ? 'Ver andamento do upgrade' : 'Ver upgrades disponíveis'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.upgradeCue,
        pending && styles.upgradeCuePending,
        pressed && styles.upgradeCuePressed,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.upgradeCueGlow,
          pending && styles.upgradeCueGlowPending,
          { opacity: glowOpacity },
        ]}
      />
      <Animated.View
        style={[
          styles.upgradeCueIcon,
          pending && styles.upgradeCueIconPending,
          { transform: [{ scale }] },
        ]}
      >
        <Animated.View
          style={[
            styles.upgradeCueDot,
            pending && styles.upgradeCueDotPending,
            { opacity: dotOpacity },
          ]}
        />
        <Ionicons
          name={pending ? 'time-outline' : 'rocket-outline'}
          size={16}
          color={accent}
        />
      </Animated.View>
      <View style={styles.upgradeCueCopy}>
        <View style={styles.upgradeCueTitleRow}>
          <Text style={[styles.upgradeCueTitle, pending && styles.upgradeCueTitlePending]}>
            {title}
          </Text>
          <Animated.View
            style={[
              styles.upgradeLiveDot,
              pending && styles.upgradeLiveDotPending,
              { opacity: dotOpacity },
            ]}
          />
        </View>
        <Text style={styles.upgradeCueSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
}

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { connection, reload, mvno, mobilePlans, upgrades } = useAccount();
  const [refreshing, setRefreshing] = useState(false);
  const [historyPreview, setHistoryPreview] = useState<ConnectionSession[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<UpgradeOffer | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    planName: string;
    speedMbps: number;
    price: number;
    saleId: string | null;
    status: string;
  } | null>(null);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [pendingUpgrade, setPendingUpgrade] = useState<PendingUpgrade | null>(
    null
  );
  const [activatedUpgrade, setActivatedUpgrade] =
    useState<ActivatedUpgrade | null>(null);
  const [upgradeStep, setUpgradeStep] = useState<UpgradeProgressStep>(2);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [activatedOpen, setActivatedOpen] = useState(false);

  const mobilePlansCount = mobilePlans.length;
  const mobileFromPrice = useMemo(
    () =>
      mobilePlans.length
        ? Math.min(...mobilePlans.map((plan) => plan.monthlyPrice || 0))
        : null,
    [mobilePlans]
  );
  const mvnoLine = mvno;

  const planName = connection?.planName || user?.plan.name || '';
  const speedMbps = connection?.speedMbps || user?.plan.speedMbps || 0;

  const loadHistory = useCallback(async () => {
    if (!user?.login) return;
    try {
      setHistoryError(null);
      const sessions = await fetchConnectionHistory(user.login);
      setHistoryPreview(sessions.slice(0, 1));
    } catch (error) {
      setHistoryPreview([]);
      setHistoryError(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o extrato.'
      );
    }
  }, [user?.login]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!user) {
      setPendingUpgrade(null);
      setActivatedUpgrade(null);
      setUpgradeStep(2);
      return;
    }

    const key = customerKeyFrom(user.document, user.login);
    let cancelled = false;

    void (async () => {
      const synced = await loadAndSyncUpgrade({
        documento: user.document,
        customerKey: key,
      });
      if (cancelled) return;

      // Velocidade já alcançou o pedido → promove para “ativado” por 3 dias.
      if (
        synced.pending &&
        speedMbps > 0 &&
        speedMbps >= synced.pending.speedMbps
      ) {
        const next = await promotePendingToActivated(synced.pending);
        if (cancelled) return;
        setPendingUpgrade(null);
        setActivatedUpgrade(next);
        setUpgradeStep(3);
        return;
      }

      setPendingUpgrade(synced.pending);
      setActivatedUpgrade(synced.activated);
      setUpgradeStep(synced.activeStep);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, speedMbps]);

  const refreshUpgradeStatus = useCallback(async () => {
    if (!user) return;
    const key = customerKeyFrom(user.document, user.login);
    const pending = pendingUpgrade;
    if (!pending) {
      const synced = await loadAndSyncUpgrade({
        documento: user.document,
        customerKey: key,
      });
      setPendingUpgrade(synced.pending);
      setActivatedUpgrade(synced.activated);
      setUpgradeStep(synced.activeStep);
      return;
    }

    try {
      const synced = await syncPendingUpgradeFromComercial({
        documento: user.document,
        customerKey: key,
        pending,
      });
      setPendingUpgrade(synced.pending);
      setActivatedUpgrade(synced.activated);
      setUpgradeStep(synced.activeStep);
      if (!synced.pending && synced.activated) {
        setPendingOpen(false);
        setActivatedOpen(true);
      }
    } catch {
      const local = classifySaleStatus(pending.status);
      setUpgradeStep(local.activeStep);
    }
  }, [user, pendingUpgrade]);

  const nextInvoice = useMemo(
    () => (user ? pickNextInvoice(user.invoices) : null),
    [user]
  );

  const summary = useMemo(
    () => summarizeConnectionHistory(historyPreview),
    [historyPreview]
  );

  const bestUpgrade = upgrades[0] ?? null;

  if (!user) return null;

  const amount =
    user.plan.price > 0
      ? formatCurrency(user.plan.price)
      : nextInvoice
        ? formatCurrency(nextInvoice.amount)
        : 'Não informado';

  const contractNumber =
    connection?.clientCode || user.plan.contractId || 'Não informado';

  const contractStatus = planStatusLabel(
    connection?.contractStatus || user.plan.status
  );
  const isOnline = connection?.isOnline ?? false;

  function requestUpgrade(plan: UpgradeOffer) {
    setSheetOpen(false);
    setConfirmPlan(plan);
  }

  async function sendUpgrade(plan: UpgradeOffer) {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitUpgradeSale({
        user,
        plan,
        commercialPlanId: plan.commercialPlanId,
        currentPlanName: planName,
        currentSpeedMbps: speedMbps,
        connectionAddressParts: connection?.addressParts,
        connectionAddress: connection?.address,
      });

      setConfirmPlan(null);
      const saved = await savePendingUpgrade({
        customerKey: customerKeyFrom(user.document, user.login),
        planName: plan.displayName || plan.name,
        speedMbps: plan.downloadMbps,
        price: plan.monthlyPrice,
        saleId: result.saleId,
        status: result.status || 'Aguardando Análise',
        currentPlanName: planName,
        currentSpeedMbps: speedMbps,
      });
      setPendingUpgrade(saved);
      setUpgradeStep(classifySaleStatus(saved.status).activeStep);
      setSuccessInfo({
        planName: plan.displayName,
        speedMbps: plan.downloadMbps,
        price: plan.monthlyPrice,
        saleId: result.saleId,
        status: result.status,
      });

      void openUpgradeWhatsApp({
        customerName: user.name,
        customerDocument: user.document,
        customerPhone: user.phone,
        customerLogin: user.login,
        contractId: user.plan.contractId,
        currentPlanName: planName,
        currentSpeedMbps: speedMbps,
        requestedPlanName: plan.displayName || plan.name,
        requestedSpeedMbps: plan.downloadMbps,
        monthlyPrice: plan.monthlyPrice,
        saleId: result.saleId,
        status: result.status,
      });
    } catch (error) {
      setConfirmPlan(null);
      setErrorInfo(
        error instanceof Error
          ? error.message
          : 'Tente novamente em instantes ou fale com o suporte.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([reload(), loadHistory(), refreshUpgradeStatus()]);
    } finally {
      setRefreshing(false);
    }
  }

  function openPendingUpgrade() {
    setPendingOpen(true);
    void refreshUpgradeStatus();
  }

  function progressDotFor(step: UpgradeProgressStep) {
    if (upgradeStep > step) return [styles.progressDot, styles.progressDotDone];
    if (upgradeStep === step) {
      return [styles.progressDot, styles.progressDotCurrent];
    }
    return [styles.progressDot];
  }

  return (
    <View style={styles.flex}>
      <TabHeader
        eyebrow="MEU PLANO"
        title="Meu plano"
        subtitle="Pagamento, contrato e extrato"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + tabScrollBottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.primaryDark, colors.primary, colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroGlowSoft} />

          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>SEU PLANO</Text>
            </View>
            <View
              style={[
                styles.liveBadge,
                {
                  backgroundColor: isOnline
                    ? 'rgba(74,222,155,0.18)'
                    : 'rgba(214,69,69,0.18)',
                },
              ]}
            >
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: isOnline ? '#4ADE9B' : colors.danger },
                ]}
              />
              <Text
                style={[
                  styles.liveText,
                  { color: isOnline ? '#4ADE9B' : '#FF8F8F' },
                ]}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroPlan}>{planName}</Text>

          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>
                {speedMbps > 0 ? speedMbps : '—'}
              </Text>
              <Text style={styles.heroMetricLabel}>Mbps</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>
                {isOnline
                  ? formatConnectedTime(connection?.connectedMinutes ?? 0)
                  : '—'}
              </Text>
              <Text style={styles.heroMetricLabel}>conectado</Text>
            </View>
          </View>

          <View style={styles.heroFooter}>
            <Ionicons
              name={isOnline ? 'shield-checkmark' : 'warning-outline'}
              size={16}
              color={isOnline ? '#4ADE9B' : '#FFB4B4'}
            />
            <Text style={styles.heroFooterText}>
              {isOnline
                ? 'Conexão ativa e estável'
                : 'Sem conexão no momento — reinicie o roteador'}
            </Text>
          </View>

          {pendingUpgrade ? (
            <UpgradePulseCue
              pending
              title={`Upgrade para ${pendingUpgrade.speedMbps} Mbps pendente`}
              subtitle={`${pendingUpgrade.status} · toque para ver o andamento`}
              onPress={openPendingUpgrade}
            />
          ) : activatedUpgrade ? (
            <UpgradePulseCue
              title={`Upgrade para ${activatedUpgrade.speedMbps} Mbps ativado`}
              subtitle={`${daysLeftLabel(activatedUpgrade.expiresAt)} · toque para detalhes`}
              onPress={() => setActivatedOpen(true)}
            />
          ) : bestUpgrade ? (
            <UpgradePulseCue
              title="Upgrade disponível"
              subtitle={`Até ${bestUpgrade.downloadMbps} Mbps · a partir de ${formatCurrency(bestUpgrade.monthlyPrice)}`}
              onPress={() => setSheetOpen(true)}
            />
          ) : null}
        </LinearGradient>

        {mvnoLine?.hasLine && mvnoLine.line ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver consumo e extrato do chip"
            onPress={() => router.push('/telefonia')}
            style={({ pressed }) => [
              styles.mobileEntry,
              pressed && styles.mobileEntryPressed,
            ]}
          >
            <Image
              source={require('../../assets/images/telefonia-movel-banner.png')}
              style={styles.mobileEntryImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(7,27,56,0.2)', 'rgba(7,27,56,0.92)']}
              style={styles.mobileEntryOverlay}
            >
              <View style={styles.mobileEntryBadge}>
                <Ionicons name="cellular-outline" size={12} color="#4ADE9B" />
                <Text style={styles.mobileEntryBadgeText}>MEU CHIP</Text>
              </View>
              <Text style={styles.mobileEntryTitle}>
                {mvnoLine.line.msisdnLabel}
              </Text>
              <Text style={styles.mobileEntrySubtitle}>
                {[
                  mvnoLine.line.planName,
                  (() => {
                    const used = Number(mvnoLine.consumption?.dataUsed);
                    const total = Number(mvnoLine.consumption?.dataTotal);
                    const unit = mvnoLine.consumption?.dataUnit || 'GB';
                    if (!Number.isFinite(used) || !Number.isFinite(total)) {
                      return mvnoLine.line.statusLabel;
                    }
                    const left = Math.max(
                      0,
                      Math.round((total - used) * 10) / 10
                    );
                    return left <= 0
                      ? `Franquia esgotada · ${total} ${unit}`
                      : `${left} ${unit} disponíveis`;
                  })(),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <View style={styles.mobileEntryCta}>
                <Text style={styles.mobileEntryCtaText}>Ver consumo do chip</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.white} />
              </View>
            </LinearGradient>
          </Pressable>
        ) : mobilePlansCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver planos de telefonia móvel"
            onPress={() => router.push('/telefonia')}
            style={({ pressed }) => [
              styles.mobileEntry,
              pressed && styles.mobileEntryPressed,
            ]}
          >
            <Image
              source={require('../../assets/images/telefonia-movel-banner.png')}
              style={styles.mobileEntryImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(7,27,56,0.15)', 'rgba(7,27,56,0.88)']}
              style={styles.mobileEntryOverlay}
            >
              <View style={styles.mobileEntryBadge}>
                <Ionicons name="phone-portrait-outline" size={12} color="#4ADE9B" />
                <Text style={styles.mobileEntryBadgeText}>TELEFONIA MÓVEL</Text>
              </View>
              <Text style={styles.mobileEntryTitle}>Chip TR Telecom</Text>
              <Text style={styles.mobileEntrySubtitle}>
                {mobilePlansCount}{' '}
                {mobilePlansCount > 1 ? 'planos disponíveis' : 'plano disponível'}
                {mobileFromPrice != null
                  ? ` · a partir de ${formatCurrency(mobileFromPrice)}`
                  : ''}
              </Text>
              <View style={styles.mobileEntryCta}>
                <Text style={styles.mobileEntryCtaText}>Ver planos</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.white} />
              </View>
            </LinearGradient>
          </Pressable>
        ) : null}

        <Text style={styles.sectionTitle}>Informações de pagamento</Text>

        <InfoCard>
          <InlineField label="Valor" value={amount} />
        </InfoCard>

        <InfoCard>
          <InlineField
            label="Vencimento"
            value={dueDayLabel(nextInvoice?.dueDate)}
          />
        </InfoCard>

        <InfoCard>
          <StackedField label="Forma de pagamento" value="Boleto" />
        </InfoCard>

        <InfoCard>
          <View style={styles.emailRow}>
            <View style={styles.emailBody}>
              <StackedField
                label="E-mail"
                value={user.email || 'Não informado'}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Alterar e-mail"
              onPress={() =>
                Alert.alert(
                  'Alterar e-mail',
                  'A alteração de e-mail será liberada em breve.'
                )
              }
              hitSlop={8}
            >
              <Ionicons name="pencil" size={16} color={colors.text} />
            </Pressable>
          </View>
        </InfoCard>

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
          Informações de contrato
        </Text>

        <InfoCard>
          <StackedField label="Nº do contrato" value={contractNumber} />
        </InfoCard>

        <InfoCard>
          <InlineField label="Status" value={contractStatus} />
        </InfoCard>

        <InfoCard>
          <StackedField
            label="Endereço de instalação"
            value={user.address || 'Não informado'}
          />
        </InfoCard>

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
          Extrato de conexão
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/extrato')}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.extractCard}>
            <View style={styles.extractTop}>
              <View style={styles.extractIcon}>
                <Ionicons name="stats-chart-outline" size={22} color={colors.accent} />
              </View>
              <View style={styles.extractHeading}>
                <Text style={styles.extractTitle}>Extrato de conexão</Text>
                <Text style={styles.extractSubtitle}>
                  {historyError
                    ? 'Toque para tentar novamente'
                    : summary.online
                      ? `Online · ${summary.online.duration.replace(/^Online ·\s*/i, '')}`
                      : summary.lastEnded
                        ? `Última sessão · ${summary.lastEnded.startedAt}`
                        : 'Ver histórico de sessões'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>

            {summary.online || summary.lastEnded ? (
              <View style={styles.extractStats}>
                <View style={styles.extractStat}>
                  <Text style={styles.extractStatLabel}>Upload</Text>
                  <Text style={styles.extractStatValue}>
                    {(summary.online ?? summary.lastEnded)?.upload}
                  </Text>
                </View>
                <View style={styles.extractDivider} />
                <View style={styles.extractStat}>
                  <Text style={styles.extractStatLabel}>Download</Text>
                  <Text style={styles.extractStatValue}>
                    {(summary.online ?? summary.lastEnded)?.download}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.extractLink}>Ver extrato completo</Text>
          </Card>
        </Pressable>
      </ScrollView>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSheetOpen(false)}
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>UPGRADE</Text>
            <Text style={styles.sheetTitle}>Mais velocidade para você</Text>
            <Text style={styles.sheetSubtitle}>
              Opções em vigor agora, acima do seu plano de{' '}
              {speedMbps > 0 ? `${speedMbps} Mbps` : 'hoje'}.
            </Text>

            <View style={styles.sheetList}>
              {upgrades.map((plan, index) => (
                <Pressable
                  key={plan.id}
                  accessibilityRole="button"
                  onPress={() => requestUpgrade(plan)}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.sheetOption,
                    index === 0 && styles.sheetOptionFeatured,
                    pressed && styles.pressed,
                    submitting && { opacity: 0.6 },
                  ]}
                >
                  <View style={styles.sheetOptionTop}>
                    <Text
                      style={[
                        styles.sheetOptionName,
                        index === 0 && styles.sheetOptionNameFeatured,
                      ]}
                      numberOfLines={1}
                    >
                      {plan.displayName}
                    </Text>
                    {index === 0 ? (
                      <View style={styles.sheetRecommended}>
                        <Text style={styles.sheetRecommendedText}>Próximo</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.sheetOptionMeta,
                      index === 0 && styles.sheetOptionMetaFeatured,
                    ]}
                  >
                    {plan.downloadMbps} Mbps ·{' '}
                    {speedGainLabel(speedMbps, plan.downloadMbps)}
                  </Text>
                  <View style={styles.sheetOptionFooter}>
                    <Text
                      style={[
                        styles.sheetOptionPrice,
                        index === 0 && styles.sheetOptionPriceFeatured,
                      ]}
                    >
                      {formatCurrency(plan.monthlyPrice)}
                      <Text style={styles.sheetOptionPriceSuffix}>/mês</Text>
                    </Text>
                    <View
                      style={[
                        styles.sheetOptionCta,
                        index === 0 && styles.sheetOptionCtaFeatured,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sheetOptionCtaText,
                          index === 0 && styles.sheetOptionCtaTextFeatured,
                        ]}
                      >
                        Quero este
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={index === 0 ? colors.primary : colors.accent}
                      />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setSheetOpen(false)}
              style={styles.sheetClose}
            >
              <Text style={styles.sheetCloseText}>Fechar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!confirmPlan}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submitting) setConfirmPlan(null);
        }}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconWrap}>
              <LinearGradient
                colors={[colors.primaryDark, colors.primaryLight]}
                style={styles.dialogIcon}
              >
                <Ionicons name="rocket-outline" size={26} color={colors.white} />
              </LinearGradient>
            </View>
            <Text style={styles.dialogEyebrow}>CONFIRMAR UPGRADE</Text>
            <Text style={styles.dialogTitle}>Quer mais velocidade?</Text>
            <Text style={styles.dialogText}>
              Vamos enviar sua solicitação para o comercial analisar e concluir a
              migração.
            </Text>

            {confirmPlan ? (
              <View style={styles.dialogPlanBox}>
                <Text style={styles.dialogPlanName}>{confirmPlan.displayName}</Text>
                <Text style={styles.dialogPlanMeta}>
                  {confirmPlan.downloadMbps} Mbps ·{' '}
                  {formatCurrency(confirmPlan.monthlyPrice)}/mês
                </Text>
              </View>
            ) : null}

            <View style={styles.dialogActions}>
              <Pressable
                disabled={submitting}
                onPress={() => setConfirmPlan(null)}
                style={({ pressed }) => [
                  styles.dialogGhostBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dialogGhostText}>Agora não</Text>
              </Pressable>
              <Pressable
                disabled={submitting || !confirmPlan}
                onPress={() => {
                  if (confirmPlan) void sendUpgrade(confirmPlan);
                }}
                style={({ pressed }) => [
                  styles.dialogPrimaryBtn,
                  pressed && styles.pressed,
                  submitting && { opacity: 0.75 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.dialogPrimaryText}>Confirmar</Text>
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!successInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessInfo(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <View style={[styles.dialogIconWrap, styles.dialogIconSuccess]}>
              <Ionicons name="checkmark-circle" size={42} color={colors.success} />
            </View>
            <Text style={styles.dialogEyebrow}>TUDO CERTO</Text>
            <Text style={styles.dialogTitle}>Solicitação enviada</Text>
            <Text style={styles.dialogText}>
              Recebemos seu pedido de upgrade. O time comercial entra em contato
              para concluir.
            </Text>

            {successInfo ? (
              <View style={styles.dialogPlanBox}>
                <Text style={styles.dialogPlanName}>{successInfo.planName}</Text>
                <Text style={styles.dialogPlanMeta}>
                  {successInfo.speedMbps} Mbps ·{' '}
                  {formatCurrency(successInfo.price)}/mês
                </Text>
                <View style={styles.dialogStatusRow}>
                  <View style={styles.dialogStatusChip}>
                    <Text style={styles.dialogStatusChipText}>
                      {successInfo.status}
                    </Text>
                  </View>
                </View>
                {successInfo.saleId ? (
                  <Text style={styles.dialogProtocol}>
                    Protocolo{' '}
                    <Text style={styles.dialogProtocolId}>
                      {successInfo.saleId.slice(0, 8).toUpperCase()}
                    </Text>
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              onPress={() => setSuccessInfo(null)}
              style={({ pressed }) => [
                styles.dialogPrimaryBtn,
                styles.dialogPrimaryFull,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dialogPrimaryText}>Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingOpen && !!pendingUpgrade}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingOpen(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <View style={[styles.dialogIconWrap, styles.dialogIconPending]}>
              <Ionicons name="time-outline" size={28} color="#C98912" />
            </View>
            <Text style={styles.dialogEyebrow}>ANDAMENTO</Text>
            <Text style={styles.dialogTitle}>Upgrade em análise</Text>
            <Text style={styles.dialogText}>
              Sua solicitação foi recebida. Acompanhe o status abaixo enquanto o
              time comercial conclui a migração.
            </Text>

            {pendingUpgrade ? (
              <View style={styles.dialogPlanBox}>
                <Text style={styles.dialogPlanName}>
                  {pendingUpgrade.planName}
                </Text>
                <Text style={styles.dialogPlanMeta}>
                  {pendingUpgrade.speedMbps} Mbps ·{' '}
                  {formatCurrency(pendingUpgrade.price)}/mês
                </Text>
                <View style={styles.dialogStatusRow}>
                  <View style={styles.dialogStatusChip}>
                    <Text style={styles.dialogStatusChipText}>
                      {pendingUpgrade.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.dialogProtocol}>
                  Protocolo{' '}
                  <Text style={styles.dialogProtocolId}>
                    {pendingUpgrade.protocol}
                  </Text>
                </Text>
              </View>
            ) : null}

            <View style={styles.progressSteps}>
              <View style={styles.progressStep}>
                <View style={progressDotFor(1)} />
                <View style={styles.progressCopy}>
                  <Text style={styles.progressTitle}>Solicitação enviada</Text>
                  <Text style={styles.progressMeta}>
                    Comercial e WhatsApp notificados
                  </Text>
                </View>
              </View>
              <View style={styles.progressStep}>
                <View style={progressDotFor(2)} />
                <View style={styles.progressCopy}>
                  <Text
                    style={[
                      styles.progressTitle,
                      upgradeStep < 2 && styles.progressMuted,
                    ]}
                  >
                    Em análise
                  </Text>
                  <Text style={styles.progressMeta}>
                    {upgradeStep > 2
                      ? 'Análise concluída pelo comercial'
                      : upgradeStep === 2
                        ? pendingUpgrade?.status ||
                          'Equipe comercial validando o upgrade'
                        : 'Aguardando análise'}
                  </Text>
                </View>
              </View>
              <View style={styles.progressStep}>
                <View style={progressDotFor(3)} />
                <View style={styles.progressCopy}>
                  <Text
                    style={[
                      styles.progressTitle,
                      upgradeStep < 3 && styles.progressMuted,
                    ]}
                  >
                    Ativação
                  </Text>
                  <Text style={styles.progressMeta}>
                    {upgradeStep >= 3
                      ? pendingUpgrade?.status ||
                        'Aguardando liberação da velocidade'
                      : 'Velocidade liberada no seu plano'}
                  </Text>
                </View>
              </View>
            </View>

            {pendingUpgrade ? (
              <Text style={styles.progressFromTo}>
                De {pendingUpgrade.currentPlanName || 'plano atual'}
                {pendingUpgrade.currentSpeedMbps
                  ? ` (${pendingUpgrade.currentSpeedMbps} Mbps)`
                  : ''}{' '}
                → {pendingUpgrade.speedMbps} Mbps
              </Text>
            ) : null}

            <Pressable
              onPress={() => setPendingOpen(false)}
              style={({ pressed }) => [
                styles.dialogPrimaryBtn,
                styles.dialogPrimaryFull,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dialogPrimaryText}>Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={activatedOpen && !!activatedUpgrade}
        transparent
        animationType="fade"
        onRequestClose={() => setActivatedOpen(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <View style={[styles.dialogIconWrap, styles.dialogIconSuccess]}>
              <Ionicons name="checkmark-circle" size={42} color={colors.success} />
            </View>
            <Text style={styles.dialogEyebrow}>ATIVADO</Text>
            <Text style={styles.dialogTitle}>Upgrade concluído</Text>
            <Text style={styles.dialogText}>
              Sua nova velocidade já está liberada. Este aviso fica visível por
              3 dias e depois some automaticamente.
            </Text>

            {activatedUpgrade ? (
              <View style={styles.dialogPlanBox}>
                <Text style={styles.dialogPlanName}>
                  {activatedUpgrade.planName}
                </Text>
                <Text style={styles.dialogPlanMeta}>
                  {activatedUpgrade.speedMbps} Mbps ·{' '}
                  {formatCurrency(activatedUpgrade.price)}/mês
                </Text>
                <View style={styles.dialogStatusRow}>
                  <View
                    style={[styles.dialogStatusChip, styles.dialogStatusChipOk]}
                  >
                    <Text
                      style={[
                        styles.dialogStatusChipText,
                        styles.dialogStatusChipTextOk,
                      ]}
                    >
                      Ativado
                    </Text>
                  </View>
                </View>
                <Text style={styles.dialogProtocol}>
                  Protocolo{' '}
                  <Text style={styles.dialogProtocolId}>
                    {activatedUpgrade.protocol}
                  </Text>
                </Text>
              </View>
            ) : null}

            <View style={styles.progressSteps}>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, styles.progressDotDone]} />
                <View style={styles.progressCopy}>
                  <Text style={styles.progressTitle}>Solicitação enviada</Text>
                  <Text style={styles.progressMeta}>Pedido recebido</Text>
                </View>
              </View>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, styles.progressDotDone]} />
                <View style={styles.progressCopy}>
                  <Text style={styles.progressTitle}>Análise concluída</Text>
                  <Text style={styles.progressMeta}>Upgrade aprovado</Text>
                </View>
              </View>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, styles.progressDotDone]} />
                <View style={styles.progressCopy}>
                  <Text style={styles.progressTitle}>Ativado</Text>
                  <Text style={styles.progressMeta}>
                    {activatedUpgrade
                      ? daysLeftLabel(activatedUpgrade.expiresAt)
                      : 'Visível por 3 dias'}
                  </Text>
                </View>
              </View>
            </View>

            {activatedUpgrade ? (
              <Text style={styles.progressFromTo}>
                De {activatedUpgrade.previousPlanName || 'plano anterior'}
                {activatedUpgrade.previousSpeedMbps
                  ? ` (${activatedUpgrade.previousSpeedMbps} Mbps)`
                  : ''}{' '}
                → {activatedUpgrade.speedMbps} Mbps
              </Text>
            ) : null}

            <Pressable
              onPress={() => setActivatedOpen(false)}
              style={({ pressed }) => [
                styles.dialogPrimaryBtn,
                styles.dialogPrimaryFull,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dialogPrimaryText}>Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!errorInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorInfo(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <View style={[styles.dialogIconWrap, styles.dialogIconError]}>
              <Ionicons name="alert-circle" size={42} color={colors.danger} />
            </View>
            <Text style={styles.dialogEyebrow}>ATENÇÃO</Text>
            <Text style={styles.dialogTitle}>Não foi possível enviar</Text>
            <Text style={styles.dialogText}>{errorInfo}</Text>
            <Pressable
              onPress={() => setErrorInfo(null)}
              style={({ pressed }) => [
                styles.dialogPrimaryBtn,
                styles.dialogPrimaryFull,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dialogPrimaryText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <Card style={styles.infoCard}>{children}</Card>;
}

function InlineField({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.inlineText}>
      <Text style={styles.fieldLabel}>{label} </Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </Text>
  );
}

function StackedField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stacked}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(59,145,242,0.22)',
    right: -80,
    top: -90,
  },
  heroGlowSoft: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    left: -50,
    bottom: -40,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadge: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: colors.accentBright,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  heroPlan: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: spacing.lg,
  },
  heroMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroMetricValue: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  heroMetricLabel: {
    color: colors.onPrimaryMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  heroMetricDivider: {
    width: 1,
    height: 42,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroFooterText: {
    flex: 1,
    color: colors.onPrimaryMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  upgradeCue: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(74,222,155,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,155,0.22)',
  },
  upgradeCuePending: {
    backgroundColor: 'rgba(245,200,76,0.12)',
    borderColor: 'rgba(245,200,76,0.28)',
  },
  upgradeCuePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  upgradeCueGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74,222,155,0.28)',
  },
  upgradeCueGlowPending: {
    backgroundColor: 'rgba(245,200,76,0.28)',
  },
  upgradeCueIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74,222,155,0.16)',
  },
  upgradeCueIconPending: {
    backgroundColor: 'rgba(245,200,76,0.16)',
  },
  upgradeCueDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE9B',
  },
  upgradeCueDotPending: {
    backgroundColor: '#F5C84C',
  },
  upgradeCueCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  upgradeCueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upgradeCueTitle: {
    color: '#4ADE9B',
    fontSize: 13,
    fontWeight: '900',
  },
  upgradeCueTitlePending: {
    color: '#F5C84C',
  },
  upgradeLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE9B',
  },
  upgradeLiveDotPending: {
    backgroundColor: '#F5C84C',
  },
  upgradeCueSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
  },
  dialogIconPending: {
    backgroundColor: 'rgba(245,200,76,0.16)',
  },
  progressSteps: {
    width: '100%',
    gap: 12,
    marginBottom: spacing.md,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    backgroundColor: colors.border,
  },
  progressDotDone: {
    backgroundColor: colors.success,
  },
  progressDotCurrent: {
    backgroundColor: '#F5C84C',
  },
  progressCopy: {
    flex: 1,
    gap: 2,
  },
  progressTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  progressMuted: {
    color: colors.textMuted,
  },
  progressMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  progressFromTo: {
    width: '100%',
    marginBottom: spacing.md,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(7, 27, 56, 0.55)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    ...shadows.card,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  sheetEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sheetTitle: {
    marginTop: 4,
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    marginTop: 6,
    marginBottom: spacing.lg,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sheetList: {
    gap: spacing.sm,
  },
  sheetOption: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentUltraSoft,
    padding: spacing.lg,
    gap: 6,
  },
  sheetOptionFeatured: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sheetOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sheetOptionName: {
    flex: 1,
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  sheetOptionNameFeatured: {
    color: colors.white,
  },
  sheetRecommended: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(74,222,155,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sheetRecommendedText: {
    color: '#4ADE9B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  sheetOptionMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  sheetOptionMetaFeatured: {
    color: colors.onPrimaryMuted,
  },
  sheetOptionFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetOptionPrice: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  sheetOptionPriceFeatured: {
    color: colors.white,
  },
  sheetOptionPriceSuffix: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  sheetOptionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sheetOptionCtaFeatured: {
    backgroundColor: colors.white,
  },
  sheetOptionCtaText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  sheetOptionCtaTextFeatured: {
    color: colors.primary,
  },
  sheetClose: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.xs,
  },
  sheetCloseText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 27, 56, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  dialogIconWrap: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dialogIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogIconSuccess: {
    marginBottom: 0,
  },
  dialogIconError: {
    marginBottom: 0,
  },
  dialogEyebrow: {
    textAlign: 'center',
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  dialogTitle: {
    textAlign: 'center',
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: -4,
  },
  dialogText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  dialogPlanBox: {
    borderRadius: radius.lg,
    backgroundColor: colors.accentUltraSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  dialogPlanName: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  dialogPlanMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  dialogStatusRow: {
    marginTop: spacing.sm,
  },
  dialogStatusChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dialogStatusChipText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '900',
  },
  dialogStatusChipOk: {
    backgroundColor: colors.successSoft,
  },
  dialogStatusChipTextOk: {
    color: colors.successDark,
  },
  dialogProtocol: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  dialogProtocolId: {
    color: colors.primary,
    fontWeight: '900',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dialogGhostBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  dialogGhostText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  dialogPrimaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.primary,
  },
  dialogPrimaryFull: {
    marginTop: spacing.sm,
  },
  dialogPrimaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  mobileEntry: {
    marginTop: spacing.lg,
    height: 158,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.card,
  },
  mobileEntryPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  mobileEntryImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  mobileEntryOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  mobileEntryBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(74,222,155,0.16)',
    marginBottom: 8,
  },
  mobileEntryBadgeText: {
    color: '#4ADE9B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  mobileEntryTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
  },
  mobileEntrySubtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
  },
  mobileEntryCta: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  mobileEntryCtaText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionSpacing: {
    marginTop: spacing.lg,
  },
  infoCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  inlineText: {
    lineHeight: 22,
  },
  stacked: {
    gap: 4,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  fieldValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emailBody: {
    flex: 1,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  extractCard: {
    gap: spacing.md,
  },
  extractTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  extractIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractHeading: {
    flex: 1,
    gap: 2,
  },
  extractTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  extractSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  extractStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentUltraSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  extractStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  extractDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  extractStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  extractStatValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  extractLink: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
});
