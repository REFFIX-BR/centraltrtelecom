import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabHeader } from '@/src/components/TabHeader';
import { colors, radius, shadows, spacing, tabScrollBottom } from '@/src/theme';

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  async function openSpeedTest() {
    try {
      await WebBrowser.openBrowserAsync('https://www.speedtest.net/');
    } catch {
      Alert.alert(
        'Não foi possível abrir',
        'Verifique sua conexão e tente novamente.'
      );
    }
  }

  return (
    <View style={styles.flex}>
      <TabHeader
        eyebrow="RESOLVA PELO APP"
        title="Suporte"
        subtitle="Soluções rápidas para a sua conexão"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + tabScrollBottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.sectionTitle}>Autoatendimento</Text>
          <Text style={styles.sectionSubtitle}>
            Escolha o que precisa e resolva em poucos toques.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir chamado"
          onPress={() => router.push('/suporte/novo')}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <LinearGradient
            colors={[colors.primaryDark, colors.primary, colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.wifiCard}
          >
            <View style={styles.wifiGlow} />
            <View style={styles.primaryIcon}>
              <Ionicons name="create-outline" size={27} color={colors.white} />
            </View>
            <View style={styles.primaryContent}>
              <Text style={styles.primaryEyebrow}>ATENDIMENTO</Text>
              <Text style={styles.primaryTitle}>Abrir chamado</Text>
              <Text style={styles.primaryDescription}>
                Escolha o setor, o motivo e descreva o que precisa.
              </Text>
            </View>
            <View style={styles.primaryArrow}>
              <Ionicons name="arrow-forward" size={19} color={colors.primary} />
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trocar senha do Wi-Fi"
          onPress={() => router.push('/wifi')}
          style={({ pressed }) => [
            styles.wifiSecondary,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.wifiSecondaryIcon}>
            <Ionicons name="key-outline" size={24} color={colors.accent} />
          </View>
          <View style={styles.wifiSecondaryContent}>
            <Text style={styles.wifiSecondaryEyebrow}>REDE WI-FI</Text>
            <Text style={styles.wifiSecondaryTitle}>Trocar senha</Text>
            <Text style={styles.wifiSecondaryDescription}>
              Altere o nome e a senha das redes 2.4 GHz e 5 GHz.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.accent} />
        </Pressable>

        <View style={styles.serviceGrid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir extrato de conexão"
            onPress={() => router.push('/extrato')}
            style={({ pressed }) => [
              styles.serviceCard,
              pressed && styles.serviceCardPressed,
            ]}
          >
            <View style={[styles.serviceIcon, styles.extractIcon]}>
              <Ionicons name="stats-chart-outline" size={23} color={colors.accent} />
            </View>
            <View style={[styles.readyBadge, { backgroundColor: colors.accentSoft }]}>
              <View style={[styles.readyDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.readyText, { color: colors.accent }]}>DISPONÍVEL</Text>
            </View>
            <Text style={styles.serviceTitle}>Extrato de conexão</Text>
            <Text style={styles.serviceDescription}>
              Consulte o histórico de uso e disponibilidade.
            </Text>
            <View style={styles.serviceFooter}>
              <Text style={styles.serviceLink}>Ver extrato</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.accent} />
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir teste de velocidade"
            onPress={openSpeedTest}
            style={({ pressed }) => [
              styles.serviceCard,
              pressed && styles.serviceCardPressed,
            ]}
          >
            <View style={[styles.serviceIcon, styles.speedIcon]}>
              <Ionicons name="speedometer-outline" size={24} color={colors.success} />
            </View>
            <View style={[styles.readyBadge, { backgroundColor: colors.successSoft }]}>
              <View style={styles.readyDot} />
              <Text style={styles.readyText}>DISPONÍVEL</Text>
            </View>
            <Text style={styles.serviceTitle}>Teste de velocidade</Text>
            <Text style={styles.serviceDescription}>
              Confira a velocidade atual da sua internet.
            </Text>
            <View style={styles.serviceFooter}>
              <Text style={styles.serviceLink}>Iniciar teste</Text>
              <Ionicons name="open-outline" size={17} color={colors.accent} />
            </View>
          </Pressable>
        </View>

        <View style={styles.tip}>
          <View style={styles.tipIcon}>
            <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
          </View>
          <Text style={styles.tipText}>
            Para um resultado mais preciso, faça o teste perto do roteador e pause
            downloads ou vídeos em outros aparelhos.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  intro: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  wifiCard: {
    minHeight: 174,
    borderRadius: radius.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  wifiGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(59,145,242,0.2)',
    right: -65,
    top: -80,
  },
  primaryIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryContent: {
    flex: 1,
  },
  primaryEyebrow: {
    color: colors.accentBright,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  primaryTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  primaryDescription: {
    color: colors.onPrimaryMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  primaryArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.soft,
  },
  wifiSecondaryIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiSecondaryContent: {
    flex: 1,
    gap: 2,
  },
  wifiSecondaryEyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  wifiSecondaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  wifiSecondaryDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  serviceGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  serviceCard: {
    flex: 1,
    minHeight: 226,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.soft,
  },
  serviceCardPressed: {
    backgroundColor: colors.accentUltraSoft,
    transform: [{ scale: 0.98 }],
  },
  serviceIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  extractIcon: {
    backgroundColor: colors.accentSoft,
  },
  speedIcon: {
    backgroundColor: colors.successSoft,
  },
  readyBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  readyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  readyText: {
    color: colors.success,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  serviceTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
    minHeight: 38,
  },
  serviceDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  serviceFooter: {
    marginTop: 'auto',
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceLink: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#D4E7FC',
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
});
