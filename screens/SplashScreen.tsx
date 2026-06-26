import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, Typography } from '../constants/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
};

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered fade in
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Breathing orb — matches Stitch @keyframes breath
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Ambient pulse glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.4,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Silent authentication of test developer account
    const { ensureAuthenticatedSession } = require('../services/authHelper');
    ensureAuthenticatedSession().catch((err: any) => console.error('[Splash] Auth failed:', err));

    const timer = setTimeout(() => navigation.replace('Welcome'), 2600);
    return () => clearTimeout(timer);
  }, []);

  return (
    // Stitch: bg = radial-gradient(circle at center, #6b38d4 0%, #131b2e 100%)
    <View style={styles.container}>
      {/* Radial gradient layers (RN approximation) */}
      <View style={styles.radialOuter} />
      <View style={styles.radialMid} />
      <View style={styles.radialInner} />

      {/* Ambient breathing pulse — Stitch .ai-pulse */}
      <Animated.View
        style={[
          styles.ambientPulse,
          { transform: [{ scale: glowScale }], opacity: glowScale.interpolate({ inputRange: [1, 1.4], outputRange: [0.4, 0.8] }) },
        ]}
      />

      {/* Glass container — Stitch .glass-container */}
      <Animated.View style={[styles.glassContainer, { opacity: fadeAnim }]}>
        {/* Orb */}
        <Animated.View style={[styles.orbWrap, { transform: [{ scale: pulseAnim }] }]}>
          {/* Outer glow ring */}
          <View style={styles.orbGlowRing} />
          {/* Main orb — gradient from secondary to secondary-fixed */}
          <View style={styles.orb}>
            <Text style={styles.orbIcon}>✦</Text>
          </View>
        </Animated.View>

        {/* Text content */}
        <Animated.View style={[styles.textBlock, { opacity: contentFade }]}>
          <Text style={styles.brandName}>Meenakshi</Text>
          <Text style={styles.tagline}>
            Ambient intelligence that evolves with you.{'\n'}Your narrative, protected.
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Footer */}
      <Animated.Text style={[styles.footer, { opacity: contentFade }]}>
        By Straw Labs
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Layered circles to approximate radial-gradient(#6b38d4 → #131b2e)
  radialOuter: {
    position: 'absolute',
    width: width * 1.6,
    height: width * 1.6,
    borderRadius: width * 0.8,
    backgroundColor: Colors.primaryContainer,
  },
  radialMid: {
    position: 'absolute',
    width: width,
    height: width,
    borderRadius: width / 2,
    backgroundColor: Colors.secondaryContainer,
    opacity: 0.7,
  },
  radialInner: {
    position: 'absolute',
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: Colors.secondary,
    opacity: 0.3,
    top: height * 0.28,
  },
  // Stitch .ai-pulse
  ambientPulse: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(132, 85, 239, 0.3)',
  },
  // Stitch .glass-container
  glassContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 32,
    paddingHorizontal: 48,
    paddingVertical: 48,
    alignItems: 'center',
    gap: Spacing.lg,
    maxWidth: 360,
    width: '88%',
  },
  // Orb wrap for breathing transform
  orbWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  // Outer glow ring
  orbGlowRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Colors.secondary,
    opacity: 0.25,
    // shadow = 0 0 40px rgba(107,56,212,0.4)
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  orb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    // gradient: from secondary (#6b38d4) to secondary-container (#8455ef)
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  orbIcon: {
    fontSize: 36,
    color: Colors.onSecondary,
  },
  textBlock: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandName: {
    ...Typography.headlineLgMobile,
    color: Colors.primaryFixed,
    textAlign: 'center',
  },
  tagline: {
    ...Typography.bodyMd,
    color: Colors.onPrimaryContainer,
    textAlign: 'center',
    maxWidth: 240,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
    textTransform: 'uppercase',
  },
});
