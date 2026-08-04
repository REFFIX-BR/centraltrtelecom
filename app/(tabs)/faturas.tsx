import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { StatusBadge } from '@/src/components/StatusBadge';
import { TabHeader } from '@/src/components/TabHeader';
import { useAuth } from '@/src/contexts/AuthContext';
import { sortInvoicesForList } from '@/src/services/invoices';
import { colors, radius, spacing, tabScrollBottom } from '@/src/theme';
import type { InvoiceStatus } from '@/src/types';
import { formatCurrency, formatDate } from '@/src/utils/format';

const filters: { key: 'all' | InvoiceStatus; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'overdue', label: 'Vencidas' },
  { key: 'open', label: 'Em aberto' },
  { key: 'paid', label: 'Pagas' },
];

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');

  const invoices = useMemo(() => {
    if (!user) return [];
    const list =
      filter === 'all'
        ? user.invoices
        : user.invoices.filter((item) => item.status === filter);
    return sortInvoicesForList(list);
  }, [user, filter]);

  if (!user) return null;

  return (
    <View style={styles.flex}>
      <TabHeader
        eyebrow="FINANCEIRO"
        title="Faturas"
        subtitle="Histórico, vencimentos e pagamentos"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + tabScrollBottom },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filters.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {invoices.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Nenhuma fatura neste filtro"
            description="Ajuste o filtro acima ou volte mais tarde para consultar novos lançamentos."
          />
        ) : (
          invoices.map((invoice) => (
            <Card
              key={invoice.id}
              style={styles.invoiceCard}
              onPress={() => router.push(`/fatura/${invoice.id}`)}
            >
              <View style={styles.row}>
                <View>
                  <Text style={styles.month}>{invoice.monthLabel}</Text>
                  <Text style={styles.ref}>{invoice.reference}</Text>
                </View>
                <StatusBadge status={invoice.status} />
              </View>
              <View style={styles.row}>
                <Text
                  style={[
                    styles.amount,
                    invoice.status === 'overdue' && styles.amountOverdue,
                    invoice.status === 'paid' && styles.amountPaid,
                  ]}
                >
                  {formatCurrency(invoice.amount)}
                </Text>
                <Text style={styles.due}>Venc. {formatDate(invoice.dueDate)}</Text>
              </View>
            </Card>
          ))
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
  filters: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.white,
  },
  invoiceCard: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  month: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  ref: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    color: colors.amount,
    fontSize: 20,
    fontWeight: '800',
  },
  amountOverdue: {
    color: colors.danger,
  },
  amountPaid: {
    color: colors.successDark,
  },
  due: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
