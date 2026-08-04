import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/src/theme';

function useLoopedValue(delay: number, duration = 2200) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [delay, duration, value]);

  return value;
}

function SignalWave({ delay, size }: { delay: number; size: number }) {
  const progress = useLoopedValue(delay);

  return (
    <Animated.View
      style={[
        styles.wave,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginLeft: -size / 2,
          opacity: progress.interpolate({
            inputRange: [0, 0.15, 1],
            outputRange: [0, 0.55, 0],
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function BlinkingLed({ delay, color }: { delay: number; color: string }) {
  const blink = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(blink, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 0.25,
          duration: 420,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [blink, delay]);

  return (
    <Animated.View style={[styles.led, { backgroundColor: color, opacity: blink }]} />
  );
}

function ProgressBar() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressBar,
          {
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-140, 200],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const SPLASH_TITLES = ['Conectando você', 'Só um instante'];

const SPLASH_MESSAGES = [
  'Preparando sua central',
  'Abrindo sua central',
  'Verificando sua conexão',
  'Consultando sua internet',
  'Buscando suas faturas',
  'Carregando suas faturas',
  'Verificando seu contrato',
  'Confirmando seu contrato',
  'Consultando seu chip',
  'Buscando upgrades',
  'Organizando seus dados',
  'Quase pronto…',
];

export function ConnectingSplash() {
  const [titleIndex, setTitleIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const tick = () => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setTitleIndex((current) => (current + 1) % SPLASH_TITLES.length);
        setMessageIndex((current) => (current + 1) % SPLASH_MESSAGES.length);
        Animated.timing(fade, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      });
    };

    const timer = setInterval(tick, 2000);
    return () => clearInterval(timer);
  }, [fade]);

  return (
    <LinearGradient
      colors={['#020710', colors.primaryDark, colors.primaryLight]}
      locations={[0, 0.55, 1]}
      style={styles.container}
    >
      <Image
        source={require('../../assets/images/logo-login.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="TR Telecom"
      />

      <View style={styles.stage}>
        <View style={styles.waveAnchor}>
          <SignalWave delay={0} size={210} />
          <SignalWave delay={700} size={210} />
          <SignalWave delay={1400} size={210} />
        </View>

        <View style={styles.antennas}>
          <View style={[styles.antenna, styles.antennaLeft]} />
          <View style={[styles.antenna, styles.antennaRight]} />
        </View>

        <View style={styles.router}>
          <View style={styles.routerTopLine} />
          <View style={styles.ledRow}>
            <BlinkingLed delay={0} color="#4ADE9B" />
            <BlinkingLed delay={260} color={colors.accentBright} />
            <BlinkingLed delay={520} color="#FFD166" />
          </View>
          <View style={styles.routerVents}>
            {[0, 1, 2, 3].map((item) => (
              <View key={item} style={styles.vent} />
            ))}
          </View>
        </View>

        <View style={styles.routerShadow} />
      </View>

      <View style={styles.textBlock}>
        <Animated.View style={{ opacity: fade, alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.title}>{SPLASH_TITLES[titleIndex]}</Text>
          <Text style={styles.message}>{SPLASH_MESSAGES[messageIndex]}</Text>
        </Animated.View>
        <ProgressBar />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.xxxl,
  },
  logo: {
    width: 220,
    height: 74,
  },
  stage: {
    width: 240,
    height: 200,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  waveAnchor: {
    position: 'absolute',
    top: 6,
    left: '50%',
    alignItems: 'center',
  },
  wave: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.accentBright,
  },
  antennas: {
    flexDirection: 'row',
    gap: 64,
    marginBottom: -6,
  },
  antenna: {
    width: 5,
    height: 46,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  antennaLeft: {
    transform: [{ rotate: '-16deg' }],
  },
  antennaRight: {
    transform: [{ rotate: '16deg' }],
  },
  router: {
    width: 168,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: '#0B2447',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
  },
  routerTopLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accentBright,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  ledRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  led: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  routerVents: {
    flexDirection: 'row',
    gap: 5,
  },
  vent: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  routerShadow: {
    marginTop: spacing.md,
    width: 132,
    height: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  textBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  message: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    textAlign: 'center',
  },
  progressTrack: {
    marginTop: spacing.md,
    width: 200,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressBar: {
    width: 140,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.accentBright,
  },
});
