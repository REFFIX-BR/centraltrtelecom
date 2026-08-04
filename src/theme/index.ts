import { colors } from './colors';
import { radius, shadows, spacing, tabScrollBottom } from './spacing';
import { typography } from './typography';

export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  tabScrollBottom,
} as const;

export { colors, radius, shadows, spacing, tabScrollBottom, typography };
