import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/src/components/Card';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, spacing } from '@/src/theme';
import { formatDate } from '@/src/utils/format';

const statusLabel = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
} as const;

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const ticket = user?.tickets.find((item) => item.id === id);

  if (!ticket) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Protocolo" />
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>Protocolo não encontrado.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title={`Protocolo #${ticket.protocol}`} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <Card style={styles.card}>
          <Info label="Status" value={statusLabel[ticket.status]} />
          <Info label="Assunto" value={ticket.subject} />
          <Info label="Descrição" value={ticket.description} />
          <Info label="Aberto em" value={formatDate(ticket.createdAt)} />
          <Info label="Atualizado em" value={formatDate(ticket.updatedAt)} />
        </Card>
        <Card>
          <Text style={styles.timelineTitle}>Acompanhamento</Text>
          <Text style={styles.timelineItem}>
            • Protocolo registrado e encaminhado à equipe técnica.
          </Text>
          {ticket.status !== 'open' ? (
            <Text style={styles.timelineItem}>
              • Análise em andamento pela equipe de campo.
            </Text>
          ) : null}
          {ticket.status === 'resolved' ? (
            <Text style={styles.timelineItem}>• Atendimento concluído com sucesso.</Text>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    gap: spacing.lg,
  },
  info: {
    gap: 4,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
  },
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  timelineTitle: {
    color: colors.primary,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  timelineItem: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    color: colors.textSecondary,
  },
});
