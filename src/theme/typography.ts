import { TextStyle } from 'react-native';

import { colors } from './colors';

export const typography = {
  h1: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: colors.text,
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.text,
  },
  h3: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: colors.text,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },
} as const satisfies Record<string, TextStyle>;
