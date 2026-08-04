import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, spacing } from '@/src/theme';
import type { Subscriber } from '@/src/types';
import { formatDocument, isValidDocument } from '@/src/utils/format';

type Step = 1 | 2 | 3;

export default function FirstAccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { findProspect, registerFirstAccess } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [document, setDocument] = useState('');
  const [prospect, setProspect] = useState<Subscriber | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleIdentify() {
    if (!isValidDocument(document)) {
      setErrors({ document: 'Informe um CPF ou CNPJ válido' });
      return;
    }
    setErrors({});
    try {
      setLoading(true);
      const found = await findProspect(document);
      if (!found) {
        Alert.alert('Não encontrado', 'Não localizamos um contrato com este documento.');
        return;
      }
      setProspect(found);
      setEmail(found.email || '');
      setPhone(found.phone || '');
      setStep(2);
    } catch (error) {
      Alert.alert(
        'Consulta indisponível',
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar o contrato.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmData() {
    const nextErrors: Record<string, string> = {};
    if (!email.includes('@')) nextErrors.email = 'Informe um e-mail válido';
    if (phone.replace(/\D/g, '').length < 10) nextErrors.phone = 'Informe um telefone válido';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setStep(3);
  }

  async function handleCreatePassword() {
    const nextErrors: Record<string, string> = {};
    if (password.length < 6) nextErrors.password = 'Mínimo de 6 caracteres';
    if (password !== confirmPassword) nextErrors.confirmPassword = 'As senhas não coincidem';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setLoading(true);
      await registerFirstAccess({
        document,
        email,
        phone,
        password,
      });
    } catch (error) {
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Primeiro acesso"
        subtitle={`Etapa ${step} de 3`}
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
              <Text style={styles.title}>Identifique seu contrato</Text>
              <Text style={styles.text}>
                Digite o CPF ou CNPJ cadastrado na TR Telecom para iniciar.
              </Text>
              <TextField
                label="CPF ou CNPJ"
                value={document}
                onChangeText={(value) => setDocument(formatDocument(value))}
                keyboardType="number-pad"
                placeholder="000.000.000-00"
                error={errors.document}
                maxLength={18}
              />
              <Button title="Continuar" onPress={handleIdentify} loading={loading} />
            </Card>
          ) : null}

          {step === 2 && prospect ? (
            <Card style={styles.card}>
              <Text style={styles.title}>Confirme seus dados</Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Titular</Text>
                <Text style={styles.infoValue}>{prospect.name}</Text>
                <Text style={styles.infoLabel}>Plano</Text>
                <Text style={styles.infoValue}>{prospect.plan.name}</Text>
              </View>
              <TextField
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
              />
              <TextField
                label="Telefone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                error={errors.phone}
              />
              <View style={styles.row}>
                <Button
                  title="Voltar"
                  variant="secondary"
                  onPress={() => setStep(1)}
                  style={styles.half}
                />
                <Button title="Continuar" onPress={handleConfirmData} style={styles.half} />
              </View>
            </Card>
          ) : null}

          {step === 3 ? (
            <Card style={styles.card}>
              <Text style={styles.title}>Crie sua senha</Text>
              <Text style={styles.text}>
                Essa senha será usada para acessar a Central do Assinante.
              </Text>
              <TextField
                label="Senha"
                value={password}
                onChangeText={setPassword}
                isPassword
                error={errors.password}
              />
              <TextField
                label="Confirmar senha"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                error={errors.confirmPassword}
              />
              <View style={styles.row}>
                <Button
                  title="Voltar"
                  variant="secondary"
                  onPress={() => setStep(2)}
                  style={styles.half}
                />
                <Button
                  title="Concluir"
                  onPress={handleCreatePassword}
                  loading={loading}
                  style={styles.half}
                />
              </View>
            </Card>
          ) : null}

          <Button title="Já tenho acesso" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  infoBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  infoValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
});
