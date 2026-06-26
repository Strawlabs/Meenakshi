import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { getAllContacts } from '../services/relationshipService';
import { getFollowUps, markFollowUpDone } from '../services/followUpService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function RelationshipsScreen() {
  const navigation = useNavigation<NavProp>();
  const isFocused = useIsFocused();
  const [contacts, setContacts] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contactsData, followUpsData] = await Promise.all([
        getAllContacts(),
        getFollowUps()
      ]);
      setContacts(contactsData || []);
      setFollowUps((followUpsData || []).filter((f: any) => f.status === 'pending'));
    } catch (err) {
      console.error('[RelationshipsScreen] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDone = async (id: string) => {
    try {
      await markFollowUpDone(id);
      setFollowUps(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error('Failed to mark done', err);
    }
  };

  const getRandomColor = (id: string) => {
    const colors = ['#8455ef', '#0c9488', '#ea580c', '#2563eb', '#db2777'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.glow} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.screenLabel}>CIRCLES</Text>
            <Text style={styles.screenTitle}>Your Network</Text>
            <Text style={styles.screenSubtitle}>Relationship graph and key contacts.</Text>
          </View>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => navigation.navigate('BusinessCard')}
          >
            <Text style={styles.scanBtnText}>📸 Scan Card</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.purple} style={{ marginTop: Spacing.xl }} />
        ) : (
          <>
            {/* Pending Follow-ups */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PENDING FOLLOW-UPS</Text>
              {followUps.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No pending follow-ups found.</Text>
                </View>
              ) : (
                followUps.map(f => (
                  <View key={f.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.metaArea}>
                        <Text style={styles.contactName}>{f.contacts?.name || 'General Task'}</Text>
                        <Text style={styles.contactTask}>{f.description}</Text>
                      </View>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{f.due_date ? new Date(f.due_date).toLocaleDateString() : 'No date'}</Text>
                      </View>
                    </View>

                    <View style={styles.actionRow}>
                      {f.contact_id && (
                        <TouchableOpacity
                          style={[styles.askBtn, { flex: 1, marginRight: Spacing.sm }]}
                          onPress={() => navigation.navigate('ContactProfile', { contactId: f.contact_id })}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.askBtnText}>View Profile</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.askBtn, { flex: 1, backgroundColor: 'rgba(12, 148, 136, 0.1)', borderColor: 'rgba(12, 148, 136, 0.2)' }]}
                        onPress={() => handleMarkDone(f.id)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.askBtnText, { color: '#0c9488' }]}>✓ Mark Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Key Contacts */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>KEY CONTACTS</Text>
              {contacts.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No key contacts found. Scan a business card to get started.</Text>
                </View>
              ) : (
                contacts.map(contact => {
                  const initials = contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                  const color = getRandomColor(contact.id);
                  return (
                    <TouchableOpacity
                      key={contact.id}
                      style={styles.card}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('ContactProfile', { contactId: contact.id })}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.avatarAndInfo}>
                          <View style={[styles.avatar, { backgroundColor: color }]}>
                            <Text style={styles.avatarText}>{initials}</Text>
                          </View>
                          <View style={styles.metaArea}>
                            <Text style={styles.contactName}>{contact.name}</Text>
                            <Text style={styles.contactDetails}>
                              {contact.designation || 'Contact'} {contact.organization ? `• ${contact.organization}` : ''}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
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
    bottom: -100,
    left: -100,
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
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  scanBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  scanBtnText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: Spacing.containerMobile,
    paddingBottom: 110,
    paddingTop: Spacing.md,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.labelSm,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarAndInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  metaArea: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  contactTask: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contactDetails: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  badge: {
    backgroundColor: Colors.amberFaint,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.1)',
  },
  badgeText: {
    fontSize: 11,
    color: Colors.amber,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  askBtn: {
    backgroundColor: 'rgba(107, 56, 212, 0.05)',
    borderRadius: Radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 56, 212, 0.1)',
  },
  askBtnText: {
    fontSize: 12,
    color: Colors.purple,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
