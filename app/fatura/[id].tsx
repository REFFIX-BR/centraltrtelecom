import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { StatusBadge } from '@/src/components/StatusBadge';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, spacing } from '@/src/theme';
import { formatCurrency, formatDate } from '@/src/utils/format';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const invoice = user?.invoices.find((item) => item.id === id);

  if (!invoice) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Fatura" />
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>Fatura não encontrada.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title={`Fatura ${invoice.monthLabel}`} subtitle={invoice.reference} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <StatusBadge status={invoice.status} />
          </View>
          <Text style={styles.amount}>{formatCurrency(invoice.amount)}</Text>
          <Info label="Competência" value={invoice.monthLabel} />
          <Info label="Vencimento" value={formatDate(invoice.dueDate)} />
          {invoice.paidAt ? (
            <Info label="Pagamento" value={formatDate(invoice.paidAt)} />
          ) : (
            <Info label="Emissão" value={formatDate(invoice.issuedAt)} />
          )}
          <Info label="Referência" value={invoice.reference} />
        </Card>

        {invoice.pdfUrl ? (
          <Button
            title="Abrir boleto / carnê"
            variant="secondary"
            onPress={() => Linking.openURL(invoice.pdfUrl!)}
          />
        ) : null}

        {invoice.status !== 'paid' ? (
          <Button
            title="Pagar agora"
            variant="success"
            onPress={() => router.push(`/pagamento/${invoice.id}`)}
          />
        ) : (
          <Card>
            <Text style={styles.paidText}>
              Esta fatura já foi paga. Obrigado por manter sua conta em dia com a TR Telecom.
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
  },
  amount: {
    color: colors.gold,
    fontSize: 34,
    fontWeight: '800',
  },
  info: {
    gap: 2,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  infoValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  paidText: {
    color: colors.textSecondary,
    lineHeight: 20,
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
