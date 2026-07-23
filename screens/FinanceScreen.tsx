import { useAppTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius, FontSize} from '../constants/theme';
import GlassCard from '../components/GlassCard';
import supabase from '../lib/supabase';

// Services
import { getLatestSnapshot, generateFinancialHealthSnapshot } from '../services/financialHealthService';
import { getFinancialTimeline, getUpcomingObligations } from '../services/financialTimelineService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Helper for currency formatting
const formatAmount = (amount?: string | number) => {
  if (!amount) return '';
  const num = Number(amount);
  if (isNaN(num)) return amount.toString();
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper for date formatting
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const dateObj = new Date(dateString);
  return dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const CATEGORY_ICONS: Record<string, string> = {
  salary: '💰',
  emi: '🏠',
  credit_card: '💳',
  insurance: '🛡️',
  tax: '🏛️',
  investment: '📈',
  loan: '🏦',
  bill: '🧾',
  renewal: '🔄',
  notice: '⚠️',
  approval: '✅' };

export default function FinanceScreen() {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const navigation = useNavigation<NavProp>();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthSnapshot, setHealthSnapshot] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [creditReport, setCreditReport] = useState<any>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Concurrently fetch timeline, obligations, and latest credit report
      const [snapshotRes, timelineRes, obligationsRes, creditReportRes] = await Promise.all([
        isRefresh ? generateFinancialHealthSnapshot(user.id) : getLatestSnapshot(user.id),
        getFinancialTimeline(user.id),
        getUpcomingObligations(user.id),
        supabase.from('credit_reports').select('credit_score,extracted_data,status,uploaded_at').eq('user_id', user.id).eq('status', 'parsed').order('uploaded_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      setHealthSnapshot(snapshotRes);
      setTimeline(timelineRes);
      setObligations(obligationsRes);
      setCreditReport(creditReportRes?.data || null);

    } catch (error) {
      console.error('[FinanceScreen] Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const getHealthColor = (score: number) => {
    if (score >= 70) return Colors.tertiaryFixedDim; // Green
    if (score >= 40) return Colors.errorContainer; // Amber-ish (using errorContainer/amber from theme)
    return Colors.error; // Red
  };

  const getHealthTextColor = (score: number) => {
    if (score >= 70) return Colors.onTertiaryFixedVariant;
    if (score >= 40) return Colors.onErrorContainer;
    return Colors.onError;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loaderText}>Analyzing your financial data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const score = healthSnapshot?.health_score || 0;
  const scoreColor = getHealthColor(score);
  const scoreTextColor = getHealthTextColor(score);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Dashboard</Text>
      </View>
      
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* SECTION 1: Financial Health Card */}
        <GlassCard style={styles.healthCard}>
          <View style={styles.healthHeaderRow}>
            <View style={styles.scoreContainer}>
              <View style={[styles.scoreCircle, { backgroundColor: scoreColor }]}>
                <Text style={[styles.scoreText, { color: scoreTextColor }]}>{score}</Text>
              </View>
              <View style={styles.scoreLabelContainer}>
                <Text style={styles.healthLabel}>HEALTH SCORE</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
              <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.healthSummary}>
            {healthSnapshot?.summary || 'No summary available.'}
          </Text>

          {healthSnapshot?.recommendations && healthSnapshot.recommendations.length > 0 && (
            <View style={styles.recommendationsContainer}>
              <Text style={styles.recommendationsLabel}>RECOMMENDED ACTIONS</Text>
              {healthSnapshot.recommendations.slice(0, 3).map((rec: string, index: number) => (
                <View key={index} style={styles.recommendationChip}>
                  <Text style={styles.recommendationChipText}>• {rec}</Text>
                </View>
              ))}
            </View>
          )}
        </GlassCard>

        {/* SECTION 2: Credit Intelligence Card (shown when credit report is parsed) */}
        {creditReport && (
          <GlassCard style={styles.creditCard}>
            <View style={styles.creditHeader}>
              <Text style={styles.creditTitle}>📊 Credit Intelligence</Text>
              {creditReport.credit_score && (
                <View style={[styles.scoreBadge, {
                  backgroundColor: creditReport.credit_score >= 750 ? '#22c55e20' :
                    creditReport.credit_score >= 650 ? '#f59e0b20' : '#ef444420'
                }]}>
                  <Text style={[styles.scoreBadgeText, {
                    color: creditReport.credit_score >= 750 ? '#22c55e' :
                      creditReport.credit_score >= 650 ? '#f59e0b' : '#ef4444'
                  }]}>{creditReport.credit_score}</Text>
                  <Text style={styles.scoreBadgeLabel}>SCORE</Text>
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
                      {loan.amount && <Text style={styles.creditRowAmount}>₹{Number(loan.amount).toLocaleString('en-IN')}</Text>}
                      <Text style={[styles.creditRowStatus, {
                        color: loan.status?.toLowerCase().includes('late') || loan.status?.toLowerCase().includes('miss') ? '#ef4444' : '#22c55e'
                      }]}>{loan.status || 'Active'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {creditReport.extracted_data?.credit_card_utilization && (
              <View style={styles.creditSection}>
                <Text style={styles.creditSectionLabel}>CREDIT CARD UTILIZATION</Text>
                <Text style={styles.creditMetaValue}>{creditReport.extracted_data.credit_card_utilization}</Text>
              </View>
            )}

            {creditReport.extracted_data?.hard_inquiries?.length > 0 && (
              <View style={styles.creditSection}>
                <Text style={styles.creditSectionLabel}>RECENT HARD INQUIRIES</Text>
                {creditReport.extracted_data.hard_inquiries.slice(0, 3).map((inq: any, i: number) => (
                  <Text key={i} style={styles.creditMeta}>• {inq.lender} {inq.date ? `— ${inq.date}` : ''}</Text>
                ))}
              </View>
            )}

            {creditReport.extracted_data?.payment_history_flags?.length > 0 && (
              <View style={styles.creditSection}>
                <Text style={styles.creditSectionLabel}>⚠️ PAYMENT FLAGS</Text>
                {creditReport.extracted_data.payment_history_flags.map((flag: string, i: number) => (
                  <Text key={i} style={[styles.creditMeta, { color: '#f59e0b' }]}>• {flag}</Text>
                ))}
              </View>
            )}
          </GlassCard>
        )}

        {/* SECTION 3: Financial Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Financial Timeline</Text>

          {/* Upcoming Obligations */}
          {obligations && obligations.length > 0 && (
            <View style={styles.obligationsContainer}>
              <Text style={styles.obligationsHeader}>UPCOMING OBLIGATIONS</Text>
              {obligations.map((ob) => (
                <GlassCard key={ob.id} style={styles.obligationCard}>
                  <View style={styles.obligationLeft}>
                    <Text style={styles.obligationCategory}>{CATEGORY_ICONS[ob.category] || '⚠️'} {ob.category ? ob.category.toUpperCase() : 'BILL'}</Text>
                    <Text style={styles.obligationTitle} numberOfLines={1}>{ob.subject || 'Upcoming Payment'}</Text>
                    <Text style={styles.obligationDate}>Due: {formatDate(ob.due_date)}</Text>
                  </View>
                  {ob.amount && (
                    <Text style={styles.obligationAmount}>{formatAmount(ob.amount)}</Text>
                  )}
                </GlassCard>
              ))}
            </View>
          )}

          {/* Grouped Events */}
          {timeline && timeline.length > 0 ? (
            timeline.map((group) => (
              <View key={group.month} style={styles.monthGroup}>
                <View style={styles.monthHeader}>
                  <Text style={styles.monthHeaderText}>{group.month}</Text>
                </View>

                {group.events.map((event: any) => {
                  const icon = CATEGORY_ICONS[event.category] || '✉️';
                  const entityName = event.sender_name || 'Email Update';
                  const isCredit = event.category === 'salary' || event.category === 'loan' || event.category === 'approval';

                  return (
                    <GlassCard
                      key={event.id}
                      style={styles.eventCard}
                      onPress={() => {
                        navigation.navigate('Chat', {
                          initialQuery: `Can you explain the ${event.category} event "${event.subject}" from ${entityName} for ${formatAmount(event.amount)}?`
                        });
                      }}
                    >
                      <View style={styles.eventHeader}>
                        <View style={styles.eventIconContainer}>
                          <Text style={styles.eventIcon}>{icon}</Text>
                        </View>
                        <View style={styles.eventMeta}>
                          <Text style={styles.entityName} numberOfLines={1}>{entityName}</Text>
                          <Text style={styles.eventDate}>{formatDate(event.received_at)}</Text>
                        </View>
                        {event.amount && (
                          <Text style={[styles.eventAmountText, { color: isCredit ? Colors.tertiaryFixedDim : Colors.onSurface }]}>
                            {formatAmount(event.amount)}
                          </Text>
                        )}
                      </View>

                      <View style={styles.eventBody}>
                        <Text style={styles.badgeCategory}>
                          {event.category ? event.category.toUpperCase() : 'UPDATE'}
                        </Text>
                        <Text style={styles.aiSummary} numberOfLines={2}>
                          {event.ai_summary || event.subject}
                        </Text>
                      </View>
                    </GlassCard>
                  );
                })}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No timeline events found.</Text>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md },
  loaderText: {
    ...typography.bodyMd,
    color: Colors.onSurfaceVariant },
  header: {
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface },
  headerTitle: {
    ...typography.headlineLgMobile,
    color: Colors.onSurface },
  scroll: {
    flex: 1 },
  scrollContent: {
    paddingBottom: Spacing.xl },
  // Section 1: Health Card
  healthCard: {
    marginHorizontal: Spacing.containerMobile,
    padding: Spacing.lg,
    marginBottom: Spacing.lg },
  healthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center' },
  scoreText: {
    fontFamily: typography.displayLg.fontFamily,
    fontSize: 20,
    fontWeight: '800' },
  scoreLabelContainer: {
    justifyContent: 'center' },
  healthLabel: {
    ...typography.labelSm,
    color: Colors.onPrimaryContainer,
    letterSpacing: 0.5 },
  refreshBtn: {
    backgroundColor: Colors.onPrimaryContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full },
  refreshBtnText: {
    color: Colors.primaryContainer,
    fontSize: 12,
    fontWeight: '700' },
  healthSummary: {
    ...typography.bodyMd,
    color: Colors.onPrimaryFixed,
    marginBottom: Spacing.md },
  recommendationsContainer: {
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingTop: Spacing.md,
    gap: Spacing.xs },
  recommendationsLabel: {
    ...typography.labelSm,
    color: Colors.onPrimaryContainer,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5 },
  recommendationChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Radius.md,
    padding: Spacing.sm },
  recommendationChipText: {
    ...typography.bodySm,
    color: Colors.primaryFixedDim },
  
  // Credit Intelligence Card
  creditCard: {
    marginHorizontal: Spacing.containerMobile,
    marginBottom: Spacing.md,
    padding: Spacing.md },
  creditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm },
  creditTitle: {
    ...typography ? typography.titleMd : { fontSize: 16, fontWeight: '600' },
    color: Colors.onSurface },
  scoreBadge: {
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm },
  scoreBadgeText: {
    fontSize: 20,
    fontWeight: '800' },
  scoreBadgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.onSurfaceVariant },
  creditSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant },
  creditSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.onSurfaceVariant,
    marginBottom: 4 },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3 },
  creditRowLabel: {
    ...typography ? typography.bodyMd : { fontSize: 14 },
    color: Colors.onSurface,
    flex: 1 },
  creditRowRight: {
    alignItems: 'flex-end' },
  creditRowAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface },
  creditRowStatus: {
    fontSize: 11,
    fontWeight: '500' },
  creditMetaValue: {
    ...typography ? typography.bodyMd : { fontSize: 14 },
    color: Colors.onSurface,
    fontWeight: '600' },
  creditMeta: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    paddingVertical: 2 },

  // Section 3: Timeline
  timelineSection: {
    paddingHorizontal: Spacing.containerMobile },
  sectionTitle: {
    ...typography.headlineSm,
    color: Colors.onSurface,
    marginBottom: Spacing.md },
  obligationsContainer: {
    marginBottom: Spacing.lg },
  obligationsHeader: {
    ...typography.labelSm,
    color: Colors.error,
    marginBottom: Spacing.sm,
    letterSpacing: 0.5 },
  obligationCard: {
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm },
  obligationLeft: {
    flex: 1,
    gap: 2,
    paddingRight: Spacing.sm },
  obligationCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onErrorContainer },
  obligationTitle: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: Colors.error },
  obligationDate: {
    ...typography.bodySm,
    color: Colors.error,
    opacity: 0.8 },
  obligationAmount: {
    ...typography.headlineSm,
    color: Colors.error },
  monthGroup: {
    marginBottom: Spacing.lg },
  monthHeader: {
    marginBottom: Spacing.sm },
  monthHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onSurfaceVariant },
  eventCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2 },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm },
  eventIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm },
  eventIcon: {
    fontSize: 18 },
  eventMeta: {
    flex: 1 },
  entityName: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: Colors.onSurface },
  eventDate: {
    ...typography.bodySm,
    color: Colors.onSurfaceVariant },
  eventAmountText: {
    ...typography.headlineSm },
  eventBody: {
    gap: 4 },
  badgeCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 0.5 },
  aiSummary: {
    ...typography.bodySm,
    color: Colors.onSurfaceVariant },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center' },
  emptyText: {
    color: Colors.onSurfaceVariant,
    fontSize: 15 } });
