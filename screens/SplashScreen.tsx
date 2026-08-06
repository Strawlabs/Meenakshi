import { useAppTheme } from '../context/ThemeContext';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import Svg, { Rect, RadialGradient, Defs, Stop, Path, Circle, LinearGradient } from 'react-native-svg';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen({ navigation }: Props) {
  const { typography } = useAppTheme();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in the entire screen content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Animate the progress bar over 1.2s
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width animation requires native driver false
    }).start();

    // Silent authentication
    const { ensureAuthenticatedSession } = require('../services/authHelper');
    ensureAuthenticatedSession().catch((err: any) => console.error('[Splash] Auth failed:', err));

    // Bounce animation for chevron
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 6, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Navigate to Welcome screen after extended duration (1.6s)
    const timer = setTimeout(() => {
      navigation.replace('Welcome');
    }, 1600);
    
    return () => clearTimeout(timer);
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '60%'],
  });

  return (
    <View style={styles.container}>
      {/* Background: Full-screen radial gradient */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
              {/* Dark violet-navy center to near-black edges */}
              <Stop offset="0%" stopColor="#4c2f8f" />
              <Stop offset="100%" stopColor="#0d0a1a" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#bgGrad)" />
        </Svg>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        
        {/* Glass Card */}
        <View style={styles.glassCard}>
          
          {/* Custom SVG Badge Icon */}
          <View style={styles.iconContainer}>
            <Svg width="120" height="120" viewBox="0 0 120 120">
              <Defs>
                <LinearGradient id="badgeGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#4b7bfc" />
                  <Stop offset="100%" stopColor="#8b5cf6" />
                </LinearGradient>
              </Defs>
              
              {/* The M Outline Frame */}
              <Path 
                d="M 30,100 L 30,45 C 30,35 35,30 42,30 L 45,30 L 60,52 L 75,30 L 78,30 C 85,30 90,35 90,45 L 90,100" 
                stroke="url(#badgeGrad)" 
                strokeWidth="7" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                fill="none" 
              />
              
              {/* Person Head */}
              <Circle cx="60" cy="65" r="9" stroke="url(#badgeGrad)" strokeWidth="7" fill="none" />
              
              {/* Person Shoulders */}
              <Path 
                d="M 44,100 A 16 16 0 0 1 76,100" 
                stroke="url(#badgeGrad)" 
                strokeWidth="7" 
                strokeLinecap="round" 
                fill="none" 
              />
            </Svg>
          </View>

          {/* Typography */}
          <Text style={styles.headline}>Meenakshi</Text>
          <Text style={styles.tagline}>
            Your AI Memory & Financial{'\n'}Companion
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          {/* Trust Row */}
          <View style={styles.trustRow}>
            {/* SVG Lock Icon */}
            <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Rect x="5" y="11" width="14" height="11" rx="2" ry="2" />
              <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </Svg>
            <Text style={styles.trustText}>END-TO-END ENCRYPTED</Text>
          </View>
        </View>

      </Animated.View>

      {/* Footer Section with Bouncing Chevron */}
      <Animated.View style={[styles.footerContainer, { opacity: fadeAnim }]}>
        <Animated.View style={{ transform: [{ translateY: bounceAnim }], marginBottom: 16 }}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M6 9l6 6 6-6" />
          </Svg>
        </Animated.View>
        <Text style={styles.footerText}>
          INTELLIGENT SERENITY
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0a1a', // Fallback color
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    zIndex: 1,
  },
  glassCard: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: 'rgba(255,255,255,0.07)', // ~7% white
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 32,
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontFamily: 'Manrope_700Bold', // Bold weight
    fontSize: 32,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  tagline: {
    fontFamily: 'Inter_400Regular', // Regular weight
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)', // light lavender-gray approximation
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  progressTrack: {
    width: '70%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8b5cf6', // Solid bright violet
    borderRadius: 2,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
