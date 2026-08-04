import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '@/src/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  warning?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function QuickAction({ icon, title, hint, warning, onPress, style }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: 'rgba(14,44,91,0.06)' }}
    >
      <View style={styles.accent} />
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      {warning ? (
        <View style={styles.warning}>
          <Ionicons name="alert" size={12} color={colors.white} />
        </View>
      ) : null}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: colors.accentUltraSoft,
    transform: [{ scale: 0.985 }],
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  warning: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.warning,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
