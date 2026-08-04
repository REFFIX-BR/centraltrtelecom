import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/src/theme';
import type { InvoiceStatus } from '@/src/types';

const labels: Record<InvoiceStatus, string> = {
  paid: 'Pago',
  open: 'Em aberto',
  overdue: 'Vencido',
};

const tones: Record<InvoiceStatus, { bg: string; text: string }> = {
  paid: { bg: colors.successSoft, text: colors.success },
  open: { bg: colors.accentSoft, text: colors.accent },
  overdue: { bg: colors.dangerSoft, text: colors.danger },
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const tone = tones[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.label, { color: tone.text }]}>{labels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
