import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/Button';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  fetchTicketSectors,
  openSupportTicket,
  type TicketSector,
} from '@/src/services/tickets';
import { colors, radius, shadows, spacing } from '@/src/theme';
import { formatPhone, onlyDigits } from '@/src/utils/format';

const DEFAULT_SETOR = 'SUPORTE';
const DEFAULT_MOTIVO = 'INFORMAÇÃO';

type DropdownProps = {
  label: string;
  value: string;
  placeholder?: string;
  options: string[];
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
};

function DropdownField({
  label,
  value,
  placeholder = 'Selecione',
  options,
  disabled,
  error,
  onChange,
}: DropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled || !options.length}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.dropdown,
          error ? styles.dropdownError : null,
          disabled && styles.dropdownDisabled,
          pressed && !disabled && styles.dropdownPressed,
        ]}
      >
        <Text
          style={[styles.dropdownValue, !value && styles.dropdownPlaceholder]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              style={styles.modalList}
              renderItem={({ item }) => {
                const active = item === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      active && styles.optionRowActive,
                      pressed && styles.dropdownPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                    {active ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.accent}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function applyDefaults(list: TicketSector[]): {
  setor: string;
  motivo: string;
} {
  const suporte =
    list.find((item) => item.setor.toUpperCase() === DEFAULT_SETOR) || list[0];
  if (!suporte) return { setor: '', motivo: '' };
  const motivo =
    suporte.motivos.find(
      (item) => item.toUpperCase() === DEFAULT_MOTIVO
    ) || suporte.motivos[0] || '';
  return { setor: suporte.setor, motivo };
}

export default function NewTicketScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sectors, setSectors] = useState<TicketSector[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [sectorName, setSectorName] = useState(DEFAULT_SETOR);
  const [motivo, setMotivo] = useState(DEFAULT_MOTIVO);
  const [phone, setPhone] = useState(() => formatPhone(user?.phone || ''));
  const [resumo, setResumo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedSector = useMemo(
    () => sectors.find((item) => item.setor === sectorName) || null,
    [sectors, sectorName]
  );

  const sectorOptions = useMemo(
    () => sectors.map((item) => item.setor),
    [sectors]
  );

  const motivoOptions = selectedSector?.motivos ?? [];

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoadingSectors(true);
      try {
        const list = await fetchTicketSectors();
        if (!active) return;
        setSectors(list);
        const defaults = applyDefaults(list);
        setSectorName(defaults.setor);
        setMotivo(defaults.motivo);
      } catch (error) {
        if (!active) return;
        Alert.alert(
          'Não foi possível carregar',
          error instanceof Error
            ? error.message
            : 'Falha ao buscar setores e motivos.'
        );
      } finally {
        if (active) setLoadingSectors(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function handleSectorChange(name: string) {
    setSectorName(name);
    const sector = sectors.find((item) => item.setor === name);
    const nextMotivo =
      sector?.motivos.find(
        (item) => item.toUpperCase() === DEFAULT_MOTIVO
      ) ||
      sector?.motivos[0] ||
      '';
    setMotivo(nextMotivo);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.setor;
      delete next.motivo;
      return next;
    });
  }

  async function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (!sectorName) nextErrors.setor = 'Escolha o setor';
    if (!motivo) nextErrors.motivo = 'Escolha o motivo';
    if (onlyDigits(phone).length < 10) {
      nextErrors.phone = 'Informe um telefone com DDD';
    }
    if (resumo.trim().length < 8) {
      nextErrors.resumo = 'Descreva o que você precisa (mín. 8 caracteres)';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !user) return;

    try {
      setSubmitting(true);
      await openSupportTicket({
        documento: user.document,
        setor: sectorName,
        motivo,
        resumo: resumo.trim(),
        phone,
      });
      Alert.alert(
        'Chamado aberto',
        'Recebemos sua solicitação. Nossa equipe entrará em contato no número informado.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert(
        'Não foi possível abrir',
        error instanceof Error
          ? error.message
          : 'Tente novamente em instantes.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Abrir chamado" subtitle="Suporte TR Telecom" />
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dados do chamado</Text>
            <Text style={styles.hint}>
              Setor e motivo já vêm como Suporte / Informação — altere se precisar.
            </Text>

            {loadingSectors ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Carregando opções…</Text>
              </View>
            ) : (
              <>
                <DropdownField
                  label="Setor"
                  value={sectorName}
                  options={sectorOptions}
                  onChange={handleSectorChange}
                  error={errors.setor}
                />
                <DropdownField
                  label="Motivo"
                  value={motivo}
                  options={motivoOptions}
                  disabled={!selectedSector}
                  onChange={(value) => {
                    setMotivo(value);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.motivo;
                      return next;
                    });
                  }}
                  error={errors.motivo}
                />
              </>
            )}

            <TextField
              label="Telefone para atendimento"
              value={phone}
              onChangeText={(value) => setPhone(formatPhone(value))}
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
              error={errors.phone}
            />
            <TextField
              label="Resumo do que você precisa"
              value={resumo}
              onChangeText={setResumo}
              placeholder="Ex.: Uma das câmeras parou de funcionar"
              multiline
              numberOfLines={4}
              style={styles.textarea}
              error={errors.resumo}
            />
            {phone.trim() && resumo.trim() ? (
              <View style={styles.preview}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color={colors.accent}
                />
                <Text style={styles.previewText}>
                  {resumo.trim()} /// ENTRAR EM CONTATO COM: {formatPhone(phone)}
                </Text>
              </View>
            ) : null}
            <Button
              title="Abrir chamado"
              onPress={handleSubmit}
              loading={submitting}
              disabled={loadingSectors || submitting}
            />
          </View>
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
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.soft,
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
  },
  loadingBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  fieldWrap: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  dropdown: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dropdownError: {
    borderColor: colors.danger,
  },
  dropdownDisabled: {
    opacity: 0.55,
  },
  dropdownPressed: {
    opacity: 0.92,
  },
  dropdownValue: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownPlaceholder: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  modalList: {
    paddingHorizontal: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  optionRowActive: {
    backgroundColor: colors.accentSoft,
  },
  optionText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextActive: {
    color: colors.primary,
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  preview: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D4E7FC',
  },
  previewText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});
