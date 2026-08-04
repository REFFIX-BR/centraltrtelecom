import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAccount } from '@/src/contexts/AccountContext';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  canOpenContract,
  contractNeedsAttention,
  isContractViewOnly,
  pickSignableContract,
  pickViewableContract,
  type ClientContract,
  type ContractStatus,
} from '@/src/services/contracts';
import { colors, radius, spacing } from '@/src/theme';
import { formatDate } from '@/src/utils/format';

const statusMap: Record<
  ContractStatus,
  {
    label: string;
    color: string;
    background: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  draft: {
    label: 'Em preparação',
    color: colors.warning,
    background: colors.warningSoft,
    icon: 'create-outline',
  },
  pending: {
    label: 'Aguardando assinatura',
    color: colors.warning,
    background: colors.warningSoft,
    icon: 'alert-circle',
  },
  pending_review: {
    label: 'Assinado · Em análise',
    color: colors.accent,
    background: colors.accentSoft,
    icon: 'time-outline',
  },
  signed: {
    label: 'Assinado e aprovado',
    color: colors.success,
    background: colors.successSoft,
    icon: 'checkmark-circle',
  },
  cancelled: {
    label: 'Cancelado',
    color: colors.danger,
    background: colors.dangerSoft,
    icon: 'close-circle',
  },
};

export default function DocumentsScreen() {
  const { user } = useAuth();
  const { contracts, contractError, reloadContract } = useAccount();
  const insets = useSafeAreaInsets();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  if (!user) return null;

  const needsAttention = contractNeedsAttention(contracts);
  const signable = pickSignableContract(contracts);
  const viewable = pickViewableContract(contracts);

  async function handleRefresh() {
    setRefreshing(true);
    await reloadContract();
    setRefreshing(false);
  }

  async function openContract(contract: ClientContract, mode: 'sign' | 'view') {
    const url = contract.assinaturaUrl?.trim();
    if (!url) {
      Alert.alert(
        mode === 'view' ? 'Documento indisponível' : 'Link indisponível',
        mode === 'view'
          ? 'Ainda não há versão visual deste contrato no app. Fale com o suporte se precisar do PDF.'
          : 'O link de assinatura ainda não foi gerado.'
      );
      return;
    }

    try {
      setOpeningId(contract.contractId);
      await WebBrowser.openBrowserAsync(url);
      if (mode === 'sign') {
        await reloadContract();
      }
    } catch {
      Alert.alert(
        'Não foi possível abrir',
        'Tente novamente ou fale com o suporte.'
      );
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Documentos" subtitle="Contratos do assinante" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >
        {contractError ? (
          <Card style={styles.messageCard}>
            <View style={styles.messageIcon}>
              <Ionicons name="cloud-offline-outline" size={24} color={colors.warning} />
            </View>
            <View style={styles.messageBody}>
              <Text style={styles.messageTitle}>Consulta indisponível</Text>
              <Text style={styles.text}>{contractError}</Text>
              <Button
                title="Tentar novamente"
                variant="secondary"
                onPress={reloadContract}
              />
            </View>
          </Card>
        ) : (
          <>
            <Card
              style={[
                styles.summaryCard,
                needsAttention ? styles.summaryWarning : styles.summaryOk,
              ]}
            >
              <View style={styles.summaryTop}>
                <View
                  style={[
                    styles.summaryIcon,
                    {
                      backgroundColor: needsAttention
                        ? colors.warningSoft
                        : colors.successSoft,
                    },
                  ]}
                >
                  <Ionicons
                    name={needsAttention ? 'alert-circle' : 'shield-checkmark'}
                    size={28}
                    color={needsAttention ? colors.warning : colors.success}
                  />
                </View>
                <View style={styles.summaryHeading}>
                  <Text style={styles.eyebrow}>CONTRATO DE SERVIÇOS</Text>
                  <Text style={styles.title}>
                    {needsAttention ? 'Assinatura pendente' : 'Contrato em dia'}
                  </Text>
                </View>
              </View>

              <Text style={styles.text}>
                {!contracts?.found
                  ? 'Não encontramos contrato vinculado ao seu CPF/CNPJ. Fale com o suporte para regularizar.'
                  : contracts.pendingSignature > 0
                    ? 'Você tem contrato aguardando assinatura. Assine pelo app para manter tudo regularizado.'
                    : contracts.pendingReview > 0
                      ? 'Recebemos sua assinatura. O contrato está em análise pela nossa equipe.'
                      : contracts.signed > 0
                        ? 'Seu contrato está assinado e aprovado. Você pode abrir e consultar quando quiser.'
                        : 'Seu contrato ainda não está disponível para assinatura.'}
              </Text>

              {signable && canOpenContract(signable) ? (
                <Button
                  title="Assinar contrato"
                  loading={openingId === signable.contractId}
                  onPress={() => openContract(signable, 'sign')}
                />
              ) : null}

              {!signable && viewable ? (
                <Button
                  title="Ver contrato assinado"
                  variant="secondary"
                  loading={openingId === viewable.contractId}
                  onPress={() => openContract(viewable, 'view')}
                />
              ) : null}

              {signable && !canOpenContract(signable) ? (
                <View style={styles.noLink}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={colors.warning}
                  />
                  <Text style={styles.noLinkText}>
                    O link de assinatura ainda não foi gerado.
                  </Text>
                </View>
              ) : null}
            </Card>

            {contracts?.contracts.map((contract) => {
              const tone = statusMap[contract.status];
              const canOpen = canOpenContract(contract);
              const viewOnly = isContractViewOnly(contract);
              const loading = openingId === contract.contractId;

              return (
                <Card key={contract.contractId} style={styles.contractCard}>
                  <View style={styles.contractTop}>
                    <Text style={styles.contractNumber}>
                      Contrato {contract.contractNumber}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: tone.background }]}>
                      <Ionicons name={tone.icon} size={14} color={tone.color} />
                      <Text style={[styles.badgeText, { color: tone.color }]}>
                        {tone.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.details}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Cliente</Text>
                      <Text style={styles.detailValue}>{contract.clientName}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Atualizado em</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(contract.updatedAt)}
                      </Text>
                    </View>
                  </View>

                  {contract.status === 'pending' && canOpen ? (
                    <Button
                      title="Assinar este contrato"
                      variant="secondary"
                      loading={loading}
                      onPress={() => openContract(contract, 'sign')}
                    />
                  ) : null}

                  {viewOnly && canOpen ? (
                    <Button
                      title="Ver contrato"
                      variant="secondary"
                      loading={loading}
                      onPress={() => openContract(contract, 'view')}
                    />
                  ) : null}

                  {viewOnly && !canOpen ? (
                    <View style={[styles.noLink, styles.noLinkSoft]}>
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color={colors.textMuted}
                      />
                      <Text style={[styles.noLinkText, styles.noLinkMuted]}>
                        Documento assinado sem link de visualização no momento.
                      </Text>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryCard: {
    gap: spacing.lg,
    borderWidth: 1,
  },
  summaryWarning: {
    borderColor: '#E8C46A',
  },
  summaryOk: {
    borderColor: '#A7DCC8',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeading: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  text: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  contractCard: {
    gap: spacing.md,
  },
  contractTop: {
    gap: spacing.sm,
  },
  contractNumber: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  details: {
    borderRadius: radius.md,
    backgroundColor: colors.accentUltraSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  detailValue: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  noLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  noLinkText: {
    flex: 1,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  noLinkSoft: {
    backgroundColor: colors.accentUltraSoft,
  },
  noLinkMuted: {
    color: colors.textMuted,
  },
  messageCard: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  messageIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBody: {
    flex: 1,
    gap: spacing.md,
  },
  messageTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
});
