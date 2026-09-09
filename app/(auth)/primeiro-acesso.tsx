import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { LoginPointModal } from '@/src/components/LoginPointModal';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/contexts/AuthContext';
import { openSacPasswordWhatsApp } from '@/src/services/whatsapp';
import { colors, radius, spacing } from '@/src/theme';
import { formatDocument, isValidDocument } from '@/src/utils/format';

type Step = 1 | 2;

export default function FirstAccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, pendingPointSelection, selectLoginPoint, cancelPointSelection } =
    useAuth();

  const [step, setStep] = useState<Step>(1);
  const [document, setDocument] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectingPoint, setSelectingPoint] = useState(false);
  const [askingPassword, setAskingPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleIdentify() {
    if (!isValidDocument(document)) {
      setErrors({ document: 'Informe um CPF ou CNPJ válido' });
      return;
    }
    setErrors({});
    setStep(2);
  }

  async function handleLoginWithSac() {
    if (password.trim().length < 3) {
      setErrors({ password: 'Informe a senha SAC' });
      return;
    }
    setErrors({});

    try {
      setLoading(true);
      await login(document, password);
    } catch (error) {
      Alert.alert(
        'Não foi possível entrar',
        error instanceof Error
          ? error.message
          : 'Confira a senha SAC ou peça a sua no WhatsApp.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPoint(selectedLogin: string) {
    try {
      setSelectingPoint(true);
      await selectLoginPoint(selectedLogin);
    } catch (error) {
      Alert.alert(
        'Não foi possível continuar',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setSelectingPoint(false);
    }
  }

  async function handleAskSacPassword() {
    if (!isValidDocument(document)) {
      setErrors({ document: 'Informe um CPF ou CNPJ válido' });
      setStep(1);
      return;
    }

    setAskingPassword(true);
    const opened = await openSacPasswordWhatsApp(document);
    setAskingPassword(false);

    if (!opened) {
      Alert.alert(
        'WhatsApp indisponível',
        'Não foi possível abrir o WhatsApp. Tente novamente.'
      );
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Primeiro acesso"
        subtitle={step === 1 ? 'Identifique seu contrato' : 'Use a senha SAC'}
        showBack
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 ? (
            <Card style={styles.card}>
              <Text style={styles.title}>Qual é o seu CPF?</Text>
              <Text style={styles.text}>
                Digite o CPF ou CNPJ do titular do contrato para continuar.
              </Text>
              <TextField
                label="CPF ou CNPJ"
                value={document}
                onChangeText={(value) => setDocument(formatDocument(value))}
                keyboardType="number-pad"
                placeholder="000.000.000-00"
                error={errors.document}
                maxLength={18}
                returnKeyType="next"
                onSubmitEditing={handleIdentify}
              />
              <Button title="Continuar" onPress={handleIdentify} />
            </Card>
          ) : null}

          {step === 2 ? (
            <Card style={styles.card}>
              <Text style={styles.title}>Informe a senha SAC</Text>
              <Text style={styles.text}>
                É a mesma senha do atendimento e da área do assinante. Documento:{' '}
                {formatDocument(document)}
              </Text>
              <TextField
                label="Senha SAC"
                value={password}
                onChangeText={setPassword}
                isPassword
                placeholder="Digite sua senha SAC"
                error={errors.password}
                returnKeyType="done"
                onSubmitEditing={() => void handleLoginWithSac()}
              />
              <View style={styles.row}>
                <Button
                  title="Voltar"
                  variant="secondary"
                  onPress={() => setStep(1)}
                  style={styles.half}
                />
                <Button
                  title="Entrar"
                  onPress={() => void handleLoginWithSac()}
                  loading={loading}
                  style={styles.half}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => void handleAskSacPassword()}
                disabled={askingPassword}
                style={({ pressed }) => [
                  styles.whatsappBtn,
                  pressed && styles.whatsappPressed,
                ]}
              >
                <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
                <View style={styles.whatsappCopy}>
                  <Text style={styles.whatsappTitle}>
                    Gostaria de saber a minha senha SAC
                  </Text>
                  <Text style={styles.whatsappHint}>
                    Pedimos para você no WhatsApp
                  </Text>
                </View>
              </Pressable>
            </Card>
          ) : null}

          <Button
            title="Já tenho acesso"
            variant="ghost"
            onPress={() => router.back()}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <LoginPointModal
        visible={!!pendingPointSelection}
        options={pendingPointSelection?.options ?? []}
        loading={selectingPoint}
        onSelect={handleSelectPoint}
        onCancel={cancelPointSelection}
      />
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
  title: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  whatsappPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  whatsappCopy: {
    flex: 1,
    gap: 2,
  },
  whatsappTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  whatsappHint: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
});
