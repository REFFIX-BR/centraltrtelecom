import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert,
  Image,
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
import { HirePlansModal } from '@/src/components/HirePlansModal';
import { LoginPointModal } from '@/src/components/LoginPointModal';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, radius, spacing } from '@/src/theme';
import { formatDocument, isValidDocument } from '@/src/utils/format';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    login,
    pendingPointSelection,
    selectLoginPoint,
    cancelPointSelection,
  } = useAuth();
  const [document, setDocument] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ document?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [selectingPoint, setSelectingPoint] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);

  async function handleLogin() {
    const nextErrors: typeof errors = {};
    if (!isValidDocument(document)) {
      nextErrors.document = 'Informe um CPF ou CNPJ válido';
    }
    if (password.length < 3) {
      nextErrors.password = 'A senha deve ter pelo menos 3 dígitos';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setLoading(true);
      await login(document, password);
    } catch (error) {
      Alert.alert(
        'Não foi possível entrar',
        error instanceof Error ? error.message : 'Tente novamente.'
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#020710', colors.primaryDark, colors.primaryLight]}
        locations={[0, 0.48, 1]}
        style={styles.flex}
      >
        <View style={styles.glowTop} />
        <View style={styles.glowSide} />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + spacing.xl,
              paddingBottom: insets.bottom + spacing.xxl,
            },
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Image
              source={require('../../assets/images/logo-login.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="TR Telecom"
            />
            <View style={styles.brandCopy}>
              <Text style={styles.eyebrow}>BEM-VINDO À</Text>
              <Text style={styles.subtitle}>Central do Assinante</Text>
              <Text style={styles.description}>
                Sua conexão, suas faturas e seu suporte em um só lugar.
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <Text style={styles.formTitle}>Acesse sua conta</Text>
              <Text style={styles.formSubtitle}>
                Entre com os dados do titular do contrato
              </Text>
            </View>

            <View style={styles.form}>
              <TextField
                label="CPF ou CNPJ"
                value={document}
                onChangeText={(value) => setDocument(formatDocument(value))}
                keyboardType="number-pad"
                placeholder="Digite seu CPF ou CNPJ"
                error={errors.document}
                autoCapitalize="none"
                maxLength={18}
                returnKeyType="next"
                blurOnSubmit={false}
              />

              <TextField
                label="Senha"
                value={password}
                onChangeText={setPassword}
                isPassword
                placeholder="Digite sua senha"
                error={errors.password}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <Button title="Entrar na Central" onPress={handleLogin} loading={loading} />

              <Pressable
                accessibilityRole="link"
                style={({ pressed }) => [
                  styles.firstAccessButton,
                  pressed && styles.firstAccessPressed,
                ]}
                onPress={() => router.push('/(auth)/primeiro-acesso')}
              >
                <Text style={styles.firstAccess}>Primeiro acesso</Text>
                <Text style={styles.firstAccessHint}>Não sabe a senha SAC?</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Contratar um plano de internet"
            onPress={() => setHireOpen(true)}
            style={({ pressed }) => [
              styles.hireCard,
              pressed && styles.hireCardPressed,
            ]}
          >
            <View style={styles.hireIcon}>
              <Ionicons name="cart-outline" size={22} color={colors.white} />
            </View>
            <View style={styles.hireCopy}>
              <Text style={styles.hireTitle}>Ainda não é cliente?</Text>
              <Text style={styles.hireSubtitle}>
                Contrate internet fibra e fale no WhatsApp
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>

          <Text style={styles.footer}>TR Telecom · Conectando você ao que importa</Text>
        </ScrollView>
      </LinearGradient>

      <HirePlansModal
        visible={hireOpen}
        document={document}
        onClose={() => setHireOpen(false)}
      />

      <LoginPointModal
        visible={!!pendingPointSelection}
        options={pendingPointSelection?.options ?? []}
        loading={selectingPoint}
        onSelect={handleSelectPoint}
        onCancel={cancelPointSelection}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.primaryDark },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  glowTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(59,145,242,0.16)',
    top: -130,
    right: -100,
  },
  glowSide: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(43,120,212,0.12)',
    top: 270,
    left: -150,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 280,
    height: 96,
  },
  brandCopy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  subtitle: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  description: {
    maxWidth: 310,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: spacing.xl,
    gap: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 12,
  },
  formHeading: {
    gap: spacing.xs,
  },
  formTitle: {
    color: colors.primary,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  formSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  form: {
    gap: spacing.lg,
  },
  firstAccessButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  firstAccessPressed: {
    opacity: 0.65,
  },
  firstAccess: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
  firstAccessHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  hireCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  hireCardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  hireIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hireCopy: {
    flex: 1,
    gap: 2,
  },
  hireTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  hireSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
