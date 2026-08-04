import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAuth } from '@/src/contexts/AuthContext';
import { requestTrustUnlock, type UnlockResult } from '@/src/services/unlock';
import { colors, radius, spacing } from '@/src/theme';

const steps = [
  'A liberação é temporária e serve para você regularizar o pagamento.',
  'O acesso volta ao normal em poucos minutos após a confirmação.',
  'Só é possível pedir novamente após quitar a fatura em aberto.',
];

export default function UnlockScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UnlockResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handleUnlock() {
    if (!user) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      setResult(await requestTrustUnlock(user.document));
    } catch (unlockError) {
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : 'Não foi possível concluir a solicitação.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Desbloqueio em confiança"
        subtitle="Libere o acesso para regularizar"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="always"
      >
        <LinearGradient
          colors={[colors.primaryDark, colors.primary, colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroIcon}>
            <Ionicons name="lock-open-outline" size={28} color={colors.white} />
          </View>
          <Text style={styles.heroTitle}>Continue conectado</Text>
          <Text style={styles.heroText}>
            Se sua conexão foi bloqueada por falta de pagamento, você pode pedir uma
            liberação provisória e acertar a fatura com calma.
          </Text>
        </LinearGradient>

        <Card style={styles.stepsCard}>
          <Text style={styles.cardTitle}>Como funciona</Text>
          {steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={styles.stepIndex}>
                <Text style={styles.stepIndexText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </Card>

        {result ? (
          <Card
            style={[
              styles.resultCard,
              result.granted ? styles.resultOk : styles.resultWarning,
            ]}
          >
            <View
              style={[
                styles.resultIcon,
                {
                  backgroundColor: result.granted
                    ? colors.successSoft
                    : colors.warningSoft,
                },
              ]}
            >
              <Ionicons
                name={result.granted ? 'checkmark-circle' : 'alert-circle'}
                size={26}
                color={result.granted ? colors.success : colors.warning}
              />
            </View>
            <View style={styles.resultBody}>
              <Text style={styles.resultTitle}>
                {result.granted
                  ? 'Desbloqueio liberado'
                  : 'Desbloqueio não efetuado'}
              </Text>
              <Text style={styles.resultText}>{result.message}</Text>
              {result.granted ? (
                <Text style={styles.resultHint}>
                  Se a conexão não voltar em alguns minutos, reinicie o roteador.
                </Text>
              ) : (
                <Text style={styles.resultHint}>
                  Seu contrato pode não estar elegível agora. Fale com o suporte ou
                  pague a fatura em aberto.
                </Text>
              )}
            </View>
          </Card>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Button
          title={result ? 'Tentar novamente' : 'Solicitar desbloqueio'}
          loading={loading}
          onPress={handleUnlock}
        />

        <Button
          title="Ver minhas faturas"
          variant="secondary"
          onPress={() => router.push('/(tabs)/faturas')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(59,145,242,0.2)',
    right: -70,
    top: -85,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroText: {
    color: colors.onPrimaryMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  stepsCard: {
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  stepText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  resultCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
  },
  resultOk: {
    borderColor: '#A7DCC8',
  },
  resultWarning: {
    borderColor: '#E8C46A',
  },
  resultIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBody: {
    flex: 1,
    gap: spacing.xs,
  },
  resultTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  resultText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  resultHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
