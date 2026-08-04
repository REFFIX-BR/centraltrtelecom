import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/src/components/Card';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, spacing } from '@/src/theme';
import { formatDate, formatDocument } from '@/src/utils/format';

export default function ProfileScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  if (!user) return null;

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Meus dados" subtitle="Informações cadastrais" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <Card style={styles.card}>
          <Info label="Nome completo" value={user.name} />
          <Info label="CPF/CNPJ" value={formatDocument(user.document)} />
          <Info label="E-mail" value={user.email || 'Não informado'} />
          <Info label="Telefone" value={user.phone || 'Não informado'} />
          <Info
            label="Data de nascimento"
            value={user.birthDate ? formatDate(user.birthDate) : 'Não informado'}
          />
          <Info label="Endereço" value={user.address} />
        </Card>
        <Text style={styles.note}>
          Em produção, a alteração cadastral pode exigir validação e abertura de protocolo.
        </Text>
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
    gap: spacing.lg,
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
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
