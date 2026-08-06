import { useAppTheme } from '../context/ThemeContext';
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, Defs, RadialGradient, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { useVoiceSession } from '../hooks/useVoiceSession';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Component ───────────────────────────────────────────────────────────────

export default function VoiceScreen() {
  const { typography } = useAppTheme();
  const Colors = {
    background: '#131b2e', // Actual sampled uniform background
    white: '#ffffff',
    violet: '#7c3aed',
    grayText: 'rgba(255,255,255,0.4)',
    glassPanel: 'rgba(255,255,255,0.06)',
    glassBorder: 'rgba(255,255,255,0.1)',
  };
  const styles = getStyles(Colors, typography);
  const insets = useSafeAreaInsets();

  const navigation = useNavigation();
  const session = useVoiceSession();
  const {
    voiceState,
    isActive,
    userTranscript,
    aiTranscript,
    startSession,
    stopSession,
    forceTurnComplete,
    interrupt,
    sendText,
  } = session;

  const [inputText, setInputText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const sendEnabledAnim = useRef(new Animated.Value(0)).current;
  // Debounce: prevent accidental double-tap on orb or exit button
  const orbPressedAtRef = useRef(0);
  const exitPressedAtRef = useRef(0);



  // ── Animations ─────────────────────────────────────────────────────────────

  const barAnims = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(10))
  ).current;

  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const orbScale = useRef(new Animated.Value(1)).current;

  // Idle breathing loop for glow + orb
  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowOpacity, { toValue: 0.8, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbScale, { toValue: 1.08, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowOpacity, { toValue: 0.3, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbScale, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, []);

  // Waveform bars when active
  useEffect(() => {
    if (isActive) {
      const waveLoop = Animated.loop(
        Animated.stagger(
          80,
          barAnims.map((anim, i) => {
            let maxH = 20;
            if (i === 3) maxH = 48;
            else if (i === 1 || i === 5) maxH = 36;
            else if (i === 2 || i === 4) maxH = 28;

            return Animated.sequence([
              Animated.timing(anim, { toValue: maxH, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
              Animated.timing(anim, { toValue: 10, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
            ]);
          })
        )
      );
      waveLoop.start();
      return () => waveLoop.stop();
    } else {
      barAnims.forEach(anim =>
        Animated.timing(anim, { toValue: 10, duration: 250, useNativeDriver: false }).start()
      );
    }
  }, [isActive]);

  // Send button enable/disable animation
  useEffect(() => {
    Animated.timing(sendEnabledAnim, {
      toValue: inputText.trim().length > 0 ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [inputText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopSession(); };
  }, [stopSession]);

  // Intercept physical back button on Android
  useEffect(() => {
    const onBackPress = () => {
      try { stopSession(); } catch (e) { console.warn(e); }
      navigation.navigate('Main' as never);
      return true; // Prevents default React Navigation pop
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      subscription.remove();
    };
  }, [navigation, stopSession]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Orb is now the sole voice entry point
  const handleOrbPress = async () => {
    // Debounce: ignore taps within 1.2s of the previous one
    const now = Date.now();
    if (now - orbPressedAtRef.current < 1200) return;
    orbPressedAtRef.current = now;

    if (inputFocused) {
      inputRef.current?.blur();
      Keyboard.dismiss();
    }
    if (!isActive) {
      await startSession();
    } else if (voiceState === 'listening') {
      forceTurnComplete();
    } else if (voiceState === 'speaking' || voiceState === 'processing') {
      interrupt();
    }
  };


  const handleKeyboardIconPress = () => {
    stopSession();
    navigation.navigate('Chat' as never);
  };

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    
    stopSession();
    setInputText('');
    (navigation as any).navigate('Chat', { initialQuery: trimmed });
  };

  // ── Derived display values ────────────────────────────────────────────────

  const statusLabel = (() => {
    switch (voiceState) {
      case 'connecting': return 'Connecting…';
      case 'listening': return 'Listening…';
      case 'processing': return 'Processing…';
      case 'speaking': return 'Speaking…';
      case 'error': return 'Error';
      default: return 'Ready';
    }
  })();

  const userDisplayText = userTranscript || (voiceState === 'idle' ? 'How is my portfolio performance today?' : '');
  const aiDisplayText = aiTranscript || (voiceState === 'idle' ? 'Analyzing your asset distribution and recent market trends. One moment.' : '');

  const sendButtonColor = sendEnabledAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.2)', Colors.violet],
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => {
                const now = Date.now();
                if (now - exitPressedAtRef.current < 1000) return;
                exitPressedAtRef.current = now;
                try { stopSession(); } catch (e) { console.warn('stopSession error on exit:', e); }
                navigation.navigate('Main' as never);
              }}
            >

              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <Path d="M18 6L6 18M6 6l12 12" />
              </Svg>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Meenakshi</Text>
              <Text style={styles.headerStatus}>{statusLabel}</Text>
            </View>

            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Settings' as never)}>
              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="12" cy="12" r="3" />
                <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* ── Main ── */}
          <View style={styles.main}>

            {/* Transcript Area */}
            <View style={styles.transcriptArea} pointerEvents="none">
              {!!userDisplayText && (
                <Text style={styles.userText} numberOfLines={2}>
                  "{userDisplayText}"
                </Text>
              )}
              {!!aiDisplayText && (
                <Text style={styles.modelText} numberOfLines={4}>
                  {aiDisplayText}
                </Text>
              )}
            </View>

            {/* Orb Area — measured from Stitch reference pixels, not estimated */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleOrbPress}
              disabled={voiceState === 'connecting'}
              style={styles.orbContainer}
            >
              {/* Layer 1: wide, glowing purple ambient bloom */}
              <Animated.View pointerEvents="none" style={[styles.orbAmbientBloom, { opacity: glowOpacity, transform: [{ scale: orbScale }] }]}>
                <Svg width="700" height="700">
                  <Defs>
                    <RadialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
                      <Stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
                      <Stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.15" />
                      <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Circle cx="350" cy="350" r="350" fill="url(#ambientGlow)" />
                </Svg>
              </Animated.View>

              {/* Layer 2, 3 + 4: Svg based orb to fix Android scaling bug */}
              <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]}>
                <Svg width={200} height={200}>
                  <Defs>
                    <SvgLinearGradient id="orbGrad" x1="50%" y1="35%" x2="50%" y2="100%">
                      <Stop offset="0%" stopColor="rgba(70,52,140,0.55)" />
                      <Stop offset="55%" stopColor="rgba(35,30,80,0.35)" />
                      <Stop offset="100%" stopColor="rgba(20,20,45,0.15)" />
                    </SvgLinearGradient>
                  </Defs>
                  {/* Fill is the glass gradient, stroke is the near-invisible outline */}
                  <Circle cx={100} cy={100} r={99} fill="url(#orbGrad)" stroke="rgba(208,188,255,0.12)" strokeWidth={1} />
                </Svg>
              </Animated.View>

              <View style={styles.waveform} pointerEvents="none">
                {barAnims.map((anim, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveBar,
                      { height: anim },
                      (i === 3) && styles.waveBarCenter,
                      (i === 2 || i === 4) && { backgroundColor: '#d0bcff' },
                    ]}
                  />
                ))}
              </View>
            </TouchableOpacity>

          </View>

          {/* ── Floating Text Input Bar ── */}
          <View style={[styles.inputBarWrap, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
            <View style={[styles.inputBar, inputFocused && styles.inputBarFocused]}>
              <TouchableOpacity style={styles.inputIconBtn} onPress={handleKeyboardIconPress}>
                <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <Rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                  <Path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16h8" />
                </Svg>
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Ask Meenakshi anything…"
                placeholderTextColor="rgba(255,255,255,0.35)"
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />

              <TouchableOpacity
                style={styles.sendBtn}
                onPress={handleSend}
                disabled={!inputText.trim()}
              >
                <Animated.View style={[styles.sendBtnCircle, { backgroundColor: sendButtonColor }]}>
                  <Svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                    <Path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </Svg>
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safe: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.glassPanel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 22,
    color: Colors.white,
  },
  headerStatus: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.grayText,
  },

  // ── Main ────────────────────────────────────────────────────────────────
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  transcriptArea: {
    position: 'absolute',
    top: 40,
    alignItems: 'center',
    gap: 24,
    width: '100%',
    zIndex: 10,
  },
  userText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.grayText,
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: '85%',
  },
  modelText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 26,
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 32,
  },

  // Orb — now tappable, is the button
  orbContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  // Layer 1 — vibrant purple glow behind the orb
  orbAmbientBloom: {
    position: 'absolute',
    width: 700,
    height: 700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Layer 2+4 — translucent glass, NOT a solid fill. backgroundColor itself stays near-transparent;
  // the internal LinearGradient (below, in JSX) carries the actual light falloff.
  orb: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 40,
      },
      android: {
        elevation: 0, // disable hardware shadow to avoid black boxes
      }
    })
  },

  waveform: {
    position: 'absolute',
    bottom: -24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#d0bcff',
  },
  waveBarCenter: {
    backgroundColor: Colors.white,
  },

  // ── Floating Input Bar ────────────────────────────────────────────────────
  inputBarWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(124,58,237,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    paddingLeft: 8,
    paddingRight: 8,
    gap: 8,
  },
  inputBarFocused: {
    borderColor: 'rgba(124,58,237,0.5)',
    backgroundColor: 'rgba(124,58,237,0.14)',
  },
  inputIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#fff',
    paddingVertical: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
