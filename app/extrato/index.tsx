import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  fetchConnectionHistory,
  type ConnectionSession,
} from '@/src/services/connectionHistory';
import { colors, radius, spacing } from '@/src/theme';

export default function ExtratoScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<ConnectionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.login) return;
    setError(null);
    try {
      setSessions(await fetchConnectionHistory(user.login));
    } catch (fetchError) {
      setSessions([]);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Não foi possível carregar o extrato.'
      );
    }
  }, [user?.login]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!user) return null;

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Extrato de conexão"
        subtitle="Histórico das suas sessões"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Buscando sessões...</Text>
          </View>
        ) : error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Extrato indisponível"
            description={error}
          />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon="stats-chart-outline"
            title="Sem registros"
            description="Ainda não encontramos sessões de conexão para este login."
          />
        ) : (
          sessions.map((session, index) => (
            <Card
              key={`${session.startedAt}-${session.endedAt ?? 'online'}-${index}`}
              style={[
                styles.sessionCard,
                session.isOnline && styles.sessionOnline,
              ]}
            >
              <View style={styles.sessionTop}>
                <View
                  style={[
                    styles.sessionIcon,
                    {
                      backgroundColor: session.isOnline
                        ? colors.successSoft
                        : colors.accentSoft,
                    },
                  ]}
                >
                  <Ionicons
                    name={session.isOnline ? 'radio-outline' : 'time-outline'}
                    size={18}
                    color={session.isOnline ? colors.success : colors.accent}
                  />
                </View>
                <View style={styles.sessionHeading}>
                  <Text style={styles.sessionTitle}>
                    {session.isOnline ? 'Sessão atual' : `Sessão ${sessions.length - index}`}
                  </Text>
                  <Text style={styles.sessionDuration}>{session.duration}</Text>
                </View>
                {session.isOnline ? (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>ONLINE</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Início</Text>
                  <Text style={styles.metaValue}>{session.startedAt}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Fim</Text>
                  <Text style={styles.metaValue}>
                    {session.endedAt ?? 'Ainda conectado'}
                  </Text>
                </View>
              </View>

              <View style={styles.trafficRow}>
                <View style={styles.trafficItem}>
                  <Ionicons name="arrow-up-outline" size={14} color={colors.accent} />
                  <Text style={styles.trafficLabel}>Upload</Text>
                  <Text style={styles.trafficValue}>{session.upload}</Text>
                </View>
                <View style={styles.trafficDivider} />
                <View style={styles.trafficItem}>
                  <Ionicons name="arrow-down-outline" size={14} color={colors.success} />
                  <Text style={styles.trafficLabel}>Download</Text>
                  <Text style={styles.trafficValue}>{session.download}</Text>
                </View>
              </View>
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
  loading: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sessionCard: {
    gap: spacing.md,
  },
  sessionOnline: {
    borderColor: '#A7DCC8',
    borderWidth: 1,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionHeading: {
    flex: 1,
    gap: 2,
  },
  sessionTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  sessionDuration: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
  },
  metaGrid: {
    gap: spacing.sm,
  },
  metaItem: {
    gap: 2,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  metaValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  trafficRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentUltraSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  trafficItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  trafficDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  trafficLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  trafficValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
