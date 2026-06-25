import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { MOCK_CONTACTS } from '../constants';
import supabase from '../lib/supabase';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PENDING_FOLLOW_UPS = [
  {
    id: 'f1',
    name: 'Rajesh Kumar',
    task: 'Send home loan documents',
    daysAgo: 2,
    initials: 'RK',
    color: '#8455ef',
  },
  {
    id: 'f2',
    name: 'Priya Sharma',
    task: 'Review SIP proposal',
    daysAgo: 7,
    initials: 'PS',
    color: '#0c9488',
  },
];

export default function RelationshipsScreen() {
  const navigation = useNavigation<NavProp>();
  const [contacts, setContacts] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEntities() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setContacts([]);
          setFollowUps([]);
          setLoading(false);
          return;
        }

        const { data: entitiesList, error } = await supabase
          .from('entities')
          .select('id, name, type, metadata, updated_at')
          .eq('user_id', user.id)
          .eq('type', 'person');

        if (error || !entitiesList || entitiesList.length === 0) {
          setContacts([]);
          setFollowUps([]);
        } else {
          const fetchedContacts: any[] = [];
          const fetchedFollowUps: any[] = [];

          entitiesList.forEach((ent: any) => {
            const initials = ent.name
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            const meta = ent.metadata || {};
            const daysAgoVal = Math.max(
              1,
              Math.floor((Date.now() - new Date(ent.updated_at).getTime()) / 86400000)
            );

            const mapped = {
              id: ent.id,
              name: ent.name,
              role: meta.role || 'Contact',
              company: meta.company || meta.email || 'Gmail Connection',
              lastInteraction: meta.lastInteraction || `${daysAgoVal} days ago`,
              initials,
              color: meta.color || '#8455ef',
              task: meta.task || meta.pending_task || null,
              daysAgo: daysAgoVal,
            };

            if (mapped.task) {
              fetchedFollowUps.push(mapped);
            } else {
              fetchedContacts.push(mapped);
            }
          });

          setContacts(fetchedContacts);
          setFollowUps(fetchedFollowUps);
        }
      } catch (err) {
        console.error('[RelationshipsScreen] Failed to load entities:', err);
        setContacts([]);
        setFollowUps([]);
      } finally {
        setLoading(false);
      }
    }
    loadEntities();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.glow} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenLabel}>CIRCLES</Text>
          <Text style={styles.screenTitle}>Your Network</Text>
          <Text style={styles.screenSubtitle}>Relationship graph and key contacts.</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                  <View style={styles.avatarAndInfo}>
                    <View style={[styles.avatar, { backgroundColor: f.color }]}>
                      <Text style={styles.avatarText}>{f.initials}</Text>
                    </View>
                    <View style={styles.metaArea}>
                      <Text style={styles.contactName}>{f.name}</Text>
                      <Text style={styles.contactTask}>{f.task}</Text>
                    </View>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{f.daysAgo}d ago</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.askBtn}
                  onPress={() =>
                    navigation.navigate('Chat', {
                      initialQuery: `Draft a follow-up message to ${f.name} regarding: ${f.task}`,
                    })
                  }
                  activeOpacity={0.75}
                >
                  <Text style={styles.askBtnText}>✦ Ask about {f.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Key Contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>KEY CONTACTS</Text>
          {contacts.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No key contacts found. Sync Gmail to build connections.</Text>
            </View>
          ) : (
            contacts.map(contact => (
              <View key={contact.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatarAndInfo}>
                    <View style={[styles.avatar, { backgroundColor: contact.color }]}>
                      <Text style={styles.avatarText}>{contact.initials}</Text>
                    </View>
                    <View style={styles.metaArea}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactDetails}>
                        {contact.role} • {contact.company}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.lastSeen}>{contact.lastInteraction}</Text>
                </View>

                <TouchableOpacity
                  style={styles.askBtn}
                  onPress={() =>
                    navigation.navigate('Chat', {
                      initialQuery: `What details or follow-ups do I have for ${contact.name}?`,
                    })
                  }
                  activeOpacity={0.75}
                >
                  <Text style={styles.askBtnText}>✦ Ask about {contact.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Empty state for graph visualization */}
        <View style={styles.graphPlaceholder}>
          <Text style={styles.graphIcon}>◎</Text>
          <Text style={styles.graphTitle}>Relationship Graph</Text>
          <Text style={styles.graphDesc}>
            Visual relationship map coming soon. Meenakshi will map connections between your contacts, companies, and financial events.
          </Text>
        </View>
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
  lastSeen: {
    fontSize: 11,
    color: Colors.textMuted,
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
  graphPlaceholder: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderStyle: 'dashed',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  graphIcon: {
    fontSize: 36,
    color: Colors.textMuted,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  graphDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
