import React from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadows, spacing } from '@/src/theme';

type Props = {
  title: string;
  icon: ImageSourcePropType;
  url: string;
  style?: StyleProp<ViewStyle>;
};

export function DigitalServiceCard({ title, icon, url, style }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`Abrir ${title}`}
      android_ripple={{ color: 'rgba(14,44,91,0.06)' }}
    >
      <Image source={icon} style={styles.icon} accessibilityIgnoresInvertColors />
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 108,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.soft,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  title: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
});
