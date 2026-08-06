/**
 * RelationshipsScreen — Meenakshi AI
 * ====================================
 * Professional "Circles" layout:
 *  - Header: CIRCLES eyebrow + "Your Network" + stat chips
 *  - Pending Follow-ups: timeline-style urgency-coded cards
 *  - Key Contacts: 3-column avatar grid
 *  - Scan Card CTA at bottom
 */

import { useAppTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius } from '../constants/theme';
import GlassCard from '../components/GlassCard';
import { getAllContacts } from '../services/relationshipService';
import { getFollowUps, markFollowUpDone } from '../services/followUpService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const AVATAR_COLORS = ['#8455ef', '#0c9488', '#ea580c', '#2563eb', '#db2777', '#0891b2', '#7c3aed'];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function daysUntilDue(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const due = new Date(dateStr);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function FollowUpUrgencyPill({ daysLeft }: { daysLeft: number | null }) {
  const { colors: Colors } = useAppTheme();
  if (daysLeft === null) return null;
  const isOverdue = daysLeft < 0;
  const isToday = daysLeft === 0;
  const isSoon = daysLeft <= 3;

  const bg = isOverdue || isToday ? 'rgba(186,26,26,0.10)'
    : isSoon ? 'rgba(217,119,6,0.10)'
    : 'rgba(107,56,212,0.08)';
  const color = isOverdue || isToday ? '#ba1a1a'
    : isSoon ? '#d97706'
    : Colors.secondary;
  const label = isOverdue ? `${Math.abs(daysLeft)}d overdue`
    : isToday ? 'Due today'
    : `${daysLeft}d left`;

  return (
    <View style={{ backgroundColor: bg, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color, letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

export default function RelationshipsScreen() {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);
  const navigation = useNavigation<NavProp>();
  const isFocused = useIsFocused();

  const [contacts, setContacts] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [contactsData, followUpsData] = await Promise.all([
        getAllContacts(),
        getFollowUps(),
      ]);
      setContacts(contactsData || []);
      setFollowUps((followUpsData || []).filter((f: any) => f.status === 'pending'));
    } catch (err) {
      console.error('[RelationshipsScreen] Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, loadData]);

  const handleMarkDone = async (id: string) => {
    try {
      await markFollowUpDone(id);
      setFollowUps(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error('Failed to mark done', err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Background ornament */}
      <View style={styles.ornament} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CIRCLES</Text>
          <Text style={styles.screenTitle}>Your Network</Text>
        </View>
        <View style={styles.statChips}>
          <View style={styles.statChip}>
            <Text style={styles.statChipNum}>{contacts.length}</Text>
            <Text style={styles.statChipLabel}>Contacts</Text>
          </View>
          {followUps.length > 0 && (
            <View style={[styles.statChip, { backgroundColor: 'rgba(186,26,26,0.08)' }]}>
              <Text style={[styles.statChipNum, { color: '#ba1a1a' }]}>{followUps.length}</Text>
              <Text style={[styles.statChipLabel, { color: '#ba1a1a' }]}>Follow-ups</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.secondary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── Pending Follow-ups ── */}
            {followUps.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>PENDING FOLLOW-UPS</Text>
                {followUps.map(f => {
                  const days = daysUntilDue(f.due_date);
                  const isUrgent = days !== null && days <= 0;
                  return (
                    <GlassCard
                      key={f.id}
                      style={[
                        styles.followUpCard,
                        isUrgent && { borderLeftWidth: 3, borderLeftColor: '#ba1a1a' },
                      ]}
                    >
                      <View style={styles.followUpTop}>
                        <View style={styles.followUpMeta}>
                          <Text style={styles.followUpName}>
                            {f.contacts?.name || 'General Task'}
                          </Text>
                          <Text style={styles.followUpDesc} numberOfLines={2}>
                            {f.description}
                          </Text>
                        </View>
                        <View style={styles.followUpRight}>
                          <FollowUpUrgencyPill daysLeft={days} />
                          <Text style={styles.followUpDate}>{formatDueDate(f.due_date)}</Text>
                        </View>
                      </View>
                      <View style={styles.followUpActions}>
                        {f.contact_id && (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => navigation.navigate('ContactProfile', { contactId: f.contact_id })}
                          >
                            <Text style={styles.actionBtnText}>View Profile</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionBtnDone]}
                          onPress={() => handleMarkDone(f.id)}
                        >
                          <Text style={[styles.actionBtnText, { color: '#0c9488' }]}>✓ Done</Text>
                        </TouchableOpacity>
                      </View>
                    </GlassCard>
                  );
                })}
              </View>
            )}

            {/* ── Key Contacts Grid ── */}
            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>KEY CONTACTS</Text>
              {contacts.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>🤝</Text>
                  <Text style={styles.emptyTitle}>No contacts yet</Text>
                  <Text style={styles.emptyDesc}>
                    Scan a business card to start building your network.
                  </Text>
                </GlassCard>
              ) : (
                <View style={styles.contactsGrid}>
                  {contacts.map(contact => {
                    const color = getAvatarColor(contact.id);
                    const initials = getInitials(contact.name);
                    return (
                      <TouchableOpacity
                        key={contact.id}
                        style={styles.contactGridItem}
                        onPress={() => navigation.navigate('ContactProfile', { contactId: contact.id })}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.contactAvatar, { backgroundColor: color }]}>
                          <Text style={styles.contactAvatarText}>{initials}</Text>
                        </View>
                        <Text style={styles.contactGridName} numberOfLines={1}>
                          {contact.name.split(' ')[0]}
                        </Text>
                        <Text style={styles.contactGridOrg} numberOfLines={1}>
                          {contact.organization || contact.designation || ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ── Ask Meenakshi ── */}
            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>INTELLIGENCE</Text>
              {[
                'Who should I follow up with today?',
                'Who reached out to me recently?',
                'Find contacts at HDFC',
              ].map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.intelligenceRow}
                  onPress={() => (navigation as any).navigate('Chat', { initialQuery: q })}
                  activeOpacity={0.75}
                >
                  <Text style={styles.intelligenceText}>{q}</Text>
                  <Text style={styles.intelligenceArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Scan Card CTA ── */}
            <TouchableOpacity
              style={styles.scanCta}
              onPress={() => navigation.navigate('BusinessCard')}
              activeOpacity={0.85}
            >
              <View style={styles.scanCtaIconWrap}>
                <Text style={styles.scanCtaIcon}>📸</Text>
              </View>
              <View style={styles.scanCtaBody}>
                <Text style={styles.scanCtaTitle}>Scan a Business Card</Text>
                <Text style={styles.scanCtaDesc}>
                  Meenakshi will extract and save contact details instantly
                </Text>
              </View>
              <Text style={styles.scanCtaArrow}>›</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  ornament: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.secondary,
    opacity: 0.05 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: Colors.secondary,
    marginBottom: 4 },
  screenTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.onSurface,
    letterSpacing: -0.8 },
  statChips: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  statChip: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 56 },
  statChipNum: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.secondary,
    textAlign: 'center' },
  statChipLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.5,
    marginTop: 1 },

  scrollContent: {
    paddingHorizontal: Spacing.containerMobile,
    paddingBottom: 110,
    paddingTop: Spacing.sm,
    gap: Spacing.xl },

  // Section
  section: { gap: Spacing.sm },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.onSurfaceVariant,
    letterSpacing: 2,
    marginBottom: 4 },

  // Follow-up cards
  followUpCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
    overflow: 'hidden' },
  followUpTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm },
  followUpMeta: { flex: 1, gap: 3 },
  followUpName: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: Colors.onSurface },
  followUpDesc: {
    ...typography.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 18 },
  followUpRight: { alignItems: 'flex-end', gap: 4 },
  followUpDate: {
    ...typography.labelSm,
    color: Colors.onSurfaceVariant },
  followUpActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4 },
  actionBtn: {
    flex: 1,
    backgroundColor: 'rgba(107,56,212,0.07)',
    borderRadius: Radius.md,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107,56,212,0.12)' },
  actionBtnDone: {
    backgroundColor: 'rgba(12,148,136,0.07)',
    borderColor: 'rgba(12,148,136,0.15)' },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.secondary },

  // Contacts grid (3 col)
  contactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm },
  contactGridItem: {
    width: '30%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: 4 },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center' },
  contactAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff' },
  contactGridName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurface,
    textAlign: 'center' },
  contactGridOrg: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    textAlign: 'center' },

  // Intelligence rows
  intelligenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant },
  intelligenceText: {
    ...typography.bodyMd,
    color: Colors.onSurface,
    flex: 1 },
  intelligenceArrow: {
    fontSize: 18,
    color: Colors.secondary,
    opacity: 0.7 },

  // Empty state
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm },
  emptyIcon: { fontSize: 36 },
  emptyTitle: {
    ...typography.bodyLg,
    fontWeight: '700',
    color: Colors.onSurface },
  emptyDesc: {
    ...typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20 },

  // Scan CTA
  scanCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6 },
  scanCtaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center' },
  scanCtaIcon: { fontSize: 20 },
  scanCtaBody: { flex: 1, gap: 2 },
  scanCtaTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff' },
  scanCtaDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 16 },
  scanCtaArrow: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '300' },
});
