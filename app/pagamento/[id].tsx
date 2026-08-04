import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import QRCode from 'qrcode';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, radius, shadows, spacing } from '@/src/theme';
import { formatCurrency, formatDate } from '@/src/utils/format';

type Method = 'pix' | 'boleto';

const QR_SIZE = 196;

function PixQrCode({ value }: { value: string }) {
  const modules = useMemo(() => {
    try {
      return QRCode.create(value, { errorCorrectionLevel: 'M' }).modules;
    } catch {
      return null;
    }
  }, [value]);

  if (!modules) {
    return (
      <View style={styles.qrPlaceholder}>
        <Text style={styles.unavailableText}>
          Não foi possível gerar o QR Code.
        </Text>
      </View>
    );
  }

  const size = modules.size;
  const cell = QR_SIZE / size;

  return (
    <View style={[styles.qrMatrix, { width: QR_SIZE, height: QR_SIZE }]}>
      {Array.from({ length: size }, (_, y) => (
        <View key={`r-${y}`} style={styles.qrRow}>
          {Array.from({ length: size }, (_, x) => {
            const dark = modules.get(x, y);
            return (
              <View
                key={`c-${x}-${y}`}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: dark ? colors.primaryDark : colors.white,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<Method>('pix');
  const [copied, setCopied] = useState(false);

  const invoice = user?.invoices.find((item) => item.id === id);

  const paymentValue = useMemo(() => {
    if (!invoice) return '';
    return method === 'pix'
      ? invoice.pixCode?.trim() || ''
      : invoice.barcode?.trim() || '';
  }, [invoice, method]);

  if (!invoice) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Pagamento" />
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>Fatura não encontrada.</Text>
        </View>
      </View>
    );
  }

  async function copyCode() {
    if (!paymentValue) {
      Alert.alert(
        'Indisponível',
        method === 'pix'
          ? 'Esta fatura não possui código Pix.'
          : 'Esta fatura não possui código de barras.'
      );
      return;
    }

    await Clipboard.setStringAsync(paymentValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Pagamento" subtitle={invoice.reference} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.summary}>
          <Text style={styles.month}>Fatura de {invoice.monthLabel}</Text>
          <Text style={styles.amount}>{formatCurrency(invoice.amount)}</Text>
          <Text style={styles.due}>Vencimento {formatDate(invoice.dueDate)}</Text>
        </Card>

        <Text style={styles.section}>Forma de pagamento</Text>
        <View style={styles.methods}>
          <Pressable
            style={[styles.method, method === 'pix' && styles.methodActive]}
            onPress={() => {
              setMethod('pix');
              setCopied(false);
            }}
          >
            <Ionicons
              name="qr-code-outline"
              size={16}
              color={method === 'pix' ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.methodText, method === 'pix' && styles.methodTextActive]}>
              Pix
            </Text>
          </Pressable>
          <Pressable
            style={[styles.method, method === 'boleto' && styles.methodActive]}
            onPress={() => {
              setMethod('boleto');
              setCopied(false);
            }}
          >
            <Ionicons
              name="barcode-outline"
              size={16}
              color={method === 'boleto' ? colors.white : colors.textSecondary}
            />
            <Text
              style={[styles.methodText, method === 'boleto' && styles.methodTextActive]}
            >
              Boleto
            </Text>
          </Pressable>
        </View>

        <Card style={styles.codeCard}>
          {method === 'pix' ? (
            <>
              <Text style={styles.codeLabel}>QR Code Pix</Text>
              {paymentValue ? (
                <View style={styles.qrWrap}>
                  <View style={styles.qrFrame}>
                    <PixQrCode value={paymentValue} />
                  </View>
                  <Text style={styles.qrHint}>
                    Abra o app do banco e escaneie o QR Code para pagar.
                  </Text>
                </View>
              ) : (
                <View style={styles.unavailable}>
                  <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
                  <Text style={styles.unavailableText}>
                    QR Code Pix indisponível para esta fatura.
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              <Text style={styles.codeLabel}>Copia e cola Pix</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeValue} selectable numberOfLines={4}>
                  {paymentValue || 'Código Pix não disponível'}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.codeLabel}>Código de barras</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeValue} selectable>
                  {paymentValue || 'Código de barras não disponível'}
                </Text>
              </View>
            </>
          )}

          <Button
            title={
              copied
                ? 'Código copiado!'
                : method === 'pix'
                  ? 'Copiar código Pix'
                  : 'Copiar código de barras'
            }
            variant={copied ? 'success' : 'secondary'}
            onPress={copyCode}
            disabled={!paymentValue}
          />
        </Card>

        <Text style={styles.helper}>
          Após o pagamento, a confirmação será atualizada automaticamente.
        </Text>
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
  summary: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  month: {
    color: colors.textSecondary,
  },
  amount: {
    color: colors.gold,
    fontSize: 32,
    fontWeight: '800',
  },
  due: {
    color: colors.textMuted,
  },
  section: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  methods: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  method: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  methodActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  methodTextActive: {
    color: colors.white,
  },
  codeCard: {
    gap: spacing.md,
  },
  codeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  qrWrap: {
    alignItems: 'center',
    gap: spacing.md,
  },
  qrFrame: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  qrMatrix: {
    overflow: 'hidden',
  },
  qrRow: {
    flexDirection: 'row',
  },
  qrPlaceholder: {
    width: QR_SIZE,
    height: QR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  qrHint: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  codeBox: {
    borderRadius: radius.md,
    backgroundColor: colors.accentUltraSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  codeValue: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  unavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  unavailableText: {
    flex: 1,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
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
