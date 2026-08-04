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
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/contexts/AuthContext';
import { updateWifiSettings, type WifiBand } from '@/src/services/ont';
import { colors, radius, spacing } from '@/src/theme';

const bands: { key: WifiBand; label: string; hint: string }[] = [
  { key: 'both', label: 'Ambas', hint: '2.4 GHz e 5 GHz' },
  { key: '2g', label: '2.4 GHz', hint: 'Mais alcance' },
  { key: '5g', label: '5 GHz', hint: 'Mais velocidade' },
];

type Errors = {
  ssid?: string;
  password?: string;
  confirmPassword?: string;
  ssid5g?: string;
  password5g?: string;
};

function validateSsid(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length < 2) return 'Informe o nome da rede';
  if (trimmed.length > 32) return 'O nome pode ter no máximo 32 caracteres';
  return undefined;
}

export default function WifiScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [band, setBand] = useState<WifiBand>('both');
  const [sameForBoth, setSameForBoth] = useState(true);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ssid5g, setSsid5g] = useState('');
  const [password5g, setPassword5g] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const splitNetworks = band === 'both' && !sameForBoth;

  if (!user) return null;

  function validate(): boolean {
    const next: Errors = {};

    next.ssid = validateSsid(ssid);

    if (password.length < 8) {
      next.password = 'A senha precisa ter ao menos 8 caracteres';
    }

    if (confirmPassword !== password) {
      next.confirmPassword = 'As senhas não coincidem';
    }

    if (splitNetworks) {
      next.ssid5g = validateSsid(ssid5g);
      if (password5g.length < 8) {
        next.password5g = 'A senha precisa ter ao menos 8 caracteres';
      }
    }

    const filled = Object.fromEntries(
      Object.entries(next).filter(([, value]) => !!value)
    ) as Errors;

    setErrors(filled);
    return Object.keys(filled).length === 0;
  }

  async function applyChanges() {
    if (!user) return;

    try {
      setLoading(true);
      await updateWifiSettings({
        login: user.login,
        band,
        ssid: ssid.trim(),
        password,
        ssid5g: splitNetworks ? ssid5g.trim() : undefined,
        password5g: splitNetworks ? password5g : undefined,
      });

      Alert.alert(
        'Wi-Fi atualizado',
        'A nova senha já está valendo. Reconecte seus aparelhos usando a senha que você acabou de definir.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert(
        'Não foi possível alterar',
        error instanceof Error
          ? error.message
          : 'Tente novamente em alguns instantes.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (!validate()) return;

    Alert.alert(
      'Confirmar alteração',
      'Todos os aparelhos conectados serão desconectados e precisarão entrar novamente com a nova senha. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Alterar', style: 'destructive', onPress: applyChanges },
      ]
    );
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Trocar senha do Wi-Fi"
        subtitle="Defina o nome e a senha da sua rede"
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
          keyboardShouldPersistTaps="always"
        >
          <Card style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <Ionicons name="wifi-outline" size={20} color={colors.accent} />
            </View>
            <Text style={styles.noticeText}>
              A alteração é feita direto no seu roteador. Mantenha-o ligado durante o
              processo, que leva alguns segundos.
            </Text>
          </Card>

          <Text style={styles.sectionTitle}>Qual rede deseja alterar?</Text>
          <View style={styles.bands}>
            {bands.map((item) => {
              const active = band === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setBand(item.key)}
                  accessibilityRole="button"
                  style={[styles.band, active && styles.bandActive]}
                >
                  <Text style={[styles.bandLabel, active && styles.bandLabelActive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.bandHint, active && styles.bandHintActive]}>
                    {item.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {band === 'both' ? (
            <Card style={styles.switchCard}>
              <View style={styles.switchTexts}>
                <Text style={styles.switchTitle}>
                  Mesmo nome e senha nas duas redes
                </Text>
                <Text style={styles.switchHint}>
                  Seus aparelhos escolhem sozinhos a melhor frequência
                </Text>
              </View>
              <Switch
                value={sameForBoth}
                onValueChange={setSameForBoth}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
                thumbColor={colors.white}
              />
            </Card>
          ) : null}

          <Card style={styles.formCard}>
            {splitNetworks ? (
              <Text style={styles.cardTitle}>Rede 2.4 GHz</Text>
            ) : null}

            <TextField
              label="Nome da rede (SSID)"
              value={ssid}
              onChangeText={setSsid}
              placeholder="Ex.: TR_CASA"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={32}
              error={errors.ssid}
            />

            <TextField
              label="Nova senha"
              value={password}
              onChangeText={setPassword}
              isPassword
              placeholder="Mínimo de 8 caracteres"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.password}
            />

            <TextField
              label="Confirmar nova senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
              placeholder="Repita a nova senha"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.confirmPassword}
            />
          </Card>

          {splitNetworks ? (
            <Card style={styles.formCard}>
              <Text style={styles.cardTitle}>Rede 5 GHz</Text>

              <TextField
                label="Nome da rede (SSID)"
                value={ssid5g}
                onChangeText={setSsid5g}
                placeholder="Ex.: TR_CASA_5G"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={32}
                error={errors.ssid5g}
              />

              <TextField
                label="Nova senha"
                value={password5g}
                onChangeText={setPassword5g}
                isPassword
                placeholder="Mínimo de 8 caracteres"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.password5g}
              />
            </Card>
          ) : null}

          <Button
            title="Salvar alterações"
            loading={loading}
            onPress={handleSubmit}
          />

          <Text style={styles.helper}>
            Após salvar, reconecte celulares, TVs e computadores usando a nova senha.
          </Text>
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
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  bands: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  band: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  bandActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bandLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  bandLabelActive: {
    color: colors.white,
  },
  bandHint: {
    color: colors.textMuted,
    fontSize: 11,
  },
  bandHintActive: {
    color: 'rgba(255,255,255,0.75)',
  },
  formCard: {
    gap: spacing.lg,
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  switchTexts: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  switchHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
