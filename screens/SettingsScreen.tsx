import { useAppTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius } from '../constants/theme';
import GlassCard from '../components/GlassCard';
import StitchIcon from '../components/StitchIcon';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getUserDisplayName,
  getUserEmail,
  getUserAvatarInitial,
  setUserDisplayName,
} from '../services/profileService';
import { clearAllMemory, getMemoryStats } from '../services/memoryService';

const TRASH_CAN_IMG = require('../assets/images/purple_3d_trashcan_solid.png');

export default function SettingsScreen() {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [displayName, setDisplayNameState] = useState('');
  const [email, setEmail] = useState('');
  const [avatarInitial, setAvatarInitial] = useState('M');
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [clearingMemory, setClearingMemory] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const [name, mail, initial, stats] = await Promise.all([
        getUserDisplayName(),
        getUserEmail(),
        getUserAvatarInitial(),
        getMemoryStats(),
      ]);
      setDisplayNameState(name);
      setEmail(mail);
      setAvatarInitial(initial);
      setSessionCount(stats.sessionCount);
    } catch (err) {
      console.error('[SettingsScreen] Failed to load profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleEditName = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Edit Display Name',
        'Enter the name you want Meenakshi to use:',
        async (newName) => {
          if (!newName?.trim()) return;
          try {
            await setUserDisplayName(newName.trim());
            setDisplayNameState(newName.trim());
            setAvatarInitial(newName.trim().charAt(0).toUpperCase());
          } catch {
            Alert.alert('Error', 'Could not update your name. Please try again.');
          }
        },
        'plain-text',
        displayName,
      );
    } else {
      Alert.alert(
        'Set Your Name',
        'Connect Gmail in Integrations Hub and Meenakshi will automatically use the name from your Google account.',
        [{ text: 'Go to Integrations', onPress: () => navigation.navigate('Integrations') }, { text: 'Cancel', style: 'cancel' }],
      );
    }
  };

  const handleClearMemory = () => {
    const countText = sessionCount != null ? ` (${sessionCount} conversation${sessionCount !== 1 ? 's' : ''})` : '';
    Alert.alert(
      'Clear All Conversations',
      `This will permanently delete all your conversation history${countText}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearingMemory(true);
            try {
              await clearAllMemory();
              setSessionCount(0);
              Alert.alert('Done', 'All conversations cleared.');
            } catch {
              Alert.alert('Error', 'Failed to clear conversations. Please try again.');
            } finally {
              setClearingMemory(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      {/* Background Gradient */}
      <LinearGradient
        colors={[Colors.background, Colors.surfaceContainer, Colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <View style={styles.backBtnCircle}>
              <StitchIcon name="arrow_back" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.screenTitle}>Settings</Text>
            <Text style={styles.screenSubtitle}>Manage your account, data and preferences</Text>
          </View>

          {/* Profile Hero Section */}
          <GlassCard borderRadius={20} style={styles.profileCard}>
            <View style={styles.profileLeft}>
              <View style={styles.avatarContainer}>
                <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.avatarGradientBorder}>
                  <View style={styles.profileAvatar}>
                    {loadingProfile ? (
                      <ActivityIndicator size="small" color={Colors.onPrimary} />
                    ) : (
                      <Text style={styles.profileAvatarText}>{avatarInitial}</Text>
                    )}
                  </View>
                </LinearGradient>
                <TouchableOpacity style={styles.editBadge} onPress={handleEditName} activeOpacity={0.8}>
                   <StitchIcon name="edit" size={12} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {loadingProfile ? '…' : (displayName || 'Your Name')}
                </Text>
                <Text style={styles.profileEmail}>
                  {loadingProfile ? '…' : email}
                </Text>
                <View style={styles.secureBadge}>
                  <StitchIcon name="shield" size={12} color={Colors.primary} />
                  <Text style={styles.secureText}>Secure account</Text>
                </View>
              </View>
            </View>
          </GlassCard>

          {/* Data Sources */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DATA SOURCES</Text>
            <GlassCard borderRadius={16} style={styles.card}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => navigation.navigate('Integrations')}
                activeOpacity={0.7}
              >
                <View style={styles.iconSquare}>
                  <StitchIcon name="link" size={24} color={Colors.primary} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Integrations Hub</Text>
                  <Text style={styles.settingDesc}>Manage bank accounts, emails, and more</Text>
                </View>
                <StitchIcon name="chevron_right" size={20} color={Colors.outline} />
              </TouchableOpacity>
            </GlassCard>
          </View>

          {/* Memory Management */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MEMORY</Text>
            <GlassCard borderRadius={16} style={styles.card}>
              <View style={styles.memoryCardInner}>
                <View style={styles.memoryLeft}>
                  <Image source={TRASH_CAN_IMG} style={styles.trashImage} />
                </View>
                <View style={styles.memoryRight}>
                  <Text style={styles.memoryTitle}>Clear All Conversations</Text>
                  <Text style={styles.memoryDesc}>
                    {sessionCount != null ? `${sessionCount} conversation${sessionCount !== 1 ? 's' : ''} stored` : 'Loading…'}
                  </Text>
                  <TouchableOpacity style={styles.clearBtn} onPress={handleClearMemory} disabled={clearingMemory}>
                    {clearingMemory ? <ActivityIndicator size="small" color="#e04848" /> : (
                      <>
                        <Text style={styles.clearBtnText}>Clear Now</Text>
                        <StitchIcon name="chevron_right" size={16} color="#e04848" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Support & App */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SUPPORT & APP</Text>
            <GlassCard borderRadius={16} style={styles.card}>
              <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                <View style={styles.iconSquareSmall}>
                  <StitchIcon name="help" size={20} color={Colors.primary} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Help & Support</Text>
                  <Text style={styles.settingDesc}>Get help and find answers</Text>
                </View>
                <StitchIcon name="chevron_right" size={20} color={Colors.outline} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                <View style={styles.iconSquareSmall}>
                  <StitchIcon name="security" size={20} color={Colors.primary} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Privacy & Security</Text>
                  <Text style={styles.settingDesc}>Manage your privacy preferences</Text>
                </View>
                <StitchIcon name="chevron_right" size={20} color={Colors.outline} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                <View style={styles.iconSquareSmall}>
                  <StitchIcon name="info" size={20} color={Colors.primary} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>About Meenakshi AI</Text>
                  <Text style={styles.settingDesc}>v1.0.0 • Straw Labs Genesis Cohort 01</Text>
                </View>
                <StitchIcon name="chevron_right" size={20} color={Colors.outline} />
              </TouchableOpacity>
            </GlassCard>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtnCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backText: { ...typography.bodyLg, color: Colors.onSurfaceVariant },
  headerTextContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  screenTitle: { ...typography.displaySm, color: Colors.onSurface, fontWeight: '700' },
  screenSubtitle: { ...typography.bodyMd, color: Colors.onSurfaceVariant },
  scrollContent: {
    paddingBottom: 100,
    gap: Spacing.xl,
  },
  
  // Profile Hero
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarGradientBorder: {
    padding: 3,
    borderRadius: 100,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  profileAvatarText: { ...typography.headlineMd, color: Colors.onPrimary },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.surface,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileInfo: { gap: 2, flex: 1 },
  profileName: { ...typography.bodyLg, fontWeight: '600', color: Colors.onSurface },
  profileEmail: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  secureText: { ...typography.labelSm, color: Colors.primary },
  
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  editBtnText: { ...typography.labelLg, color: Colors.primary, fontWeight: '600' },

  // Sections
  section: {
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  sectionLabel: { 
    ...typography.labelSm, 
    color: Colors.primary,
    letterSpacing: 1.2,
    paddingLeft: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  iconSquare: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(107, 56, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSquareSmall: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(107, 56, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: { flex: 1, gap: 2 },
  settingLabel: { ...typography.bodyLg, color: Colors.onSurface, fontWeight: '600' },
  settingDesc: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  divider: { height: 1, backgroundColor: Colors.outlineVariant, marginHorizontal: Spacing.lg },

  // Memory Card
  memoryCardInner: {
    flexDirection: 'row',
    margin: -Spacing.md, // offset the GlassCard padding
  },
  memoryLeft: {
    width: 120,
    backgroundColor: 'rgba(107, 56, 212, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  trashImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  memoryRight: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    gap: 4,
  },
  memoryTitle: { ...typography.bodyLg, color: Colors.onSurface, fontWeight: '600' },
  memoryDesc: { ...typography.bodySm, color: Colors.onSurfaceVariant, marginBottom: 8 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(224, 72, 72, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 4,
  },
  clearBtnText: { ...typography.labelLg, color: '#e04848', fontWeight: '600' },
});
