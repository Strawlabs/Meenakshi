import { useAppTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius } from '../constants/theme';
import { getIntegrationStatuses, revokeIntegration, retrySync } from '../services/integrationService';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import supabase from '../lib/supabase';
import { discovery, exchangeCodeForTokens, saveEmailAccount } from '../services/gmailAuthService';
// googleSignInService is Android-only — required lazily inside handleGoogleConnectAndroid
import { uploadCreditReport, parseCreditReport } from '../services/creditReportService';



type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

const INTEGRATIONS = [
  {
    id: 'gmail',
    icon: '✉️',
    title: 'Gmail',
    description: 'Financial emails, statements & follow-ups',
    color: '#EA4335' },
  {
    id: 'calendar',
    icon: '📅',
    title: 'Google Calendar',
    description: 'Meeting context & payment reminders',
    color: '#4285F4' },
  {
    id: 'contacts',
    icon: '👥',
    title: 'Google Contacts',
    description: 'Relationship memory & follow-up tracking',
    color: '#34A853' },
  {
    id: 'document_vault',
    icon: '📁',
    title: 'Document Vault',
    description: 'Securely store and query your documents',
    color: '#9AA0A6' },
  {
    id: 'business_card',
    icon: '📇',
    title: 'Business Cards',
    description: 'Auto-save contacts from business cards',
    color: '#F29900' },
  {
    id: 'bank_account',
    icon: '🏦',
    title: 'Bank Accounts',
    description: 'Bank statements & financial intelligence',
    color: '#FBBC04' },
  {
    id: 'credit_report',
    icon: '📊',
    title: 'Credit Report',
    description: 'Monitor your credit health',
    color: '#8E24AA' },
];

export default function OnboardingScreen({ navigation }: Props) {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    gmail: false,
    calendar: false,
    contacts: false,
    document_vault: false,
    business_card: false,
    bank_account: false,
    credit_report: false,
  });
  
  const [loading, setLoading] = useState(false);
  
  const [phonePromptVisible, setPhonePromptVisible] = useState(false);
  const [phonePromptResolve, setPhonePromptResolve] = useState<((val: string | null) => void) | null>(null);
  const [phoneInput, setPhoneInput] = useState('');

  const loadStatuses = async () => {
    try {
      const m = await import('../lib/supabase');
      const { data: { user } } = await m.default.auth.getUser();
      if (user) {
        const res = await getIntegrationStatuses(user.id);
        setEnabled(prev => {
          const next = { ...prev };
          Object.keys(res).forEach(key => {
            if (res[key]?.status === 'connected' || res[key]?.status === 'error') {
              next[key] = true;
            } else {
              next[key] = false;
            }
          });
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to load statuses on onboarding:', err);
    }
  };

  useEffect(() => {
    loadStatuses();
  }, []);

  // iOS-only expo-auth-session config.
  // Android uses @react-native-google-signin/google-signin (native Play Services).
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID     || '';

  const redirectUri = React.useMemo(() => {
    if (Platform.OS === 'ios' && iosClientId) {
      const idWithoutSuffix = iosClientId.replace('.apps.googleusercontent.com', '');
      return `com.googleusercontent.apps.${idWithoutSuffix}:/`;
    }
    return AuthSession.makeRedirectUri({ scheme: 'meenakshi' });
  }, [iosClientId]);

  const baseConfig = {
    clientId: Platform.OS === 'ios' ? iosClientId : webClientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    extraParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' } };


  const [gmailReq, gmailRes, gmailPrompt] = AuthSession.useAuthRequest({
    ...baseConfig,
    scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/gmail.readonly']
  }, discovery);

  const [calReq, calRes, calPrompt] = AuthSession.useAuthRequest({
    ...baseConfig,
    scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/calendar.readonly']
  }, discovery);

  const [contactsReq, contactsRes, contactsPrompt] = AuthSession.useAuthRequest({
    ...baseConfig,
    scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/contacts.readonly']
  }, discovery);

  const exchangedCodes = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    const processResponse = (req: any, res: any, integrationId: string) => {
      if (res?.type === 'success' && res.params?.code) {
        if (!req) return;
        if (!exchangedCodes.current.has(res.params.code)) {
          exchangedCodes.current.add(res.params.code);
          handleExchange(res.params.code, req.codeVerifier || '', integrationId);
        }
      } else if (res?.type === 'error') {
        if (!exchangedCodes.current.has(res.error?.message || 'error')) {
          exchangedCodes.current.add(res.error?.message || 'error');
          Alert.alert('Authentication Error', res.error?.message || 'Something went wrong');
        }
      }
    };

    processResponse(gmailReq, gmailRes, 'gmail');
    processResponse(calReq, calRes, 'calendar');
    processResponse(contactsReq, contactsRes, 'contacts');
  }, [gmailRes, calRes, contactsRes, gmailReq, calReq, contactsReq]);

  const handleExchange = async (code: string, codeVerifier: string, integrationId: string) => {
    setLoading(true);
    try {
      const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);
      await finishGoogleConnect(tokens, integrationId);
    } catch (err: any) {
      console.error('OAuth exchange error:', err);
      Alert.alert('Connection Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Android-only: native Google Play Services sign-in. */
  const handleGoogleConnectAndroid = async (integrationId: string) => {
    // Lazy require so RNGoogleSignin native module is never loaded on iOS
    const { signInWithGoogleAndroid, statusCodes } =
      require('../services/googleSignInService') as typeof import('../services/googleSignInService');
    const meta = INTEGRATIONS.find(m => m.id === integrationId);
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      ...((meta as any)?.scopes || []),
    ];
    setLoading(true);
    try {
      const tokens = await signInWithGoogleAndroid(scopes);
      await finishGoogleConnect(tokens, integrationId);
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // silent
      } else {
        console.error('[Android] Google Sign-In error:', err);
        Alert.alert('Connection Failed', err.message || 'Google Sign-In failed');
      }
    } finally {
      setLoading(false);
    }
  };


  /** Shared post-auth logic for both iOS and Android. */
  const finishGoogleConnect = async (tokens: { accessToken: string; refreshToken: string | null; expiresIn: number; email: string; name?: string; picture?: string | null }, integrationId: string) => {
    await saveEmailAccount(tokens.email, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
    import('../lib/supabase').then(async (m) => {
      const { data: { user } } = await m.default.auth.getUser();
      if (user && integrationId) {
        await m.default.from('integration_consents').upsert({
          user_id: user.id,
          integration: integrationId,
          status: 'connected',
          connected_at: new Date().toISOString() }, { onConflict: 'user_id,integration' });
        await loadStatuses();
        retrySync(integrationId).then(() => loadStatuses());
      }
    });
    Alert.alert('Success', `${integrationId} connected and syncing in background.`);
  };



  const toggle = async (id: string) => {
    const isConnected = enabled[id];
    if (isConnected) {
      const doDisconnect = async () => {
        setLoading(true);
        try {
          await revokeIntegration(id);
          await loadStatuses();
        } catch (e: any) {
          Alert.alert("Disconnect Failed", e.message);
        } finally {
          setLoading(false);
        }
      };

      if (Platform.OS === 'web') {
        if (window.confirm(`Are you sure you want to disconnect ${id}?`)) {
          await doDisconnect();
        }
      } else {
        Alert.alert('Disconnect', `Are you sure you want to disconnect ${id}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: doDisconnect }
        ]);
      }
    } else {
      const googleIds = ['gmail', 'calendar', 'contacts'];
      if (googleIds.includes(id)) {
        if (Platform.OS === 'android') {
          await handleGoogleConnectAndroid(id);
          return;
        }
        if (id === 'gmail')     gmailPrompt();
        else if (id === 'calendar')  calPrompt();
        else if (id === 'contacts')  contactsPrompt();
      } else if (id === 'bank_account') {

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert("Error", "Not logged in");
          return;
        }

        let mobileNumber = user.phone || user.user_metadata?.phone;

        if (!mobileNumber) {
          if (Platform.OS === 'web') {
            mobileNumber = window.prompt("Please enter your 10-digit mobile number for Setu Account Aggregator linking:");
          } else {
            mobileNumber = await new Promise<string | null>((resolve) => {
              setPhonePromptResolve(() => resolve);
              setPhonePromptVisible(true);
            });
          }
        }

        if (!mobileNumber) return;

        mobileNumber = mobileNumber.replace(/\D/g, '');
        if (mobileNumber.length > 10) mobileNumber = mobileNumber.slice(-10);

        setLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('aa-create-consent', {
            body: { userId: user.id, fiTypes: ['DEPOSIT'], vua: mobileNumber }
          });
          
          let responseData = data;
          if (error) {
            try {
              if (error.context && typeof error.context.json === 'function') {
                responseData = await error.context.json();
              } else if (error.context) {
                responseData = typeof error.context === 'string' ? JSON.parse(error.context) : error.context;
              }
            } catch (e) {
              console.log("Could not parse error context:", e);
            }
            if (!responseData?.isSetuError) throw error;
          }

          if (responseData?.isSetuError) {
            throw new Error(responseData.error);
          }
          if (responseData?.url) {
            await WebBrowser.openBrowserAsync(responseData.url);
            let connected = false;
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              const freshStatuses = await getIntegrationStatuses(user.id);
              if (freshStatuses['bank_account']?.status === 'connected') {
                connected = true;
                setEnabled(prev => {
                  const next = { ...prev };
                  Object.keys(freshStatuses).forEach(key => {
                    if (freshStatuses[key]?.status === 'connected' || freshStatuses[key]?.status === 'error') {
                      next[key] = true;
                    } else {
                      next[key] = false;
                    }
                  });
                  return next;
                });
                break;
              }
            }
            if (!connected) await loadStatuses();
          }
        } catch (err: any) {
          Alert.alert("Bank Account Linking Failed", err.message);
        } finally {
          setLoading(false);
        }
      } else if (id === 'credit_report') {
        setLoading(true);
        try {
          const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
          if (!res.canceled && res.assets && res.assets.length > 0) {
            const asset = res.assets[0];
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const uploaded = await uploadCreditReport(user.id, asset.uri, asset.name, asset.mimeType || 'application/pdf');
            const result = await parseCreditReport(uploaded.id);
            if (result.status === 'parsed') {
              await supabase.from('integration_consents').upsert({
                user_id: user.id,
                integration: 'credit_report',
                status: 'connected',
                connected_at: new Date().toISOString()
              }, { onConflict: 'user_id,integration' });
              Alert.alert("Success", "Credit report parsed and connected successfully.");
              loadStatuses();
            } else {
              Alert.alert("Parse Error", result.error_message || "Failed to extract data from the credit report.");
            }
          }
        } catch (err: any) {
          Alert.alert("Upload Failed", err.message);
        } finally {
          setLoading(false);
        }
      } else {
        // Vault and Business Card
        setLoading(true);
        try {
          const m = await import('../lib/supabase');
          const { data: { user } } = await m.default.auth.getUser();
          if (user) {
            await m.default.from('integration_consents').upsert({
              user_id: user.id,
              integration: id,
              status: 'connected',
              connected_at: new Date().toISOString() }, { onConflict: 'user_id,integration' });
            await loadStatuses();
          }
        } catch (err: any) {
           Alert.alert("Failed", err.message);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const connectedCount = Object.values(enabled).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.glow} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.orb}>
            <Text style={styles.orbIcon}>✦</Text>
          </View>
          <Text style={styles.title}>Connect your world</Text>
          <Text style={styles.subtitle}>
            Meenakshi builds your memory graph from these sources. You control everything.
          </Text>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* Integration List */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {INTEGRATIONS.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                  <Text style={styles.iconText}>{item.icon}</Text>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDesc}>{item.description}</Text>
                </View>
              </View>
              <Switch
                value={enabled[item.id]}
                onValueChange={() => toggle(item.id)}
                trackColor={{ false: 'rgba(255,255,255,0.08)', true: Colors.purple }}
                thumbColor={enabled[item.id] ? Colors.onPrimary : Colors.onPrimaryContainer}
                ios_backgroundColor="rgba(255,255,255,0.08)"
              />
            </View>
          ))}

          {/* Progress note */}
          <View style={styles.progressNote}>
            <Text style={styles.progressText}>
              {connectedCount === 0
                ? 'Connect at least one source for best results'
                : `${connectedCount} source${connectedCount > 1 ? 's' : ''} connected — Meenakshi is ready!`}
            </Text>
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={styles.cta}>
          <TouchableOpacity
            style={[styles.ctaBtn, connectedCount > 0 && styles.ctaBtnActive]}
            onPress={() => navigation.navigate('Main')}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaBtnText, connectedCount > 0 && styles.ctaBtnTextActive]}>
              {connectedCount > 0 ? 'Build My Memory Graph →' : 'Continue Without Connecting'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.legalText}>
            You can connect or disconnect any source anytime from Settings.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.primaryContainer },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: 40,
    paddingBottom: 20 },
  glow: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.purple,
    opacity: 0.15 },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm },
  orb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: Colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8 },
  orbIcon: {
    fontSize: 22,
    color: Colors.onPrimary },
  title: {
    ...typography.headlineLgMobile,
    color: Colors.onPrimary,
    textAlign: 'center' },
  subtitle: {
    ...typography.bodyMd,
    color: Colors.onPrimaryContainer,
    textAlign: 'center',
    maxWidth: 300 },
  list: {
    flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: Spacing.md,
    marginBottom: Spacing.sm },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center' },
  iconText: {
    fontSize: 22 },
  cardText: {
    flex: 1,
    gap: 2 },
  cardTitle: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: Colors.onPrimary },
  cardDesc: {
    ...typography.labelSm,
    color: Colors.onPrimaryContainer,
    lineHeight: 17 },
  progressNote: {
    backgroundColor: 'rgba(107, 56, 212, 0.15)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(107, 56, 212, 0.3)',
    padding: Spacing.md,
    marginTop: Spacing.sm,
    alignItems: 'center' },
  progressText: {
    ...typography.bodyMd,
    color: Colors.primaryFixedDim,
    textAlign: 'center',
    fontWeight: '600' },
  cta: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
    alignItems: 'center' },
  ctaBtn: {
    width: '100%',
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)' },
  ctaBtnActive: {
    backgroundColor: Colors.onPrimary,
    borderColor: Colors.onPrimary },
  ctaBtnText: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: Colors.onPrimary },
  ctaBtnTextActive: {
    color: Colors.primaryContainer },
  legalText: {
    color: Colors.onPrimaryContainer,
    textAlign: 'center' },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10, 15, 29, 0.6)',
    justifyContent: 'center', alignItems: 'center', zIndex: 999 }
});
