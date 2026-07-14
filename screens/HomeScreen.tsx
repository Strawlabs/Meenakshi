import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { SUGGESTED_PROMPTS } from '../constants/index';
import supabase from '../lib/supabase';
import {
  getLatestBriefing,
  getUnreadNotifications,
  markNotificationRead,
  updateNotificationPreferences,
  type AiBriefing,
  type Notification,
} from '../services/notificationService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Glass card component — Stitch .glass-card
 * background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
 * border: 1px solid rgba(255,255,255,0.5)
 */
function GlassCard({ children, style, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.98, duration: 80, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();

  if (!onPress) {
    return (
      <Animated.View style={[styles.glassCard, style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.glassCard, style, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={styles.glassCardInner}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const [briefing, setBriefing] = useState<AiBriefing | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load briefing and notifications in parallel
      const [latestBriefing, unreadNotifs] = await Promise.all([
        getLatestBriefing(user.id, 'daily'),
        getUnreadNotifications(user.id),
      ]);

      setBriefing(latestBriefing);
      setNotifications(unreadNotifs);

      // Register push token (no-op on simulator; works on physical device)
      try {
        const Constants = await import('expo-constants');
        if (Constants.default.appOwnership === 'expo') {
          console.log('[HomeScreen] Running in Expo Go, skipping push registration');
        } else {
          const Notifications = await import('expo-notifications').catch(() => null);
          if (!Notifications) throw new Error('expo-notifications not installed');
          const { status } = await Notifications.requestPermissionsAsync();

        if (status === 'granted') {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          if (tokenData?.data) {
            await updateNotificationPreferences(user.id, { push_token: tokenData.data });
          }
        }
        } // Close else block
      } catch {
        // expo-notifications not configured or simulator — safe to skip
      }
    } catch (err) {
      console.error('[HomeScreen] loadData error:', err);
    } finally {
      setLoadingBriefing(false);
      setLoadingNotifs(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrompt = (query: string, description?: string) => {
    const finalQuery = description
      ? `Tell me more about this briefing: "${description}"`
      : query;
    navigation.navigate('Chat', { initialQuery: finalQuery });
  };

  const handleNotificationTap = async (notif: Notification) => {
    // Mark read immediately for responsive feel
    await markNotificationRead(notif.id);
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    // Route based on category
    if (notif.category === 'financial_alert' || notif.category === 'renewal') {
      navigation.navigate('Finance' as any);
    } else if (notif.category === 'relationship_reminder') {
      navigation.navigate('Circles' as any);
    }
  };

  /** Priority dot colour — Stitch palette */
  const priorityDotColor = (priority: Notification['priority']): string => {
    if (priority === 'high') return Colors.error;          // #ba1a1a red
    if (priority === 'medium') return '#f59e0b';           // true amber (not in Stitch yet)
    return Colors.outline;                                  // #76777d grey
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Stitch ambient background ornaments */}
      <View style={styles.ornamentTopRight} />
      <View style={styles.ornamentMidLeft} />

      {/* Top App Bar — Stitch */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity 
            style={styles.avatarChip}
            onPress={() => navigation.navigate('Settings' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.avatarChipText}>P</Text>
          </TouchableOpacity>
          <Text style={styles.brandName}>Meenakshi</Text>
        </View>
        <TouchableOpacity style={styles.searchBtn}>
          <Text style={styles.searchBtnIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — Stitch "Good Morning" section */}
        <View style={styles.hero}>
          <Text style={styles.heroGreeting}>
            {getGreeting()}, Prabhu.
          </Text>
          <Text style={styles.heroSub}>I've prepared today's briefing for you.</Text>
        </View>

        {/* ── AI Daily Briefing Card ─────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Today's Briefing</Text>
          <GlassCard>
            {loadingBriefing ? (
              <View style={styles.emptyBriefingContainer}>
                <Text style={styles.emptyBriefingDesc}>Loading your briefing…</Text>
              </View>
            ) : briefing === null ? (
              <View style={styles.emptyBriefingContainer}>
                <Text style={styles.emptyBriefingIcon}>✨</Text>
                <Text style={styles.emptyBriefingTitle}>Briefing Not Ready Yet</Text>
                <Text style={styles.emptyBriefingDesc}>
                  Meenakshi will prepare your daily briefing at 7 AM. Sync your Gmail in the Wealth tab to get started.
                </Text>
              </View>
            ) : (
              <View style={styles.briefingCardInner}>
                <Text style={styles.briefingHeadline}>{briefing.content.headline}</Text>
                {(briefing.content.sections ?? []).map((section, si) => (
                  <View key={si} style={styles.briefingSection}>
                    <Text style={styles.briefingSectionTitle}>{section.title}</Text>
                    {(section.items ?? []).map((item, ii) => (
                      <View key={ii} style={styles.briefingItemRow}>
                        <Text style={styles.briefingItemBullet}>•</Text>
                        <Text style={styles.briefingItemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.briefBtnPrimary}
                  onPress={() => handlePrompt('Tell me more about today\'s briefing')}
                >
                  <Text style={styles.briefBtnPrimaryText}>Ask Meenakshi</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>
        </View>

        {/* ── Smart Notifications ──────────────────────────── */}
        {(loadingNotifs || notifications.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notifications</Text>
            {loadingNotifs ? (
              <GlassCard>
                <View style={styles.emptyBriefingContainer}>
                  <Text style={styles.emptyBriefingDesc}>Checking notifications…</Text>
                </View>
              </GlassCard>
            ) : (
              notifications.map((notif) => (
                <GlassCard key={notif.id} onPress={() => handleNotificationTap(notif)}>
                  <View style={styles.notifRow}>
                    <View
                      style={[
                        styles.priorityDot,
                        { backgroundColor: priorityDotColor(notif.priority) },
                      ]}
                    />
                    <View style={styles.notifContent}>
                      <Text style={styles.notifTitle} numberOfLines={1}>
                        {notif.title}
                      </Text>
                      <Text style={styles.notifBody} numberOfLines={1}>
                        {notif.body}
                      </Text>
                    </View>
                    <Text style={styles.notifArrow}>›</Text>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        )}

        {/* Suggested Inquiries — Stitch */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Suggested Inquiries</Text>
          {(SUGGESTED_PROMPTS || []).map((prompt: string, i: number) => (
            <GlassCard
              key={i}
              onPress={() => handlePrompt(prompt)}
            >
              <View style={styles.promptRow}>
                <Text style={styles.promptText}>{prompt}</Text>
                <Text style={styles.promptArrow}>→</Text>
              </View>
            </GlassCard>
          ))}
        </View>

        {/* Quick Tools — Stitch */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tools</Text>
          <View style={styles.toolsGrid}>
            <GlassCard style={styles.toolCard}>
              <View style={styles.toolIconWrap}>
                <Text style={styles.toolIconText}>📇</Text>
              </View>
              <Text style={styles.toolLabel}>Scan Card</Text>
            </GlassCard>
            <GlassCard style={styles.toolCard} onPress={() => navigation.navigate('Documents' as any)}>
              <View style={styles.toolIconWrap}>
                <Text style={styles.toolIconText}>📄</Text>
              </View>
              <Text style={styles.toolLabel}>Upload Document</Text>
            </GlassCard>
          </View>
        </View>

        {/* Visual signature banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerGradient} />
          <Text style={styles.bannerText}>
            Intelligence is invisible, yet ever-present.
          </Text>
        </View>
      </ScrollView>

      {/* Floating AI Orb — Stitch */}
      <TouchableOpacity
        style={styles.floatingOrb}
        onPress={() => navigation.navigate('Voice')}
        activeOpacity={0.85}
      >
        <View style={styles.floatingOrbTooltip}>
          <Text style={styles.floatingOrbTooltipText}>Talk to Meenakshi</Text>
        </View>
        <Text style={styles.floatingOrbIcon}>✦</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Stitch ambient ornaments
  ornamentTopRight: {
    position: 'absolute',
    top: -96,
    right: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: Colors.secondary,
    opacity: 0.06,
  },
  ornamentMidLeft: {
    position: 'absolute',
    top: '45%',
    left: -128,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.primaryFixedDim,
    opacity: 0.10,
  },
  // Top App Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMobile,
    height: 64,
    backgroundColor: `${Colors.surface}B3`,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSecondaryContainer,
  },
  brandName: {
    fontSize: FontSize.headlineMobile,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: Colors.primary,
  },
  searchBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnIcon: { fontSize: 18 },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.lg,
  },
  // Hero
  hero: { gap: Spacing.xs },
  heroGreeting: {
    // Stitch display-lg reduced for mobile
    fontSize: 36,
    fontWeight: '800',
    color: Colors.onSurface,
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  heroSub: {
    fontSize: FontSize.bodyLg,
    color: Colors.onSurfaceVariant,
    opacity: 0.8,
  },
  // Anomaly Card
  anomalyCard: {
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  anomalyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  anomalyIconText: {
    fontSize: 20,
  },
  anomalyTextWrap: {
    flex: 1,
  },
  anomalyTitle: {
    fontSize: FontSize.bodyMd,
    fontWeight: '700',
    color: Colors.onErrorContainer,
    marginBottom: 4,
  },
  anomalySub: {
    fontSize: FontSize.labelSm,
    color: Colors.onErrorContainer,
    opacity: 0.8,
  },
  // Glass Card — Stitch
  glassCard: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  glassCardInner: {
    padding: Spacing.lg,
  },
  // Section
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.labelSm,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  // ── AI Briefing Card ───────────────────────────────────
  briefingCardInner: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  briefingHeadline: {
    fontSize: FontSize.headlineSm,
    fontWeight: '700',
    color: Colors.onSurface,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  briefingSection: {
    gap: 6,
  },
  briefingSectionTitle: {
    fontSize: FontSize.labelSm,
    fontWeight: '700',
    color: Colors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  briefingItemRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  briefingItemBullet: {
    fontSize: FontSize.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
  briefingItemText: {
    fontSize: FontSize.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    flex: 1,
  },
  // ── Notification rows ──────────────────────────────────
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontSize: FontSize.bodyMd,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  notifBody: {
    fontSize: FontSize.bodySm,
    color: Colors.onSurfaceVariant,
  },
  notifArrow: {
    fontSize: 20,
    color: Colors.outline,
    fontWeight: '300',
  },
  // ── Shared brief action button ─────────────────────────
  briefBtnPrimary: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginTop: Spacing.xs,
  },
  briefBtnPrimaryText: {
    fontSize: FontSize.labelSm,
    fontWeight: '700',
    color: Colors.onSecondary,
    letterSpacing: 0.3,
  },
  // Prompt
  promptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  promptText: {
    fontSize: FontSize.bodyMd,
    color: Colors.onSurface,
    flex: 1,
  },
  promptArrow: {
    fontSize: 18,
    color: Colors.secondary,
    opacity: 0.6,
  },
  // Tools
  toolsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  toolCard: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  toolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIconText: { fontSize: 18 },
  toolLabel: {
    fontSize: FontSize.labelSm,
    fontWeight: '600',
    color: Colors.onSurface,
    letterSpacing: 0.3,
  },
  // Banner
  bannerCard: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 140,
    backgroundColor: Colors.primaryContainer,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  bannerGradient: {
    position: 'absolute',
    inset: 0,
    backgroundColor: `${Colors.primaryContainer}66`,
  },
  bannerText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.bodyMd,
    padding: Spacing.md,
    fontStyle: 'italic',
  },
  // Floating Orb — Stitch
  floatingOrb: {
    position: 'absolute',
    bottom: 88,
    right: Spacing.md,
    width: 64,
    height: 64,
    borderRadius: 32,
    // Stitch: gradient from secondary to secondary-container
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 60,
  },
  floatingOrbIcon: { fontSize: 28, color: '#fff' },
  floatingOrbTooltip: {
    position: 'absolute',
    top: -36,
    right: 0,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingOrbTooltipText: {
    fontSize: FontSize.labelSm,
    color: Colors.onSecondaryContainer,
    fontWeight: '600',
    whiteSpace: 'nowrap',
  } as any,
  emptyBriefingContainer: {
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyBriefingIcon: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  emptyBriefingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyBriefingDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
