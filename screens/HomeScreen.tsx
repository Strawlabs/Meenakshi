import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { MOCK_BRIEFINGS, SUGGESTED_PROMPTS } from '../constants';
import supabase from '../lib/supabase';

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
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBriefings() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setBriefings([]);
          setLoading(false);
          return;
        }

        const { data: events, error } = await supabase
          .from('email_events')
          .select('id, category, subject, ai_summary, amount, due_date')
          .eq('user_id', user.id)
          .eq('is_duplicate', false)
          .order('received_at', { ascending: false })
          .limit(3);

        if (error || !events || events.length === 0) {
          setBriefings([]);
        } else {
          const mapped = events.map((event: any) => {
            const category = event.category || 'other';
            let title = 'Notification';
            let icon = '✉️';
            let actionText = 'Open';
            let type: 'alert' | 'email' = 'email';

            if (category === 'salary') {
              title = 'Salary Credited';
              icon = '💰';
              actionText = 'View Details';
              type = 'alert';
            } else if (category === 'emi') {
              title = 'EMI Reminder';
              icon = '🏠';
              actionText = 'Schedule Pay';
              type = 'alert';
            } else if (category === 'bill') {
              title = 'Credit Card Bill Due';
              icon = '💳';
              actionText = 'Pay Now';
              type = 'alert';
            } else if (category === 'renewal') {
              title = 'Insurance Renewal';
              icon = '🛡️';
              actionText = 'Renew Now';
              type = 'alert';
            } else if (category === 'notice') {
              title = 'Official Notice';
              icon = '⚠️';
              actionText = 'Review';
              type = 'alert';
            } else if (category === 'relationship') {
              title = 'Meeting Follow-up';
              icon = '👥';
              actionText = 'Reply';
            }

            return {
              id: event.id,
              title,
              description: event.ai_summary || event.subject,
              type,
              icon,
              actionText,
            };
          });
          setBriefings(mapped);
        }
      } catch (err) {
        console.error('[HomeScreen] Failed to load briefings:', err);
        setBriefings([]);
      } finally {
        setLoading(false);
      }
    }
    loadBriefings();
  }, []);

  const handlePrompt = (query: string, description?: string) => {
    const finalQuery = description
      ? `Tell me more about this briefing: "${description}"`
      : query;
    navigation.navigate('Chat', { initialQuery: finalQuery });
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

        {/* Daily AI Briefing Cards — Stitch narrative style */}
        <View style={styles.section}>
          {briefings.length === 0 ? (
            <GlassCard>
              <View style={styles.emptyBriefingContainer}>
                <Text style={styles.emptyBriefingIcon}>✨</Text>
                <Text style={styles.emptyBriefingTitle}>Your Briefing is Empty</Text>
                <Text style={styles.emptyBriefingDesc}>
                  Meenakshi hasn't detected any active financial notifications in your connected inbox yet. Go to the Chronicle tab and pull down to refresh to sync your Gmail!
                </Text>
              </View>
            </GlassCard>
          ) : (
            briefings.map(brief => (
              <GlassCard key={brief.id}>
                <View style={styles.briefRow}>
                  <View
                    style={[
                      styles.briefIconWrap,
                      brief.type === 'alert' ? styles.briefIconWrapAlert : styles.briefIconWrapInfo,
                    ]}
                  >
                    <Text style={styles.briefIconText}>
                      {brief.icon || (brief.type === 'alert' ? '🔔' : '✉️')}
                    </Text>
                  </View>
                  <View style={styles.briefContent}>
                    <Text style={styles.briefTitle}>{brief.title}</Text>
                    <Text style={styles.briefDesc}>{brief.description}</Text>
                  </View>
                </View>
                <View style={styles.briefActions}>
                  {brief.actionText && (
                    <TouchableOpacity
                      style={styles.briefBtnPrimary}
                      onPress={() => handlePrompt(brief.title, brief.description)}
                    >
                      <Text style={styles.briefBtnPrimaryText}>{brief.actionText}</Text>
                    </TouchableOpacity>
                  )}
                  {brief.secondaryText && (
                    <TouchableOpacity style={styles.briefBtnSecondary}>
                      <Text style={styles.briefBtnSecondaryText}>{brief.secondaryText}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </GlassCard>
            ))
          )}
        </View>

        {/* Suggested Inquiries — Stitch */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Suggested Inquiries</Text>
          {(SUGGESTED_PROMPTS || []).map((prompt, i) => (
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
            <GlassCard style={styles.toolCard}>
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
  // Brief card
  briefRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    padding: Spacing.lg,
  },
  briefIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  briefIconWrapAlert: { backgroundColor: Colors.errorContainer },
  briefIconWrapInfo: { backgroundColor: Colors.primaryFixed },
  briefIconText: { fontSize: 20 },
  briefContent: { flex: 1, gap: 4 },
  briefTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  briefDesc: {
    fontSize: FontSize.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 24,
  },
  briefActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  briefBtnPrimary: {
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  briefBtnPrimaryText: {
    fontSize: FontSize.labelSm,
    fontWeight: '700',
    color: Colors.onSecondary,
    letterSpacing: 0.3,
  },
  briefBtnSecondary: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  briefBtnSecondaryText: {
    fontSize: FontSize.labelSm,
    fontWeight: '600',
    color: Colors.onSurface,
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
