import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/src/theme';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle: string;
};

export function TabHeader({ eyebrow = 'TR TELECOM', title, subtitle }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[colors.primaryDark, colors.primary]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
    >
      <View style={styles.stripe} />
      <View style={styles.stripeThin} />

      <View style={styles.headerRow}>
        <Image
          source={require('../../assets/images/logo-redonda.jpg')}
          style={styles.logo}
          accessibilityLabel="TR Telecom"
        />
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    borderBottomRightRadius: 38,
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    width: 260,
    height: 74,
    right: -70,
    top: -26,
    backgroundColor: 'rgba(59,145,242,0.14)',
    transform: [{ rotate: '-18deg' }],
  },
  stripeThin: {
    position: 'absolute',
    width: 220,
    height: 12,
    right: -40,
    top: 44,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '-18deg' }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: colors.white,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.accentBright,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  title: {
    color: colors.onPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.onPrimaryMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
