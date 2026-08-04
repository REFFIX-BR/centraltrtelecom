import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '@/src/theme';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

const variantStyles: Record<
  Variant,
  { bg: string; text: string; border?: string }
> = {
  primary: { bg: colors.primary, text: colors.white },
  secondary: { bg: colors.accentSoft, text: colors.primary },
  success: { bg: colors.success, text: colors.white },
  danger: { bg: colors.danger, text: colors.white },
  ghost: { bg: 'transparent', text: colors.accent, border: 'transparent' },
};

export function Button({
  title,
  loading,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: Props) {
  const palette = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' && styles.ghost,
        {
          backgroundColor:
            variant === 'primary' || variant === 'success' ? 'transparent' : palette.bg,
          borderColor: palette.border ?? colors.border,
          opacity: isDisabled ? 0.58 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
      android_ripple={
        variant === 'ghost'
          ? undefined
          : { color: 'rgba(255,255,255,0.18)' }
      }
      {...rest}
    >
      {variant === 'primary' || variant === 'success' ? (
        <LinearGradient
          colors={
            variant === 'success'
              ? [colors.success, colors.successDark]
              : [colors.accentBright, colors.primaryLight, colors.primary]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color={palette.text} />
          ) : (
            <Text style={[styles.label, { color: palette.text }]}>{title}</Text>
          )}
        </LinearGradient>
      ) : loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[styles.label, styles.plainLabel, { color: palette.text }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  ghost: {
    borderWidth: 0,
    minHeight: 44,
  },
  gradient: {
    width: '100%',
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainLabel: {
    paddingHorizontal: spacing.xl,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
