import { useAppTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius } from '../constants/theme';
import GlassCard from '../components/GlassCard';
import { getContactProfile, generateRelationshipSummary } from '../services/relationshipService';
import { parseManualFollowUp } from '../services/followUpService';
import supabase from '../lib/supabase';

type RouteType = RouteProp<RootStackParamList, 'ContactProfile'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ContactProfileScreen() {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { contactId } = route.params;

  const [profile, setProfile] = useState<any>(null);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState('');
  const [isAddingFollowUp, setIsAddingFollowUp] = useState(false);

  // Reload profile when focused (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [contactId])
  );

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await getContactProfile(contactId);
      setProfile(data);
    } catch (err) {
      console.error('Failed to load contact profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSummary = async () => {
    setLoadingSummary(true);
    try {
      const result = await generateRelationshipSummary(contactId);
      setSummary(result);
    } catch (err) {
      console.error('Failed to generate summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleEditContact = () => {
    if (!profile || !profile.contact) return;
    const { contact } = profile;
    navigation.navigate('BusinessCard', {
      editContactId: contact.id,
      editContactData: {
        name: contact.name,
        designation: contact.designation,
        organization: contact.organization,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        notes: contact.notes }
    });
  };

  const handleAddFollowUp = async () => {
    if (!newFollowUp.trim()) return;
    setIsAddingFollowUp(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Parse due date and description using Gemini in the background
        const parsed = await parseManualFollowUp(newFollowUp.trim());
        
        await supabase.from('follow_ups').insert({
          user_id: user.id,
          contact_id: contactId,
          description: parsed.description || newFollowUp.trim(),
          due_date: parsed.due_date,
          source: 'manual'
        });
        setNewFollowUp('');
        await loadProfile(); // Refresh the list
      }
    } catch (err) {
      console.error('Failed to add follow-up', err);
    } finally {
      setIsAddingFollowUp(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile || !profile.contact) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Contact not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { contact, followUps, emails } = profile;
  const initials = contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <GlassCard style={styles.card}>
          <View style={styles.avatarRow}>
            <TouchableOpacity style={styles.avatar} onPress={handleEditContact}>
              <Text style={styles.avatarText}>{initials}</Text>
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditBadgeText}>✎</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.info}>
              <Text style={styles.name}>{contact.name}</Text>
              <Text style={styles.role}>{contact.designation || 'Unknown Role'} at {contact.organization || 'Unknown Company'}</Text>
            </View>
          </View>
          <View style={styles.contactDetails}>
            {contact.email && <Text style={styles.detailText}>📧 {contact.email}</Text>}
            {contact.phone && <Text style={styles.detailText}>📱 {contact.phone}</Text>}
            {contact.address && <Text style={styles.detailText}>📍 {contact.address}</Text>}
          </View>
        </GlassCard>

        {/* How we met / Notes */}
        {contact.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HOW WE MET & RELATIONSHIP CONTEXT</Text>
            <GlassCard style={styles.notesCard}>
              <Text style={styles.notesText}>{contact.notes}</Text>
            </GlassCard>
          </View>
        ) : null}

        {/* AI Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI RELATIONSHIP SUMMARY</Text>
          {summary ? (
            <GlassCard style={styles.summaryCard}>
              <Text style={styles.summaryText}>{summary}</Text>
            </GlassCard>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={getSummary} disabled={loadingSummary}>
              {loadingSummary ? (
                <ActivityIndicator size="small" color={Colors.purple} />
              ) : (
                <Text style={styles.actionBtnText}>✦ Generate Summary</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Follow-ups */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PENDING FOLLOW-UPS</Text>
          <View style={styles.addFollowUpRow}>
            <TextInput
              style={styles.addFollowUpInput}
              placeholder="Add manual follow-up..."
              placeholderTextColor={Colors.textMuted}
              value={newFollowUp}
              onChangeText={setNewFollowUp}
            />
            <TouchableOpacity 
              style={[styles.addBtn, !newFollowUp.trim() && { opacity: 0.5 }]} 
              onPress={handleAddFollowUp}
              disabled={!newFollowUp.trim() || isAddingFollowUp}
            >
              {isAddingFollowUp ? <ActivityIndicator size="small" color={Colors.onPrimary} /> : <Text style={styles.addBtnText}>+</Text>}
            </TouchableOpacity>
          </View>
          
          {followUps.length === 0 ? (
            <Text style={styles.emptyText}>No pending tasks.</Text>
          ) : (
            followUps.map((f: any) => (
              <GlassCard key={f.id} style={styles.listItem}>
                <Text style={styles.listItemTitle}>{f.description}</Text>
                {f.due_date && <Text style={styles.listItemSub}>{new Date(f.due_date).toLocaleDateString()}</Text>}
              </GlassCard>
            ))
          )}
        </View>

        {/* Emails */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT INTERACTIONS</Text>
          {emails.length === 0 ? (
            <Text style={styles.emptyText}>No emails linked yet.</Text>
          ) : (
            emails.map((e: any) => (
              <GlassCard key={e.id} style={styles.listItem}>
                <Text style={styles.listItemTitle}>{e.subject}</Text>
                <Text style={styles.listItemSub}>{new Date(e.received_at).toLocaleDateString()} • {e.category}</Text>
              </GlassCard>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  errorText: { ...typography.bodyMd, color: Colors.textSecondary, marginBottom: Spacing.md },
  backBtn: { backgroundColor: Colors.surfaceContainerHigh, padding: Spacing.sm, borderRadius: Radius.md },
  backBtnText: { color: Colors.onSurface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.sm },
  headerBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { ...typography.headlineMdMobile, fontSize: 32, color: Colors.onSurface, fontWeight: '300' },
  headerTitle: { ...typography.bodyMd, fontWeight: '700', color: Colors.onSurface },
  content: { padding: Spacing.containerMobile, gap: Spacing.xl, paddingBottom: 100 },
  card: { padding: Spacing.lg },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarText: { ...typography.headlineSm, fontWeight: '800', color: Colors.onPrimary },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadgeText: { fontSize: 10, color: '#ffffff' },
  info: { flex: 1 },
  name: { ...typography.headlineSm, color: Colors.onSurface },
  role: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  contactDetails: { gap: Spacing.xs, marginTop: Spacing.xs },
  detailText: { ...typography.bodySm, color: Colors.onSurface },
  section: { gap: Spacing.sm },
  sectionTitle: { ...typography.labelSm, color: Colors.onSurfaceVariant, letterSpacing: 1.5 },
  actionBtn: { backgroundColor: 'rgba(12, 148, 136, 0.1)', padding: Spacing.md, borderRadius: Radius.lg, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(12, 148, 136, 0.2)' },
  actionBtnText: { ...typography.bodyMd, fontWeight: '700', color: Colors.primary },
  summaryCard: { padding: Spacing.md },
  summaryText: { ...typography.bodyMd, color: Colors.onSurface, lineHeight: 24 },
  listItem: { padding: Spacing.md },
  listItemTitle: { ...typography.bodyMd, color: Colors.onSurface, fontWeight: '500' },
  listItemSub: { ...typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 4 },
  emptyText: { ...typography.bodySm, color: Colors.onSurfaceVariant, fontStyle: 'italic' },
  addFollowUpRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  addFollowUpInput: { flex: 1, backgroundColor: Colors.surfaceContainerHighest, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, ...typography.bodyMd, color: Colors.onSurface },
  addBtn: { width: 44, height: 44, backgroundColor: Colors.primary, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: Colors.onPrimary, ...typography.headlineMdMobile, fontWeight: '300', marginTop: -2 },
  avatarEditHint: { ...typography.labelSm, color: Colors.onPrimary, position: 'absolute', bottom: 4, fontWeight: '600', opacity: 0.8 },
  notesCard: { padding: Spacing.md },
  notesText: { ...typography.bodyMd, color: Colors.onSurface, lineHeight: 20 } });
