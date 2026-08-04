import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LoginPointOption } from '@/src/services/auth';
import { colors, radius, spacing } from '@/src/theme';

type Props = {
  visible: boolean;
  options: LoginPointOption[];
  loading?: boolean;
  onSelect: (login: string) => void;
  onCancel: () => void;
};

export function LoginPointModal({
  visible,
  options,
  loading = false,
  onSelect,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Qual login deseja acessar?</Text>
          <Text style={styles.subtitle}>
            Encontramos {options.length} logins neste CPF/CNPJ. Escolha o login e
            o endereço correspondente.
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {options.map((option) => (
              <Pressable
                key={option.login}
                accessibilityRole="button"
                disabled={loading}
                onPress={() => onSelect(option.login)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && styles.optionPressed,
                  loading && styles.optionDisabled,
                ]}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="person-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.optionBody}>
                  <Text style={styles.optionEyebrow}>Login</Text>
                  <Text style={styles.optionLogin}>{option.login}</Text>
                  <Text style={styles.optionAddress}>{option.address}</Text>
                </View>
                {loading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                )}
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            disabled={loading}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelPressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '82%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentUltraSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  optionPressed: {
    backgroundColor: colors.accentSoft,
    transform: [{ scale: 0.985 }],
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
  optionEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  optionLogin: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  optionAddress: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.sm,
  },
  cancelPressed: {
    opacity: 0.7,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
});
