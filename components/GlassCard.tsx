import React, { useRef } from 'react';
import { StyleSheet, ViewStyle, StyleProp, View, TouchableOpacity, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../context/ThemeContext';
import { Radius } from '../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  onPress?: () => void;
  onLongPress?: () => void;
}

export default function GlassCard({ children, style, intensity = 20, onPress, onLongPress }: GlassCardProps) {
  const { isDark, colors } = useAppTheme();
  const styles = getStyles(isDark, colors);
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.98, duration: 80, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();

  const cardContent = (
    <>
      <BlurView 
        intensity={intensity} 
        tint={isDark ? 'dark' : 'light'} 
        style={StyleSheet.absoluteFill} 
      />
      <View style={styles.content}>
        {children}
      </View>
    </>
  );

  if (onPress || onLongPress) {
    return (
      <Animated.View style={[styles.container, style, { transform: [{ scale }] }]}>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={1}
          style={{ flex: 1 }}
        >
          {cardContent}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {cardContent}
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: isDark ? 'rgba(34, 42, 61, 0.40)' : 'rgba(255, 255, 255, 0.70)',
    borderWidth: 1,
    borderColor: isDark ? colors.surfaceVariant : 'rgba(255, 255, 255, 0.5)',
    borderTopColor: isDark ? colors.inversePrimary : 'rgba(255, 255, 255, 1)',
  },
  content: {
    flex: 1,
  },
});
