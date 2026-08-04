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

export default function NewTicketScreen() {
  const { createTicket } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (subject.trim().length < 4) nextErrors.subject = 'Informe um assunto';
    if (description.trim().length < 10) {
      nextErrors.description = 'Descreva o problema com mais detalhes';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setLoading(true);
      const ticket = await createTicket(subject.trim(), description.trim());
      Alert.alert('Protocolo aberto', `Número do protocolo: ${ticket.protocol}`, [
        {
          text: 'Ver protocolo',
          onPress: () => router.replace(`/suporte/${ticket.id}`),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Não foi possível abrir o protocolo.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Novo protocolo" subtitle="Suporte técnico" />
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
          <Card style={styles.card}>
            <Text style={styles.text}>
              Conte o que está acontecendo. Nossa equipe receberá o protocolo e acompanhará o
              atendimento.
            </Text>
            <TextField
              label="Assunto"
              value={subject}
              onChangeText={setSubject}
              placeholder="Ex.: Lentidão na internet"
              error={errors.subject}
            />
            <TextField
              label="Descrição"
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva o problema"
              multiline
              numberOfLines={5}
              style={styles.textarea}
              error={errors.description}
            />
            <Button title="Abrir protocolo" onPress={handleSubmit} loading={loading} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
  },
  card: {
    gap: spacing.lg,
  },
  text: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
