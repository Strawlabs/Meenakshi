import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../context/ThemeContext';

interface AIOrbProps {
  size?: number;
  children?: React.ReactNode;
}

export default function AIOrb({ size = 120, children }: AIOrbProps) {
  const { isDark, colors } = useAppTheme();
  
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Stitch: breathe animation — 4s total cycle, scale 1 → 1.05
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [breatheAnim]);

  // Stitch: gradient from-secondary to-secondary-fixed
  // secondary = #6b38d4, secondaryFixed = #e9ddff
  const gradientColors = (isDark 
    ? [colors.primary, colors.secondary]
    : [colors.secondary, colors.secondaryFixed]) as [string, string, ...string[]];

  return (
    <Animated.View style={[
      styles.container, 
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        transform: [{ scale: breatheAnim }],
        // Stitch: shadow-[0_0_40px_rgba(107,56,212,0.4)]
        shadowColor: '#6b38d4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 40,
        elevation: 10,
      }
    ]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children && (
        <View style={styles.childrenWrap}>
          {children}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  childrenWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
