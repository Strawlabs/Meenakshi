import { useAppTheme } from '../context/ThemeContext';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius } from '../constants/theme';
import GlassCard from '../components/GlassCard';

const PROFILE_SETTINGS = [
  { id: 'notifications', icon: '🔔', label: 'Notifications', description: 'Bill reminders, AI briefings' },
  { id: 'voice', icon: '🎙️', label: 'Voice Language', description: 'English (India)' },
  { id: 'privacy', icon: '🔒', label: 'Privacy & Data', description: 'Manage your data' },
  { id: 'export', icon: '📤', label: 'Export Memory', description: 'Download all your data' },
];

export default function SettingsScreen() {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <GlassCard style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>P</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Prabhu Nagoor</Text>
            <Text style={styles.profileEmail}>prabhu@strawlabs.in</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Integrations */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DATA SOURCES</Text>
          <GlassCard style={styles.card}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => navigation.navigate('Integrations')}
            >
              <Text style={styles.settingIcon}>🔗</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Integrations Hub</Text>
                <Text style={styles.settingDesc}>Manage bank accounts, emails, and more</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          <GlassCard style={styles.card}>
            {PROFILE_SETTINGS.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => Alert.alert(item.label, `${item.description} — coming soon.`)}
                >
                  <Text style={styles.settingIcon}>{item.icon}</Text>
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingDesc}>{item.description}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
                {index < PROFILE_SETTINGS.length - 1 && (
                  <View style={styles.divider} />
                )}
              </View>
            ))}
          </GlassCard>
        </View>

        {/* API Key info */}
        <GlassCard style={styles.apiCard}>
          <Text style={styles.apiIcon}>🔑</Text>
          <View style={styles.apiBody}>
            <Text style={styles.apiTitle}>Gemini API Key</Text>
            <Text style={styles.apiDesc}>
              Add your key to{' '}
              <Text style={styles.apiCode}>.env</Text>
              {' '}as{' '}
              <Text style={styles.apiCode}>EXPO_PUBLIC_GEMINI_API_KEY</Text>
            </Text>
          </View>
        </GlassCard>



        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Meenakshi AI  •  v1.0.0</Text>
          <Text style={styles.appInfoText}>Built by Straw Labs Genesis Cohort 01</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md
  },
  backBtn: { marginBottom: 8 },
  backText: { ...typography.bodyMd, color: Colors.onSurfaceVariant },
  screenTitle: { ...typography.headlineLgMobile, color: Colors.onSurface },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.lg
  },
  profileCard: {
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileAvatarText: { ...typography.headlineSm, color: Colors.onSecondary },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { ...typography.bodyLg, fontWeight: '700', color: Colors.onSurface },
  profileEmail: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  editBtn: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.glassBorder
  },
  editBtnText: { ...typography.labelSm, color: Colors.onSurface },
  section: { gap: Spacing.sm },
  sectionLabel: {
    ...typography.labelSm,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.5,
    marginBottom: 4
  },
  card: { padding: 0 },
  divider: { height: 1, backgroundColor: Colors.glassBorder, marginHorizontal: Spacing.md },
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md
  },
  integrationIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  integrationText: { flex: 1, gap: 2 },
  integrationLabel: { ...typography.bodyMd, fontWeight: '600', color: Colors.onSurface },
  integrationStatus: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md
  },
  settingIcon: { fontSize: 20, width: 30, textAlign: 'center' },
  settingText: { flex: 1, gap: 2 },
  settingLabel: { ...typography.bodyMd, fontWeight: '600', color: Colors.onSurface },
  settingDesc: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  chevron: { fontSize: 22, color: Colors.onSurfaceVariant, fontWeight: '300' },
  apiCard: {
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start'
  },
  apiIcon: { fontSize: 22 },
  apiBody: { flex: 1, gap: 4 },
  apiTitle: { ...typography.bodyMd, fontWeight: '700', color: Colors.onSurface },
  apiDesc: { ...typography.bodySm, color: Colors.onSurfaceVariant, lineHeight: 18 },
  apiCode: {
    fontFamily: typography.bodySm.fontFamily,
    backgroundColor: Colors.surfaceContainerHighest,
    color: Colors.secondary,
    paddingHorizontal: 4,
    borderRadius: 4,
    fontSize: 11
  },
  appInfo: { alignItems: 'center', gap: 4, paddingVertical: Spacing.md },
  appInfoText: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 15, 29, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999
  }
});
