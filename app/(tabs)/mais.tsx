import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { TabHeader } from '@/src/components/TabHeader';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, radius, spacing, tabScrollBottom } from '@/src/theme';
import { formatDocument } from '@/src/utils/format';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, unreadNotifications } = useAuth();

  if (!user) return null;

  const items: MenuItem[] = [
    {
      icon: 'person-outline',
      title: 'Meus dados',
      subtitle: 'Nome, contato e endereço',
      onPress: () => router.push('/perfil'),
    },
    {
      icon: 'notifications-outline',
      title: 'Notificações',
      subtitle:
        unreadNotifications > 0
          ? `${unreadNotifications} não lida(s)`
          : 'Nenhuma nova notificação',
      onPress: () => router.push('/notificacoes'),
    },
    {
      icon: 'document-attach-outline',
      title: 'Documentos',
      subtitle: 'Envio e histórico de arquivos',
      onPress: () => router.push('/documentos'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Termos e privacidade',
      subtitle: 'Políticas de uso da Central',
      onPress: () =>
        Alert.alert(
          'Termos TR Telecom',
          'Este protótipo apresenta termos simulados. Em produção, aqui ficam os documentos oficiais da TR Telecom.'
        ),
    },
  ];

  async function handleLogout() {
    Alert.alert('Sair da conta', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  return (
    <View style={styles.flex}>
      <TabHeader
        eyebrow="SUA CENTRAL"
        title="Mais"
        subtitle="Conta, documentos e preferências"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + tabScrollBottom },
        ]}
      >
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.firstName.charAt(0)}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.doc}>{formatDocument(user.document)}</Text>
            <Text style={styles.email}>{user.email || 'E-mail não informado'}</Text>
          </View>
        </Card>

        {items.map((item) => (
          <Card key={item.title} style={styles.menuCard} onPress={item.onPress}>
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        ))}

        <Button title="Sair da conta" variant="danger" onPress={handleLogout} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  profileCard: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  doc: {
    color: colors.textSecondary,
  },
  email: {
    color: colors.textMuted,
    fontSize: 13,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  menuSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
