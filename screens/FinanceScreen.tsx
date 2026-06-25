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
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { getFinancialEvents, TimelineEvent } from '../services/financialTimelineService';
import { syncUserEmails } from '../services/gmailSyncService';
import { getConnectedAccount } from '../services/gmailAuthService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const EMERALD = '#50C878';
const FILTER_CATEGORIES = ['all', 'salary', 'emi', 'credit_card', 'insurance', 'bill', 'renewal'];

export default function FinanceScreen() {
  const navigation = useNavigation<NavProp>();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const loadData = useCallback(async (cat = selectedCategory) => {
    try {
      const account = await getConnectedAccount();
      setIsGmailConnected(!!account);
      const fetchedEvents = await getFinancialEvents(cat);
      setEvents(fetchedEvents);
    } catch (err) {
      console.error('[FinanceScreen] Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadData();
  }, []);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setLoading(true);
    loadData(category);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const account = await getConnectedAccount();
      if (account) {
        console.log('[FinanceScreen] Starting Gmail sync...');
        const result = await syncUserEmails();
        console.log(`[FinanceScreen] Sync complete. Fetched ${result.totalFetched}, Saved ${result.totalSaved}`);
        const fetchedEvents = await getFinancialEvents(selectedCategory);
        setEvents(fetchedEvents);
      } else {
        Alert.alert(
          'Gmail Not Connected',
          'Connect your Gmail account in Settings to synchronise and view your financial timeline.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to Settings', onPress: () => navigation.navigate('Settings' as any) }
          ]
        );
      }
    } catch (err: any) {
      console.error('[FinanceScreen] Sync failed:', err);
      Alert.alert('Sync Failed', err.message || 'An error occurred during synchronisation.');
    } finally {
      setRefreshing(false);
    }
  }, [selectedCategory, navigation]);

  // Group events by month for clean display
  const groupEventsByMonth = (eventsList: TimelineEvent[]) => {
    const groups: Record<string, TimelineEvent[]> = {};
    for (const event of eventsList) {
      const date = new Date(event.rawDate);
      const monthYear = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase();
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(event);
    }
    return groups;
  };

  const groupedEvents = groupEventsByMonth(events);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Banner Ornament */}
      <View style={styles.glow} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.screenLabel}>CHRONICLE</Text>
            <Text style={styles.screenTitle}>Your Financial Story</Text>
          </View>
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={onRefresh}
            disabled={refreshing}
            activeOpacity={0.8}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.syncBtnText}>🔄 Sync Gmail</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.screenSubtitle}>Every movement tells a chapter of your wealth.</Text>
      </View>

      {/* Filter Chips Scroll */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_CATEGORIES.map(cat => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => handleCategoryChange(cat)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {cat === 'all' ? 'ALL' : cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.purple} />
          <Text style={styles.loaderText}>Loading timeline...</Text>
        </View>
      ) : events.length === 0 ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.purple}
              colors={[Colors.purple]}
            />
          }
        >
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No Timeline Events Found</Text>
            <Text style={styles.emptyDesc}>
              {isGmailConnected
                ? "We couldn't find any financial notifications in your inbox matching this category. Pull down to refresh."
                : "Connect your Gmail account in Settings to automatically synchronise and map your salary credits, EMI due dates, card statements, and policy renewals."}
            </Text>
            {!isGmailConnected && (
              <TouchableOpacity
                style={styles.connectBtn}
                onPress={() => navigation.navigate('Settings' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.connectBtnText}>Connect Gmail</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.purple}
              colors={[Colors.purple]}
            />
          }
        >
          <View style={styles.timelineContainer}>
            {/* Vertical gradient line spine */}
            <LinearGradient
              colors={[Colors.purple, EMERALD, Colors.purple]}
              style={styles.spineLine}
            />

            {/* Render grouped events */}
            {Object.entries(groupedEvents).map(([monthYear, monthEvents]) => (
              <View key={monthYear} style={styles.monthSection}>
                {/* Month Group Header */}
                <View style={styles.anchorContainer}>
                  <View style={styles.anchorChip}>
                    <Text style={styles.anchorText}>{monthYear}</Text>
                  </View>
                </View>

                {/* Event Cards */}
                {monthEvents.map(event => {
                  const isCredit = event.type === 'credit';
                  return (
                    <View key={event.id} style={styles.eventRow}>
                      {/* Spine Dot Indicator */}
                      <View style={styles.spineDotOuter}>
                        <View
                          style={[
                            styles.spineDot,
                            { backgroundColor: isCredit ? EMERALD : Colors.purple },
                          ]}
                        />
                      </View>

                      {/* Event Card */}
                      <View
                        style={[
                          styles.eventCard,
                          isCredit ? styles.creditCardGlow : styles.defaultCardShadow,
                        ]}
                      >
                        <View style={styles.cardHeader}>
                          <View style={styles.iconAndTitle}>
                            <View
                              style={[
                                styles.iconBox,
                                {
                                  backgroundColor: isCredit
                                    ? 'rgba(80, 200, 120, 0.1)'
                                    : 'rgba(107, 56, 212, 0.05)',
                                },
                              ]}
                            >
                              <Text style={styles.iconText}>{event.icon}</Text>
                            </View>
                            <View style={styles.titleArea}>
                              <Text
                                style={[
                                  styles.eventTitle,
                                  isCredit && { color: EMERALD },
                                ]}
                                numberOfLines={1}
                              >
                                {event.title}
                              </Text>
                              <Text style={styles.eventMeta} numberOfLines={1}>
                                {event.subtitle}
                              </Text>
                            </View>
                          </View>
                          {event.amount ? (
                            <Text
                              style={[
                                styles.eventAmount,
                                { color: isCredit ? EMERALD : Colors.textPrimary },
                              ]}
                            >
                              {event.amount}
                            </Text>
                          ) : null}
                        </View>

                        <Text style={styles.eventDesc}>{event.description}</Text>

                        <TouchableOpacity
                          style={styles.askMeenakshiBtn}
                          onPress={() =>
                            navigation.navigate('Chat', {
                              initialQuery: `Tell me more about the ${event.category} event: ${event.title} from ${event.subtitle} ${event.amount ? `for ${event.amount}` : ''}`,
                            })
                          }
                          activeOpacity={0.75}
                        >
                          <Text style={styles.askMeenakshiText}>✦ Ask Meenakshi</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Narrative Pulse Summary Card */}
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>MONTHLY PULSE</Text>
            <Text style={styles.insightTitle}>Financial Intelligence Active</Text>
            <Text style={styles.insightBody}>
              Meenakshi is actively auditing your connected inbox. We are mapping salary cycles, identifying loan commitments, and keeping watch on upcoming deadlines.
            </Text>
            <View style={styles.insightActions}>
              <TouchableOpacity
                style={styles.insightChip}
                onPress={() =>
                  navigation.navigate('Chat', {
                    initialQuery: 'List my upcoming financial obligations',
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.insightChipText}>Upcoming Due Dates</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.insightChip}
                onPress={() =>
                  navigation.navigate('Chat', {
                    initialQuery: 'Show me my financial summaries',
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.insightChipText}>Analyze Spending</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.insightGlow} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  glow: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.purple,
    opacity: 0.03,
  },
  header: {
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncBtn: {
    backgroundColor: Colors.purple,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  screenLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.purple,
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: FontSize.headlineMobile,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  filterContainer: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterScroll: {
    paddingHorizontal: Spacing.containerMobile,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: Colors.purple,
    borderColor: Colors.purpleLight,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loaderText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.containerMobile,
    paddingBottom: 110,
    paddingTop: Spacing.md,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 110,
  },
  emptyContainer: {
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  connectBtn: {
    backgroundColor: Colors.purple,
    borderRadius: Radius.full,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: Spacing.md,
    shadowColor: Colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  timelineContainer: {
    position: 'relative',
    paddingLeft: 36,
  },
  spineLine: {
    position: 'absolute',
    left: 14,
    top: 24,
    bottom: 24,
    width: 2,
    opacity: 0.25,
    borderRadius: 1,
  },
  monthSection: {
    marginBottom: Spacing.lg,
  },
  anchorContainer: {
    marginLeft: -36,
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  anchorChip: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  anchorText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  eventRow: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  spineDotOuter: {
    position: 'absolute',
    left: -30,
    top: 22,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  spineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  eventCard: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  defaultCardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  creditCardGlow: {
    shadowColor: EMERALD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderColor: 'rgba(80, 200, 120, 0.3)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconAndTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  titleArea: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eventMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  eventAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  eventDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  askMeenakshiBtn: {
    backgroundColor: 'rgba(107, 56, 212, 0.05)',
    borderRadius: Radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 56, 212, 0.1)',
  },
  askMeenakshiText: {
    fontSize: 12,
    color: Colors.purple,
    fontWeight: '700',
  },
  insightCard: {
    backgroundColor: '#131b2e',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7c839b',
    letterSpacing: 1.5,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  insightBody: {
    fontSize: 13,
    color: '#bec6e0',
    lineHeight: 20,
  },
  insightActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  insightChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  insightChipText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  insightGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 120,
    height: 120,
    backgroundColor: Colors.purple,
    opacity: 0.2,
    borderRadius: 60,
  },
});
