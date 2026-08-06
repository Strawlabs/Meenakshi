import { useAppTheme } from '../context/ThemeContext';
import React, { useRef, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Handle foreground notifications (displays the banner even when the app is open)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
  Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius, FontSize} from '../constants/theme';
import GlassCard from '../components/GlassCard';
import StitchIcon from '../components/StitchIcon';
import { SUGGESTED_PROMPTS } from '../constants/index';
import supabase from '../lib/supabase';
import {
  getLatestBriefing,
  getUnreadNotifications,
  markNotificationRead,
  updateNotificationPreferences,
  type AiBriefing,
  type Notification } from '../services/notificationService';
import { getUserDisplayName, getUserAvatarInitial } from '../services/profileService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function HomeScreen() {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const navigation = useNavigation<NavProp>();
  const [briefing, setBriefing] = useState<AiBriefing | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [avatarInitial, setAvatarInitial] = useState('M');

  const loadData = useCallback(async () => {
    setLoadingNotifs(true);
    setLoadingBriefing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load briefing, notifications, and profile in parallel
      const [latestBriefing, unreadNotifs, name, initial] = await Promise.all([
        getLatestBriefing(user.id, 'daily'),
        getUnreadNotifications(user.id),
        getUserDisplayName(),
        getUserAvatarInitial(),
      ]);

      setBriefing(latestBriefing);
      setNotifications(unreadNotifs);
      console.log(`[HomeScreen] Loaded ${unreadNotifs.length} notification(s)`);
      setDisplayName(name);
      setAvatarInitial(initial);

      // Register push token (no-op on simulator; works on physical device)
      try {
        if (Constants.appOwnership === 'expo') {
          console.log('[HomeScreen] Running in Expo Go, skipping push registration');
        } else {
          const { status } = await Notifications.requestPermissionsAsync();

        if (status === 'granted') {
          console.log('[HomeScreen] Push permissions granted, fetching token...');
          try {
            const tokenData = await Notifications.getExpoPushTokenAsync({
              projectId: '74a58440-dc36-44fb-8656-fafe48f61b45', // Hardcoded to override native build cache
            });
            console.log('[HomeScreen] Push Token acquired:', tokenData.data);
            if (tokenData?.data) {
              await updateNotificationPreferences(user.id, { push_token: tokenData.data });
              console.log('[HomeScreen] Push Token saved to Supabase successfully!');
            }
          } catch (tokenErr) {
            console.error('[HomeScreen] Failed to get Expo push token:', tokenErr);
          }
        } else {
          console.log('[HomeScreen] Push permissions denied, status:', status);
        }
        } // Close else block
      } catch (pushErr) {
        console.error('[HomeScreen] Push notification setup error:', pushErr);
      }
    } catch (err) {
      console.error('[HomeScreen] loadData error:', err);
    } finally {
      setLoadingBriefing(false);
      setLoadingNotifs(false);
    }
  }, []);

  // Re-fetch every time the tab comes into focus so state stays fresh
  // after hot reload, navigation, or first-time prefs row creation.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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
            <Text style={styles.avatarChipText}>{avatarInitial}</Text>
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
        {/* Hero — website-style editorial */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>PERSONAL INTELLIGENCE</Text>
          <Text style={styles.heroGreeting}>
            {getGreeting()}{displayName ? `,\n${displayName}.` : '.'}
          </Text>
          <Text style={styles.heroSub}>I've prepared today's briefing for you.</Text>
        </View>

        {/* ── AI Daily Briefing Card ─────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>CONVERSATIONAL</Text>
          <Text style={styles.sectionTitle}>Today's Briefing</Text>
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

        {/* Suggested Inquiries */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>SUGGESTED INQUIRIES</Text>
          <Text style={styles.sectionTitle}>Intelligence that speaks your language</Text>
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

        {/* Quick Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>TOOLS</Text>
          <View style={styles.toolsGrid}>
            <GlassCard style={styles.toolCard} onPress={() => navigation.navigate('BusinessCard' as any)}>
              <View style={styles.toolIconWrap}>
                <StitchIcon name="contactless" size={20} color={Colors.secondary} />
              </View>
              <Text style={styles.toolLabel}>Scan Card</Text>
            </GlassCard>
            <GlassCard style={styles.toolCard} onPress={() => navigation.navigate('Documents' as any)}>
              <View style={styles.toolIconWrap}>
                <StitchIcon name="upload-file" size={20} color={Colors.secondary} />
              </View>
              <Text style={styles.toolLabel}>Upload Document</Text>
            </GlassCard>
          </View>
        </View>

        {/* Visual signature banner */}
        <View style={styles.bannerCard}>
          <Image 
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAdWyLsMRD8q_2VJBDj4nLfLwTEql4Jiakd7G_kRk7yNa-CaYJKxJFo6ItvpnCd0RgNbSetJ1MFNPay3VRdvzMit5-Lo66z-NbtPNIyYXtd_Z0Y6qFDWyfmOvZprlUWrwNlDCu_kIKGCx-fH7I1ZnREJZdYMLmqbdXyCj0LGr2fljq5aoY9KQsCrSrEChrhWTxK1lXrDO8eK0phBd7PH6iCGy1hgk_4zELls3V19UyeVKmmtBr_bgN4stIgi1rfBoy2ttRoU6Y_0xE' }} 
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <View style={styles.bannerGradient} />
          <Text style={styles.bannerText}>
            Intelligence is invisible, yet ever-present.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background },
  // Stitch ambient ornaments
  ornamentTopRight: {
    position: 'absolute',
    top: -96,
    right: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: Colors.secondary,
    opacity: 0.06 },
  ornamentMidLeft: {
    position: 'absolute',
    top: '45%',
    left: -128,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.primaryFixedDim,
    opacity: 0.10 },
  // Top App Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMobile,
    height: 64,
    backgroundColor: `${Colors.surface}B3`,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)' },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm },
  avatarChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center' },
  avatarChipText: {
    ...typography.labelSm,
    color: Colors.onSecondaryContainer },
  brandName: {
    ...typography.headlineLgMobile,
    letterSpacing: -0.3,
    color: Colors.primary },
  searchBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center' },
  searchBtnIcon: { fontSize: 18 },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.lg },
  // Hero — website editorial
  hero: { gap: 4, paddingBottom: 4 },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: Colors.secondary,
    marginBottom: 6 },
  heroGreeting: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.onSurface,
    letterSpacing: -1.2,
    lineHeight: 48 },
  heroSub: {
    ...typography.bodyLg,
    color: Colors.onSurfaceVariant,
    opacity: 0.8,
    marginTop: 6 },
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
    elevation: 3 },
  anomalyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md },
  anomalyIconText: {
    fontSize: 20 },
  anomalyTextWrap: {
    flex: 1 },
  anomalyTitle: {
    fontSize: FontSize.bodyMd,
    fontWeight: '700',
    color: Colors.onErrorContainer,
    marginBottom: 4 },
  anomalySub: {
    ...typography.labelSm,
    color: Colors.onErrorContainer,
    opacity: 0.8 },
  // Section — website editorial labels
  section: { gap: Spacing.sm },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 2.5,
    textTransform: 'uppercase' },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.onSurface,
    letterSpacing: -0.4,
    marginBottom: 2 },
  sectionLabel: {
    ...typography.labelSm,
    color: Colors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs },
  // ── AI Briefing Card ───────────────────────────────────
  briefingCardInner: {
    padding: Spacing.lg,
    gap: Spacing.md },
  briefingHeadline: {
    ...typography.headlineSm,
    color: Colors.onSurface,
    lineHeight: 28,
    letterSpacing: -0.2 },
  briefingSection: {
    gap: 6 },
  briefingSectionTitle: {
    ...typography.labelSm,
    color: Colors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase' },
  briefingItemRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start' },
  briefingItemBullet: {
    ...typography.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 20 },
  briefingItemText: {
    ...typography.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    flex: 1 },
  // ── Notification rows ──────────────────────────────────
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0 },
  notifContent: {
    flex: 1,
    gap: 2 },
  notifTitle: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: Colors.onSurface },
  notifBody: {
    ...typography.bodySm,
    color: Colors.onSurfaceVariant },
  notifArrow: {
    fontSize: 20,
    color: Colors.outline,
    fontWeight: '300' },
  // ── Shared brief action button ─────────────────────────
  briefBtnPrimary: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginTop: Spacing.xs },
  briefBtnPrimaryText: {
    ...typography.labelSm,
    color: Colors.onSecondary,
    letterSpacing: 0.3 },
  // Prompt
  promptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md },
  promptText: {
    ...typography.bodyMd,
    color: Colors.onSurface,
    flex: 1 },
  promptArrow: {
    fontSize: 18,
    color: Colors.secondary,
    opacity: 0.6 },
  // Tools
  toolsGrid: {
    flexDirection: 'row',
    gap: Spacing.md },
  toolCard: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm },
  toolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center' },
  toolIconText: { fontSize: 18 },
  toolLabel: {
    ...typography.labelSm,
    color: Colors.onSurface,
    letterSpacing: 0.3 },
  // Banner
  bannerCard: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 140,
    backgroundColor: Colors.primaryContainer,
    position: 'relative',
    justifyContent: 'flex-end' },
  bannerGradient: {
    position: 'absolute',
    inset: 0,
    backgroundColor: `${Colors.primaryContainer}66` },
  bannerText: {
    color: 'rgba(255,255,255,0.75)',
    ...typography.bodyMd,
    padding: Spacing.md,
    fontStyle: 'italic' },
  emptyBriefingContainer: {
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm },
  emptyBriefingIcon: {
    fontSize: 32,
    marginBottom: Spacing.xs },
  emptyBriefingTitle: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: Colors.onSurface,
    textAlign: 'center' },
  emptyBriefingDesc: {
    ...typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20 } });
