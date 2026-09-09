import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '@/src/theme';

function TabIcon({
  name,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={name}
        size={22}
        color={focused ? colors.primary : colors.textMuted}
      />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Sobe a barra acima dos botões/gesto do sistema (Android e iOS).
  const bottomGap = Math.max(insets.bottom, 8) + 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginBottom: Platform.OS === 'ios' ? 7 : 4,
        },
        tabBarStyle: [
          styles.tabBar,
          {
            bottom: bottomGap,
            height: Platform.OS === 'ios' ? 78 : 64,
            paddingBottom: Platform.OS === 'ios' ? 6 : 4,
          },
        ],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plano"
        options={{
          title: 'Plano',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="speedometer-outline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="faturas"
        options={{
          title: 'Faturas',
          tabBarIcon: ({ focused }) => <TabIcon name="card-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="suporte"
        options={{
          title: 'Suporte',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="headset-outline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Mais',
          tabBarIcon: ({ focused }) => <TabIcon name="menu-outline" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    backgroundColor: colors.white,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(199,213,231,0.78)',
    borderRadius: 24,
    paddingTop: 6,
    overflow: 'hidden',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrap: {
    width: 38,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(40,120,212,0.12)',
  },
});
