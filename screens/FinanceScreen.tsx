/**
 * FinanceScreen — Meenakshi AI
 * ==============================
 * Stitch "Financial Workspace" layout:
 *   1. Header: "INTELLIGENCE HUB" eyebrow
 *   2. Hero card: narrative health tier + AI summary + Perspective callout + stat pills
 *   3. Upcoming: next obligations with due-date status pills
 *   4. Recent Events: filtered financial timeline cards with "Ask Meenakshi" CTA
 *   5. Credit Intelligence: active loans, utilisation, hard inquiries (card-based)
 */

import { useAppTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius } from '../constants/theme';
import GlassCard from '../components/GlassCard';
import supabase from '../lib/supabase';

import { getLatestSnapshot, generateFinancialHealthSnapshot } from '../services/financialHealthService';
import { getFinancialEvents, getUpcomingObligations } from '../services/financialTimelineService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatAmount = (amount?: string | number | null): string => {
  if (amount == null || amount === '') return '';
  const num = Number(amount);
  if (isNaN(num)) return String(amount);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Parse raw bank narration strings into a clean counterparty name.
 * Handles formats like:
 *   OTHERS/DE/619741583593/Siya Balay/CZTX/34083417 → "Siya Balay"
 *   UPI/CR/123456/PhonePe/YESB/... → "PhonePe"
 *   NEFT-HDFCBANK-INWARD-REF/Name → "Name"
 */
function parseNarration(narration: string | null | undefined): string {
  if (!narration) return '';
  const parts = narration.split('/');
  // Format: TYPE/DE|CR/<refnum>/<Name>/<...>
  if (parts.length >= 4) {
    const candidate = parts[3].trim();
    // Skip if it looks like a ref number or bank code (all caps 4 chars, or all digits)
    if (candidate && !/^\d+$/.test(candidate) && !(candidate.length <= 4 && candidate === candidate.toUpperCase())) {
      return candidate;
    }
  }
  // Fallback: last meaningful segment
  const last = parts[parts.length - 1]?.trim();
  if (last && !/^\d+$/.test(last)) return last;
  // If no meaningful parse, truncate to 40 chars
  return narration.slice(0, 40);
}



function relativeDate(dateString: string): string {
  if (!dateString) return '';
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function daysUntil(dateString: string): number {
  const now = new Date();
  const then = new Date(dateString);
  return Math.ceil((then.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDueDate(dateString: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Map numeric health score → tier word + colour */
function getHealthTier(score: number): { word: string; color: string; bgColor: string } {
  if (score >= 75) return { word: 'vibrant',  color: '#0c9488', bgColor: 'rgba(12,148,136,0.12)' };
  if (score >= 50) return { word: 'stable',   color: '#6b38d4', bgColor: 'rgba(107,56,212,0.10)' };
  if (score >= 30) return { word: 'strained', color: '#d97706', bgColor: 'rgba(217,119,6,0.12)' };
  return              { word: 'critical',  color: '#ba1a1a', bgColor: 'rgba(186,26,26,0.12)' };
}

/** Obligation due-date status pill text + colour */
function getObligationStatus(ob: any): { label: string; color: string; bg: string } {
  if (ob.status === 'paid') return { label: 'AUTO-PAY READY', color: '#0c9488', bg: 'rgba(12,148,136,0.10)' };
  const days = ob.due_date ? daysUntil(ob.due_date) : 999;
  if (days <= 7) return { label: 'DUE SOON', color: '#d97706', bg: 'rgba(217,119,6,0.12)' };
  return { label: 'UPCOMING', color: '#6b38d4', bg: 'rgba(107,56,212,0.10)' };
}

const CATEGORY_ICONS: Record<string, string> = {
  salary: '💰', emi: '🏠', credit_card: '💳', insurance: '🛡️',
  tax: '🏛️', investment: '📈', loan: '🏦', bill: '🧾',
  renewal: '🔄', notice: '⚠️', approval: '✅', bank_transaction: '🏦',
};

// ─── Compute liquidity + momentum from 30-day email_events ───────────────────

async function computeStatPills(userId: string) {
  const now = new Date();
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const day7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const day14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from('email_events')
    .select('amount, category, received_at')
    .eq('user_id', userId)
    .eq('is_duplicate', false)
    .gte('received_at', day30.toISOString());

  if (!data || data.length === 0) return { liquidity: null, momentum: null };

  const CREDIT_CATS = new Set(['salary', 'loan', 'approval']);
  const DEBIT_CATS  = new Set(['emi', 'credit_card', 'insurance', 'tax', 'investment', 'bill', 'renewal']);

  let liquidity = 0;
  let thisWeekCredit = 0;
  let prevWeekCredit = 0;

  for (const ev of data) {
    const amt = ev.amount ? Number(ev.amount) : 0;
    if (isNaN(amt) || amt === 0) continue;
    const evDate = new Date(ev.received_at);

    if (CREDIT_CATS.has(ev.category)) {
      liquidity += amt;
      if (evDate >= day7)  thisWeekCredit += amt;
      else if (evDate >= day14) prevWeekCredit += amt;
    } else if (DEBIT_CATS.has(ev.category)) {
      liquidity -= amt;
    }
  }

  // Momentum: only show when prev week has meaningful data
  const momentum =
    prevWeekCredit > 0
      ? ((thisWeekCredit - prevWeekCredit) / prevWeekCredit) * 100
      : null;

  return { liquidity: liquidity > 0 ? liquidity : null, momentum };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinanceScreen() {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);
  const navigation = useNavigation<NavProp>();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthSnapshot, setHealthSnapshot] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [creditReport, setCreditReport] = useState<any>(null);
  const [liquidity, setLiquidity] = useState<number | null>(null);
  const [momentum, setMomentum] = useState<number | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [snapshotRes, eventsRes, obligationsRes, creditReportRes, statPills] = await Promise.all([
        isRefresh
          ? generateFinancialHealthSnapshot(user.id)
          : getLatestSnapshot(user.id),
        getFinancialEvents('all'),
        getUpcomingObligations(user.id),
        supabase
          .from('credit_reports')
          .select('credit_score,extracted_data,status,uploaded_at')
          .eq('user_id', user.id)
          .eq('status', 'parsed')
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        computeStatPills(user.id),
      ]);

      setHealthSnapshot(snapshotRes);
      setRecentEvents(eventsRes.slice(0, 12));
      setObligations(Array.isArray(obligationsRes) ? obligationsRes.slice(0, 2) : []);
      setCreditReport(creditReportRes?.data || null);
      setLiquidity(statPills.liquidity);
      setMomentum(statPills.momentum);
    } catch (err) {
      console.error('[FinanceScreen] Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const askMeenakshi = (context: string) => {
    navigation.navigate('Chat', { initialQuery: context });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loaderText}>Analyzing your financial data…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const score = healthSnapshot?.health_score ?? 0;
  const tier = getHealthTier(score);
  const firstRecommendation = healthSnapshot?.recommendations?.[0] ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>INTELLIGENCE HUB</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          {refreshing
            ? <ActivityIndicator size="small" color={Colors.secondary} />
            : <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.secondary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. HERO CARD ── */}
        <GlassCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>FINANCIAL HEALTH</Text>
          <Text style={styles.heroHeadline}>
            Your financial health is{' '}
            <Text style={[styles.heroTierWord, { color: tier.color }]}>{tier.word}</Text>
            {' '}today.
          </Text>

          {healthSnapshot?.summary ? (
            <Text style={styles.heroSummary}>{healthSnapshot.summary}</Text>
          ) : null}

          {firstRecommendation ? (
            <View style={[styles.perspectiveBox, { borderColor: tier.color + '40', backgroundColor: tier.bgColor }]}>
              <Text style={[styles.perspectiveLabel, { color: tier.color }]}>Perspective:</Text>
              <Text style={styles.perspectiveText}> {firstRecommendation}</Text>
            </View>
          ) : null}

          {/* Stat pills row */}
          {(liquidity != null || momentum != null) && (
            <View style={styles.statPillRow}>
              {liquidity != null && (
                <View style={styles.statPill}>
                  <Text style={styles.statPillLabel}>AVAILABLE LIQUIDITY</Text>
                  <Text style={styles.statPillValue}>{formatAmount(liquidity)}</Text>
                </View>
              )}
              {momentum != null && (
                <View style={styles.statPill}>
                  <Text style={styles.statPillLabel}>WEEKLY MOMENTUM</Text>
                  <Text style={[
                    styles.statPillValue,
                    { color: momentum >= 0 ? '#0c9488' : Colors.error }
                  ]}>
                    {momentum >= 0 ? '+' : ''}{momentum.toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
          )}
        </GlassCard>

        {/* ── 2. UPCOMING ── */}
        {obligations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Upcoming</Text>
            </View>
            {obligations.map((ob: any) => {
              const pill = getObligationStatus(ob);
              return (
                <GlassCard key={ob.id} style={styles.obligationCard}>
                  <View style={styles.obIconWrap}>
                    <Text style={styles.obIcon}>{CATEGORY_ICONS[ob.category] || '📅'}</Text>
                  </View>
                  <View style={styles.obBody}>
                    <Text style={styles.obTitle} numberOfLines={1}>
                      {ob.subject || (ob.category ? ob.category.replace(/_/g, ' ') : 'Payment')}
                    </Text>
                    {ob.due_date && (
                      <Text style={styles.obMeta}>
                        Due {daysUntil(ob.due_date)} day{daysUntil(ob.due_date) !== 1 ? 's' : ''} · {formatDueDate(ob.due_date)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.obRight}>
                    {ob.amount && (
                      <Text style={styles.obAmount}>{formatAmount(ob.amount)}</Text>
                    )}
                    <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.statusPillText, { color: pill.color }]}>{pill.label}</Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}

        {/* ── 3. RECENT EVENTS ── */}
        {recentEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Events</Text>
            {recentEvents.map((ev: any) => {
              const isCredit = ev.type === 'credit';
              const categoryTag = (ev.category || 'update').replace(/_/g, ' ').toUpperCase();
              const rawNarration = ev.subtitle || ev.description || '';
              const entityName = ev.category === 'bank_transaction'
                ? parseNarration(rawNarration)
                : rawNarration;
              const chatPrompt = `Can you explain this ${ev.category} event from ${ev.subtitle}: ${ev.description}?`;

              return (
                <GlassCard key={ev.id} style={styles.eventCard}>
                  <View style={styles.eventTopRow}>
                    <View style={styles.eventCategoryBadge}>
                      <Text style={styles.eventCategoryText}>{categoryTag}</Text>
                    </View>
                    <Text style={styles.eventRelDate}>{ev.date || relativeDate(ev.rawDate)}</Text>
                  </View>

                  <View style={styles.eventMidRow}>
                    <View style={styles.eventIconWrap}>
                      <Text style={styles.eventIcon}>{ev.icon}</Text>
                    </View>
                    <View style={styles.eventTitleBlock}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                      {entityName ? (
                        <Text style={styles.eventSubtitle} numberOfLines={1}>{entityName}</Text>
                      ) : null}
                    </View>
                    {ev.amount ? (
                      <Text style={[styles.eventAmount, { color: isCredit ? '#0c9488' : Colors.onSurface }]}>
                        {ev.amount}
                      </Text>
                    ) : null}
                  </View>

                  {ev.description && ev.category !== 'bank_transaction' ? (
                    <Text style={styles.eventSummary} numberOfLines={2}>{ev.description}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={styles.askBtn}
                    onPress={() => askMeenakshi(chatPrompt)}
                  >
                    <Text style={styles.askBtnText}>✦ Ask Meenakshi</Text>
                  </TouchableOpacity>
                </GlassCard>
              );
            })}
          </View>
        )}

        {recentEvents.length === 0 && !loading && (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No financial events yet</Text>
            <Text style={styles.emptyDesc}>
              Connect Gmail in Integrations Hub to start tracking your finances automatically.
            </Text>
          </GlassCard>
        )}

        {/* ── 4. CREDIT INTELLIGENCE ── */}
        {creditReport && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credit Intelligence</Text>
            <GlassCard style={styles.creditCard}>
              <View style={styles.creditHeaderRow}>
                <Text style={styles.creditLabel}>CIBIL / Credit Score</Text>
                {creditReport.credit_score && (
                  <View style={[styles.scoreBadge, {
                    backgroundColor: creditReport.credit_score >= 750 ? 'rgba(12,148,136,0.12)'
                      : creditReport.credit_score >= 650 ? 'rgba(217,119,6,0.12)'
                      : 'rgba(186,26,26,0.12)',
                  }]}>
                    <Text style={[styles.scoreBadgeText, {
                      color: creditReport.credit_score >= 750 ? '#0c9488'
                        : creditReport.credit_score >= 650 ? '#d97706'
                        : Colors.error,
                    }]}>{creditReport.credit_score}</Text>
                  </View>
                )}
              </View>

              {creditReport.extracted_data?.active_loans?.length > 0 && (
                <View style={styles.creditSection}>
                  <Text style={styles.creditSectionLabel}>ACTIVE LOANS</Text>
                  {creditReport.extracted_data.active_loans.slice(0, 3).map((loan: any, i: number) => (
                    <View key={i} style={styles.creditRow}>
                      <Text style={styles.creditRowLabel}>🏦 {loan.type}</Text>
                      <View style={styles.creditRowRight}>
                        {loan.amount && (
                          <Text style={styles.creditRowAmount}>
                            ₹{Number(loan.amount).toLocaleString('en-IN')}
                          </Text>
                        )}
                        <Text style={[styles.creditRowStatus, {
                          color: loan.status?.toLowerCase().includes('late') || loan.status?.toLowerCase().includes('miss')
                            ? Colors.error : '#0c9488',
                        }]}>{loan.status || 'Active'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {creditReport.extracted_data?.credit_card_utilization && (
                <View style={styles.creditSection}>
                  <Text style={styles.creditSectionLabel}>CREDIT CARD UTILIZATION</Text>
                  <Text style={styles.creditValue}>{creditReport.extracted_data.credit_card_utilization}</Text>
                </View>
              )}

              {creditReport.extracted_data?.hard_inquiries?.length > 0 && (
                <View style={styles.creditSection}>
                  <Text style={styles.creditSectionLabel}>RECENT HARD INQUIRIES</Text>
                  {creditReport.extracted_data.hard_inquiries.slice(0, 3).map((inq: any, i: number) => (
                    <Text key={i} style={styles.creditMeta}>
                      • {inq.lender}{inq.date ? ` — ${inq.date}` : ''}
                    </Text>
                  ))}
                </View>
              )}

              {creditReport.extracted_data?.payment_history_flags?.length > 0 && (
                <View style={styles.creditSection}>
                  <Text style={styles.creditSectionLabel}>⚠️ PAYMENT FLAGS</Text>
                  {creditReport.extracted_data.payment_history_flags.map((flag: string, i: number) => (
                    <Text key={i} style={[styles.creditMeta, { color: '#d97706' }]}>• {flag}</Text>
                  ))}
                </View>
              )}
            </GlassCard>
          </View>
        )}

        {/* Bottom padding for tab bar */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loaderText: { ...typography.bodyMd, color: Colors.onSurfaceVariant },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.secondary,
  },
  refreshBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
    minWidth: 80,
    alignItems: 'center',
  },
  refreshBtnText: { ...typography.labelSm, color: Colors.secondary },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.containerMobile, paddingBottom: Spacing.xl },

  // ── Hero card ──
  heroCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
  },
  heroHeadline: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.onSurface,
    lineHeight: 34,
    marginBottom: Spacing.sm,
  },
  heroTierWord: { fontWeight: '900' },
  heroSummary: {
    ...typography.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  perspectiveBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  perspectiveLabel: { fontWeight: '700', fontSize: 13 },
  perspectiveText: { ...typography.bodySm, color: Colors.onSurface, flex: 1, lineHeight: 18 },
  statPillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  statPill: {
    flex: 1,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 3,
  },
  statPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.onSurfaceVariant,
  },
  statPillValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.onSurface,
  },

  // ── Section ──
  section: { marginBottom: Spacing.lg, gap: Spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.onSurface,
  },

  // ── Obligation card ──
  obligationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  obIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  obIcon: { fontSize: 18 },
  obBody: { flex: 1, gap: 2 },
  obTitle: { ...typography.bodyMd, fontWeight: '700', color: Colors.onSurface },
  obMeta: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  obRight: { alignItems: 'flex-end', gap: 4 },
  obAmount: { fontSize: 15, fontWeight: '800', color: Colors.onSurface },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  // ── Recent event card ──
  eventCard: { padding: Spacing.md, gap: Spacing.sm, marginBottom: 0 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventCategoryBadge: {
    backgroundColor: Colors.secondaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  eventCategoryText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 0.8,
  },
  eventRelDate: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  eventMidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eventIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventIcon: { fontSize: 16 },
  eventTitleBlock: { flex: 1 },
  eventTitle: { ...typography.bodyMd, fontWeight: '700', color: Colors.onSurface },
  eventSubtitle: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  eventAmount: { fontSize: 15, fontWeight: '800' },
  eventSummary: { ...typography.bodySm, color: Colors.onSurfaceVariant, lineHeight: 18 },
  askBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryFixed,
    gap: 4,
  },
  askBtnText: { fontSize: 12, fontWeight: '700', color: Colors.secondary },

  // ── Empty state ──
  emptyCard: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { ...typography.bodyLg, fontWeight: '700', color: Colors.onSurface },
  emptyDesc: { ...typography.bodySm, color: Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },

  // ── Credit Intelligence ──
  creditCard: { padding: Spacing.md },
  creditHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  creditLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.onSurfaceVariant,
  },
  scoreBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  scoreBadgeText: { fontSize: 20, fontWeight: '800' },
  creditSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant,
    gap: 3,
  },
  creditSectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  creditRowLabel: { ...typography.bodyMd, color: Colors.onSurface, flex: 1 },
  creditRowRight: { alignItems: 'flex-end' },
  creditRowAmount: { fontSize: 13, fontWeight: '600', color: Colors.onSurface },
  creditRowStatus: { fontSize: 11, fontWeight: '500' },
  creditValue: { ...typography.bodyMd, fontWeight: '600', color: Colors.onSurface },
  creditMeta: { fontSize: 13, color: Colors.onSurfaceVariant, paddingVertical: 1 },
});
