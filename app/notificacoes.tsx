import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/src/components/Card';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, radius, spacing } from '@/src/theme';
import { formatDate } from '@/src/utils/format';

export default function NotificationsScreen() {
  const { user, markNotificationsRead } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    markNotificationsRead();
  }, [markNotificationsRead]);

  if (!user) return null;

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Notificações" subtitle="Avisos da sua conta" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        {user.notifications.length === 0 ? (
          <Card>
            <Text style={styles.empty}>Nenhuma notificação no momento.</Text>
          </Card>
        ) : (
          user.notifications.map((item) => (
            <Card key={item.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title}>{item.title}</Text>
                {!item.read ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </Card>
          ))
        )}
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
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  message: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
  },
  empty: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
