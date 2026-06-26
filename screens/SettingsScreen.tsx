import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, Radius } from '../constants/theme';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  discovery,
  getConnectedAccount,
  saveEmailAccount,
  disconnectGmail,
  exchangeCodeForTokens,
  ConnectedAccount,
} from '../services/gmailAuthService';

WebBrowser.maybeCompleteAuthSession();

const INTEGRATIONS = [
  { id: 'gmail', icon: '✉️', label: 'Gmail', status: 'Not connected' },
  { id: 'calendar', icon: '📅', label: 'Google Calendar', status: 'Not connected' },
  { id: 'contacts', icon: '👥', label: 'Google Contacts', status: 'Not connected' },
  { id: 'aa', icon: '🏦', label: 'Account Aggregator', status: 'Coming soon' },
];

const PROFILE_SETTINGS = [
  { id: 'notifications', icon: '🔔', label: 'Notifications', description: 'Bill reminders, AI briefings' },
  { id: 'voice', icon: '🎙️', label: 'Voice Language', description: 'English (India)' },
  { id: 'privacy', icon: '🔒', label: 'Privacy & Data', description: 'Manage your data' },
  { id: 'export', icon: '📤', label: 'Export Memory', description: 'Download all your data' },
];

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [connectedGmailAccount, setConnectedGmailAccount] = useState<ConnectedAccount | null>(null);
  const [integrationEnabled, setIntegrationEnabled] = useState<Record<string, boolean>>({
    gmail: false,
    calendar: false,
    contacts: false,
    aa: false,
  });

  // Load connected Gmail account from Supabase on mount
  useEffect(() => {
    async function loadAccount() {
      try {
        const account = await getConnectedAccount();
        if (account) {
          setConnectedGmailAccount(account);
          setIntegrationEnabled(prev => ({ ...prev, gmail: true }));
        }
      } catch (err) {
        console.error('Failed to load connected account:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAccount();
  }, []);

  // Configure OAuth Session
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'meenakshi',
    preferLocalhost: true,
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
    discovery
  );

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success' && response.params?.code) {
      const { code } = response.params;
      const codeVerifier = request?.codeVerifier;
      if (codeVerifier) {
        handleExchange(code, codeVerifier);
      }
    }
  }, [response]);

  const handleExchange = async (code: string, codeVerifier: string) => {
    setLoading(true);
    try {
      const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);
      
      const accountId = await saveEmailAccount(
        tokens.email,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresIn
      );
      
      const newAccount: ConnectedAccount = {
        id: accountId,
        email: tokens.email,
        lastSyncedAt: null,
        tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      };
      
      setConnectedGmailAccount(newAccount);
      setIntegrationEnabled(prev => ({ ...prev, gmail: true }));
      Alert.alert('Success', `Gmail connected: ${tokens.email}`);
    } catch (err: any) {
      console.error('OAuth exchange error:', err);
      Alert.alert('Connection Failed', err.message || 'An error occurred during Gmail login.');
      setIntegrationEnabled(prev => ({ ...prev, gmail: false }));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connectedGmailAccount) return;
    setLoading(true);
    try {
      await disconnectGmail(connectedGmailAccount.id);
      setConnectedGmailAccount(null);
      setIntegrationEnabled(prev => ({ ...prev, gmail: false }));
      Alert.alert('Disconnected', 'Your Gmail account has been disconnected.');
    } catch (err: any) {
      console.error('Failed to disconnect Gmail:', err);
      Alert.alert('Error', 'Failed to disconnect Gmail.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    if (id === 'aa') {
      Alert.alert('Coming Soon', 'Account Aggregator integration will be available in the next release.');
      return;
    }
    
    if (id === 'gmail') {
      if (integrationEnabled.gmail) {
        Alert.alert(
          'Disconnect Gmail',
          'Are you sure you want to disconnect your Gmail account? This will stop automated email sync.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disconnect', style: 'destructive', onPress: handleDisconnect }
          ]
        );
      } else {
        if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
          Alert.alert(
            'Configuration Needed',
            'Please add your EXPO_PUBLIC_GOOGLE_CLIENT_ID to the .env file before connecting.'
          );
          return;
        }
        promptAsync();
      }
    } else {
      // Calendar & Contacts placeholders
      setIntegrationEnabled(prev => ({ ...prev, [id]: !prev[id] }));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.purple} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
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
        </View>

        {/* Integrations */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DATA SOURCES</Text>
          <View style={styles.card}>
            {INTEGRATIONS.map((item, index) => (
              <View key={item.id}>
                <View style={styles.integrationRow}>
                  <Text style={styles.integrationIcon}>{item.icon}</Text>
                  <View style={styles.integrationText}>
                    <Text style={styles.integrationLabel}>{item.label}</Text>
                    <Text style={styles.integrationStatus}>
                      {item.id === 'gmail' && connectedGmailAccount
                        ? `✓ Connected (${connectedGmailAccount.email})`
                        : integrationEnabled[item.id]
                        ? '✓ Connected'
                        : item.status}
                    </Text>
                  </View>
                  <Switch
                    value={integrationEnabled[item.id]}
                    onValueChange={() => toggle(item.id)}
                    trackColor={{ false: Colors.bgCardAlt, true: Colors.purple }}
                    thumbColor={integrationEnabled[item.id] ? Colors.purpleLight : Colors.textMuted}
                    ios_backgroundColor={Colors.bgCardAlt}
                    disabled={item.id === 'aa'}
                  />
                </View>
                {index < INTEGRATIONS.length - 1 && (
                  <View style={styles.divider} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          <View style={styles.card}>
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
          </View>
        </View>

        {/* API Key info */}
        <View style={styles.apiCard}>
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
        </View>



        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Meenakshi AI  •  v1.0.0</Text>
          <Text style={styles.appInfoText}>Built by Straw Labs Genesis Cohort 01</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  screenTitle: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.lg,
  },
  profileCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: 13, color: Colors.textSecondary },
  editBtn: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  integrationIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  integrationText: { flex: 1, gap: 2 },
  integrationLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  integrationStatus: { fontSize: 12, color: Colors.textMuted },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  settingIcon: { fontSize: 20, width: 30, textAlign: 'center' },
  settingText: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  settingDesc: { fontSize: 12, color: Colors.textMuted },
  chevron: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },
  apiCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.amberFaint,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  apiIcon: { fontSize: 22 },
  apiBody: { flex: 1, gap: 4 },
  apiTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  apiDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  apiCode: {
    fontFamily: 'monospace',
    backgroundColor: Colors.bgCardAlt,
    color: Colors.purpleLight,
    fontSize: 11,
  },
  appInfo: { alignItems: 'center', gap: 4, paddingVertical: Spacing.md },
  appInfoText: { fontSize: 11, color: Colors.textMuted },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 15, 29, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
