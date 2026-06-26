import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
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
  approval: '✅',
};

export default function FinanceScreen() {
  const navigation = useNavigation<NavProp>();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthSnapshot, setHealthSnapshot] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Concurrently fetch timeline and upcoming obligations
      const [snapshotRes, timelineRes, obligationsRes] = await Promise.all([
        isRefresh ? generateFinancialHealthSnapshot(user.id) : getLatestSnapshot(user.id),
        getFinancialTimeline(user.id),
        getUpcomingObligations(user.id),
      ]);

      setHealthSnapshot(snapshotRes);
      setTimeline(timelineRes);
      setObligations(obligationsRes);

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
        <View style={styles.healthCard}>
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
        </View>

        {/* SECTION 2: Financial Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Financial Timeline</Text>

          {/* Upcoming Obligations */}
          {obligations && obligations.length > 0 && (
            <View style={styles.obligationsContainer}>
              <Text style={styles.obligationsHeader}>UPCOMING OBLIGATIONS</Text>
              {obligations.map((ob) => (
                <View key={ob.id} style={styles.obligationCard}>
                  <View style={styles.obligationLeft}>
                    <Text style={styles.obligationCategory}>{CATEGORY_ICONS[ob.category] || '⚠️'} {ob.category ? ob.category.toUpperCase() : 'BILL'}</Text>
                    <Text style={styles.obligationTitle} numberOfLines={1}>{ob.subject || 'Upcoming Payment'}</Text>
                    <Text style={styles.obligationDate}>Due: {formatDate(ob.due_date)}</Text>
                  </View>
                  {ob.amount && (
                    <Text style={styles.obligationAmount}>{formatAmount(ob.amount)}</Text>
                  )}
                </View>
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
                    <TouchableOpacity
                      key={event.id}
                      style={styles.eventCard}
                      activeOpacity={0.7}
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
                    </TouchableOpacity>
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loaderText: {
    color: Colors.onSurfaceVariant,
    fontSize: FontSize.bodyMd,
  },
  header: {
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: FontSize.headlineMobile,
    fontWeight: '800',
    color: Colors.onSurface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  // Section 1: Health Card
  healthCard: {
    backgroundColor: Colors.primaryContainer,
    marginHorizontal: Spacing.containerMobile,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  healthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '800',
  },
  scoreLabelContainer: {
    justifyContent: 'center',
  },
  healthLabel: {
    fontSize: FontSize.labelSm,
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  refreshBtn: {
    backgroundColor: Colors.onPrimaryContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  refreshBtnText: {
    color: Colors.primaryContainer,
    fontSize: 12,
    fontWeight: '700',
  },
  healthSummary: {
    fontSize: FontSize.bodyMd,
    color: Colors.onPrimaryFixed,
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  recommendationsContainer: {
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingTop: Spacing.md,
    gap: Spacing.xs,
  },
  recommendationsLabel: {
    fontSize: FontSize.labelSm,
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  recommendationChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  recommendationChipText: {
    fontSize: 13,
    color: Colors.primaryFixedDim,
    lineHeight: 18,
  },
  
  // Section 2: Timeline
  timelineSection: {
    paddingHorizontal: Spacing.containerMobile,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.onSurface,
    marginBottom: Spacing.md,
  },
  obligationsContainer: {
    marginBottom: Spacing.lg,
  },
  obligationsHeader: {
    fontSize: FontSize.labelSm,
    fontWeight: '700',
    color: Colors.error,
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  obligationCard: {
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  obligationLeft: {
    flex: 1,
    gap: 2,
    paddingRight: Spacing.sm,
  },
  obligationCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onErrorContainer,
  },
  obligationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.onErrorContainer,
  },
  obligationDate: {
    fontSize: 13,
    color: Colors.onErrorContainer,
    opacity: 0.8,
  },
  obligationAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.onErrorContainer,
  },
  monthGroup: {
    marginBottom: Spacing.lg,
  },
  monthHeader: {
    marginBottom: Spacing.sm,
  },
  monthHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  eventCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  eventIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  eventIcon: {
    fontSize: 18,
  },
  eventMeta: {
    flex: 1,
  },
  entityName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  eventDate: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  eventAmountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  eventBody: {
    gap: 4,
  },
  badgeCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 0.5,
  },
  aiSummary: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.onSurfaceVariant,
    fontSize: 15,
  },
});
