import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PromoCarousel } from '@/src/components/PromoCarousel';
import { QuickAction } from '@/src/components/QuickAction';
import { useAccount } from '@/src/contexts/AccountContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { fetchPromoBanners, type PromoBanner } from '@/src/services/banners';
import { formatConnectedTime } from '@/src/services/connection';
import { contractNeedsAttention } from '@/src/services/contracts';
import { pickNextInvoice } from '@/src/services/invoices';
import { colors, radius, spacing, tabScrollBottom } from '@/src/theme';
import { formatCurrency, formatShortDate } from '@/src/utils/format';

const statusMeta = {
  paid: { label: 'Fatura quitada', tone: colors.success, icon: 'shield-checkmark' },
  open: { label: 'Fatura disponível', tone: colors.accent, icon: 'time' },
  overdue: { label: 'Pagamento pendente', tone: colors.danger, icon: 'alert-circle' },
} as const;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, unreadNotifications } = useAuth();
  const {
    connection,
    contracts,
    contractError,
    error: accountError,
    reload,
  } = useAccount();
  const [banners, setBanners] = useState<PromoBanner[]>([]);

  useEffect(() => {
    let active = true;
    fetchPromoBanners().then((items) => {
      if (active) setBanners(items);
    });
    return () => {
      active = false;
    };
  }, []);

  const highlightInvoice = useMemo(
    () => (user ? pickNextInvoice(user.invoices) : null),
    [user]
  );

  const overdueCount =
    user?.invoices.filter((item) => item.status === 'overdue').length ?? 0;

  if (!user) return null;

  const meta = highlightInvoice ? statusMeta[highlightInvoice.status] : null;
  const isOnline = connection?.isOnline ?? false;
  const connectionLabel = connection
    ? isOnline
      ? 'Conectado'
      : 'Offline'
    : 'Indisponível';
  const speedLabel = connection?.speedMbps
    ? `${connection.speedMbps} Mbps`
    : 'Sem dados';
  const uptimeLabel = connection?.isOnline
    ? formatConnectedTime(connection.connectedMinutes)
    : connection
      ? 'Sem conexão'
      : '—';

  return (
    <View style={styles.flex}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.stripe} />
        <View style={styles.stripeThin} />

        <View style={styles.headerRow}>
          <Image
            source={require('../../assets/images/logo-redonda.jpg')}
            style={styles.avatar}
            accessibilityLabel="TR Telecom"
          />
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>CENTRAL DO ASSINANTE</Text>
            <Text style={styles.hello} numberOfLines={1}>
              {user.firstName}
            </Text>
          </View>
          <Pressable
            style={styles.bell}
            onPress={() => router.push('/notificacoes')}
            accessibilityRole="button"
            accessibilityLabel="Notificações"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.white} />
            {unreadNotifications > 0 ? <View style={styles.dot} /> : null}
          </Pressable>
        </View>

        <View style={styles.statusStrip}>
          <View style={styles.stripItem}>
            <View
              style={[
                styles.livePulse,
                {
                  backgroundColor: connection
                    ? isOnline
                      ? '#4ADE9B'
                      : colors.danger
                    : colors.textMuted,
                },
              ]}
            />
            <Text style={styles.stripValue}>{connectionLabel}</Text>
          </View>
          <View style={styles.stripDivider} />
          <View style={styles.stripItem}>
            <Text style={styles.stripValue}>{speedLabel}</Text>
          </View>
          <View style={styles.stripDivider} />
          <View style={styles.stripItem}>
            <Text style={styles.stripValue}>{uptimeLabel}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + tabScrollBottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {highlightInvoice && meta ? (
          <View style={styles.receipt}>
            <View style={[styles.receiptRail, { backgroundColor: meta.tone }]} />

            <View style={styles.receiptTop}>
              <View style={styles.receiptHeadRow}>
                <Text style={styles.receiptLabel}>
                  FATURA · {highlightInvoice.monthLabel.toUpperCase()}
                </Text>
                <View style={[styles.statusTag, { backgroundColor: `${meta.tone}18` }]}>
                  <Ionicons name={meta.icon} size={13} color={meta.tone} />
                  <Text style={[styles.statusTagText, { color: meta.tone }]}>
                    {meta.label}
                  </Text>
                </View>
              </View>

              <Text style={[styles.amount, { color: meta.tone }]}>
                {formatCurrency(highlightInvoice.amount)}
              </Text>

              <View style={styles.dueRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.dueText}>
                  Vence em {formatShortDate(highlightInvoice.dueDate)}
                </Text>
              </View>
            </View>

            <View style={styles.perforation}>
              <View style={[styles.notch, styles.notchLeft]} />
              <View style={styles.dashed} />
              <View style={[styles.notch, styles.notchRight]} />
            </View>

            <View style={styles.receiptBottom}>
              {highlightInvoice.status !== 'paid' ? (
                <Pressable
                  onPress={() => router.push(`/pagamento/${highlightInvoice.id}`)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.payRow, pressed && styles.payRowPressed]}
                >
                  <View style={styles.payIcon}>
                    <Ionicons name="qr-code-outline" size={19} color={colors.white} />
                  </View>
                  <View style={styles.payText}>
                    <Text style={styles.payTitle}>Pagar com Pix ou boleto</Text>
                    <Text style={styles.paySubtitle}>Confirmação em poucos minutos</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => router.push(`/fatura/${highlightInvoice.id}`)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.payRow, pressed && styles.payRowPressed]}
                >
                  <View style={[styles.payIcon, { backgroundColor: colors.success }]}>
                    <Ionicons name="checkmark" size={20} color={colors.white} />
                  </View>
                  <View style={styles.payText}>
                    <Text style={styles.payTitle}>Pagamento confirmado</Text>
                    <Text style={styles.paySubtitle}>Ver comprovante da fatura</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.receipt}>
            <View style={[styles.receiptRail, { backgroundColor: colors.accent }]} />
            <View style={styles.receiptTop}>
              <Text style={styles.receiptLabel}>FATURAS</Text>
              <Text style={styles.emptyTitle}>Bem-vindo, {user.firstName}</Text>
              <Text style={styles.emptyText}>
                Nenhuma fatura em aberto para este login no momento.
              </Text>
            </View>
          </View>
        )}

        {overdueCount > 0 ? (
          <Pressable
            onPress={() => router.push('/(tabs)/faturas')}
            style={({ pressed }) => [styles.alertBar, pressed && styles.alertBarPressed]}
            accessibilityRole="button"
          >
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={styles.alertText}>
              {overdueCount} fatura{overdueCount > 1 ? 's' : ''} em atraso. Regularize para
              manter o serviço ativo.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.warning} />
          </Pressable>
        ) : null}

        {accountError ? (
          <Pressable
            onPress={reload}
            style={({ pressed }) => [styles.alertBar, pressed && styles.alertBarPressed]}
            accessibilityRole="button"
          >
            <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
            <Text style={styles.alertText}>
              Não conseguimos verificar sua conexão agora. Toque para tentar novamente.
            </Text>
            <Ionicons name="refresh" size={16} color={colors.warning} />
          </Pressable>
        ) : null}

        <PromoCarousel banners={banners} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>O que você precisa</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            style={styles.carouselScroll}
          >
            <QuickAction
              icon="cash-outline"
              title="Faturas"
              hint="Histórico e 2ª via"
              style={styles.carouselItem}
              onPress={() => router.push('/(tabs)/faturas')}
            />
            <QuickAction
              icon="lock-open-outline"
              title="Desbloqueio"
              hint="Em confiança"
              style={styles.carouselItem}
              onPress={() => router.push('/desbloqueio')}
            />
            <QuickAction
              icon="key-outline"
              title="Trocar senha"
              hint="Wi-Fi da sua casa"
              style={styles.carouselItem}
              onPress={() => router.push('/wifi')}
            />
            <QuickAction
              icon="headset-outline"
              title="Suporte"
              hint="Abrir protocolo"
              style={styles.carouselItem}
              onPress={() => router.push('/(tabs)/suporte')}
            />
            <QuickAction
              icon="cloud-upload-outline"
              title="Documentos"
              hint={
                contractError
                  ? 'Consultar contrato'
                  : contractNeedsAttention(contracts)
                    ? 'Assinatura pendente'
                    : 'Contrato em dia'
              }
              warning={!contractError && contractNeedsAttention(contracts)}
              style={styles.carouselItem}
              onPress={() => router.push('/documentos')}
            />
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sua conexão</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/plano')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.planPanel, pressed && styles.planPanelPressed]}
          >
            <View style={styles.planTop}>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>
                  {connection?.planName ?? 'Plano não identificado'}
                </Text>
                <View style={styles.connectionTag}>
                  <View
                    style={[
                      styles.connectionDot,
                      {
                        backgroundColor: connection
                          ? isOnline
                            ? '#4ADE9B'
                            : colors.danger
                          : colors.textMuted,
                      },
                    ]}
                  />
                  <Text style={styles.connectionTagText}>
                    {connection
                      ? (connection.pppoeStatus || (isOnline ? 'Online' : 'Offline')).toUpperCase()
                      : 'Status indisponível'}
                  </Text>
                </View>
              </View>
              <View style={styles.bars}>
                {[10, 16, 22, 28, 34].map((height) => (
                  <View
                    key={height}
                    style={[
                      styles.bar,
                      { height },
                      !isOnline && styles.barOffline,
                    ]}
                  />
                ))}
              </View>
            </View>

            <View style={styles.planSplit}>
              <View style={styles.planMetric}>
                <Text style={styles.metricValue}>{connection?.speedMbps ?? 0}</Text>
                <Text style={styles.metricLabel}>Mbps contratados</Text>
              </View>
              <View style={styles.planMetricDivider} />
              <View style={styles.planMetric}>
                <Text style={styles.metricValue}>
                  {connection?.isOnline
                    ? formatConnectedTime(connection.connectedMinutes)
                    : '—'}
                </Text>
                <Text style={styles.metricLabel}>Tempo conectado</Text>
              </View>
            </View>

            <View style={styles.planFooter}>
              <Text style={styles.planFooterText}>Ver detalhes da sua conexão</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.accent} />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    borderBottomRightRadius: 38,
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    width: 260,
    height: 74,
    right: -70,
    top: -26,
    backgroundColor: 'rgba(59,145,242,0.14)',
    transform: [{ rotate: '-18deg' }],
  },
  stripeThin: {
    position: 'absolute',
    width: 220,
    height: 12,
    right: -40,
    top: 44,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '-18deg' }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.accentBright,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  hello: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 1,
  },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onPrimarySoft,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },

  statusStrip: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  stripItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  livePulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE9B',
  },
  stripValue: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  stripDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  scroll: {
    marginTop: -spacing.xl,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.xl,
  },

  receipt: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
  receiptRail: {
    height: 5,
    width: '100%',
  },
  receiptTop: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  receiptHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  receiptLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '900',
  },
  amount: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  emptyTitle: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  perforation: {
    height: 18,
    justifyContent: 'center',
  },
  dashed: {
    marginHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  notch: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notchLeft: {
    left: -10,
  },
  notchRight: {
    right: -10,
  },

  receiptBottom: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentUltraSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    padding: spacing.md,
  },
  payRowPressed: {
    backgroundColor: colors.accentSoft,
  },
  payIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payText: {
    flex: 1,
  },
  payTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  paySubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },

  alertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  alertBarPressed: {
    opacity: 0.85,
  },
  alertText: {
    flex: 1,
    color: '#7A5605',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },

  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  carouselScroll: {
    marginHorizontal: -spacing.lg,
  },
  carousel: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  carouselItem: {
    width: 152,
    flexGrow: 0,
    flexBasis: 'auto',
  },

  planPanel: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    overflow: 'hidden',
  },
  planPanelPressed: {
    opacity: 0.94,
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  connectionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  connectionTagText: {
    color: colors.onPrimaryMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 5,
    borderRadius: 3,
    backgroundColor: colors.accentBright,
  },
  barOffline: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  planSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  planMetric: {
    flex: 1,
    alignItems: 'center',
  },
  planMetricDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  metricValue: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  metricLabel: {
    color: colors.onPrimaryMuted,
    fontSize: 10,
    marginTop: 1,
  },
  planFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  planFooterText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
