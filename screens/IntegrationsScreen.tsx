import { useAppTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius} from '../constants/theme';
import GlassCard from '../components/GlassCard';
import StitchIcon from '../components/StitchIcon';
import { LinearGradient } from 'expo-linear-gradient';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import supabase from '../lib/supabase';
import { discovery, exchangeCodeForTokens, saveEmailAccount } from '../services/gmailAuthService';
// googleSignInService is Android-only — required lazily inside handleGoogleConnectAndroid
import { getIntegrationStatuses, retrySync, revokeIntegration, IntegrationConsent } from '../services/integrationService';
import { uploadCreditReport, parseCreditReport } from '../services/creditReportService';


const INTEGRATIONS_META = [
  { id: 'gmail', icon: '✉️', label: 'Gmail', scopes: ['https://www.googleapis.com/auth/gmail.readonly'] },
  { id: 'calendar', icon: '📅', label: 'Google Calendar', scopes: ['https://www.googleapis.com/auth/calendar.readonly'] },
  { id: 'contacts', icon: '👥', label: 'Google Contacts', scopes: ['https://www.googleapis.com/auth/contacts.readonly'] },
  { id: 'document_vault', icon: '📁', label: 'Document Vault', scopes: [] },
  { id: 'business_card', icon: '📇', label: 'Business Cards', scopes: [] },
  { id: 'bank_account', icon: '🏦', label: 'Bank Accounts', scopes: [] },
  { id: 'credit_report', icon: '📊', label: 'Credit Report', scopes: [] },
];

export default function IntegrationsScreen() {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, IntegrationConsent>>({});
  const [currentRequestingId, setCurrentRequestingId] = useState<string | null>(null);

  const [phonePromptVisible, setPhonePromptVisible] = useState(false);
  const [phonePromptResolve, setPhonePromptResolve] = useState<((val: string | null) => void) | null>(null);
  const [phoneInput, setPhoneInput] = useState('');

  useEffect(() => {
    loadStatuses();
  }, []);

  const loadStatuses = async () => {
    const m = await import('../lib/supabase');
    const { data: { user } } = await m.default.auth.getUser();
    
    if (user) {
      const res = await getIntegrationStatuses(user.id);
      setStatuses(res);
      setLoading(false);
    } else {
      // If user is null, wait for the silent auth to finish
      const { data: authListener } = m.default.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const res = await getIntegrationStatuses(session.user.id);
          setStatuses(res);
          setLoading(false);
          authListener.subscription.unsubscribe();
        }
      });
    }
  };

  // ─── iOS-only OAuth config (expo-auth-session) ────────────────────────
  // Android uses @react-native-google-signin/google-signin (native Play Services)
  // which bypasses all web OAuth redirect URI restrictions entirely.
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
        if (!req) return; // Wait for request to load
        if (!exchangedCodes.current.has(res.params.code)) {
          exchangedCodes.current.add(res.params.code);
          handleExchange(res.params.code, req.codeVerifier || '', integrationId);
        }
      } else if (res?.type === 'error') {
        // Track error so we don't alert multiple times for the same error object
        if (!exchangedCodes.current.has(res.error?.message || 'error')) {
          exchangedCodes.current.add(res.error?.message || 'error');
          Alert.alert('Authentication Error', res.error?.message || 'Something went wrong');
          setCurrentRequestingId(null);
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
      setCurrentRequestingId(null);
    }
  };

  /** Android-only: trigger native Google Sign-In via Play Services. */
  const handleGoogleConnectAndroid = async (integrationId: string) => {
    // Lazy require so RNGoogleSignin native module is never loaded on iOS
    const { signInWithGoogleAndroid, statusCodes } =
      require('../services/googleSignInService') as typeof import('../services/googleSignInService');
    const meta = INTEGRATIONS_META.find(m => m.id === integrationId);
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      ...(meta?.scopes || []),
    ];
    setCurrentRequestingId(integrationId);
    setLoading(true);
    try {
      const tokens = await signInWithGoogleAndroid(scopes);
      await finishGoogleConnect(tokens, integrationId);
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled — silent
      } else {
        console.error('[Android] Google Sign-In error:', err);
        Alert.alert('Connection Failed', err.message || 'Google Sign-In failed');
      }
    } finally {
      setLoading(false);
      setCurrentRequestingId(null);
    }
  };


  /** Shared post-auth logic for both iOS and Android. */
  const finishGoogleConnect = async (tokens: { accessToken: string; refreshToken: string | null; expiresIn: number; email: string; name?: string; picture?: string | null }, integrationId: string) => {
    await saveEmailAccount(tokens.email, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);

    // Persist name + picture into Supabase auth metadata if not already set
    if (tokens.name || tokens.picture) {
      import('../lib/supabase').then(async (m) => {
        const { data: { user } } = await m.default.auth.getUser();
        const meta = user?.user_metadata ?? {};
        const updates: Record<string, string> = {};
        if (tokens.name && !meta.display_name && !meta.full_name) updates.full_name = tokens.name;
        if (tokens.picture && !meta.avatar_url) updates.avatar_url = tokens.picture;
        if (Object.keys(updates).length > 0) await m.default.auth.updateUser({ data: updates });
      }).catch(() => { /* non-blocking */ });
    }

    // Update integration consent to connected
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



  const handleToggle = async (id: string, isConnected: boolean) => {
    if (isConnected) {
      const doDisconnect = async () => {
        setLoading(true);
        await revokeIntegration(id);
        await loadStatuses();
        setLoading(false);
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
      const googleIntegrations = ['gmail', 'calendar', 'contacts'];
      if (googleIntegrations.includes(id)) {
        if (Platform.OS === 'android') {
          // Android: native Google Play Services sign-in (no redirect URI restrictions)
          await handleGoogleConnectAndroid(id);
          return;
        }
        // iOS: expo-auth-session with native iOS client
        if (id === 'gmail') {
          setCurrentRequestingId('gmail');
          gmailPrompt();
        } else if (id === 'calendar') {
          setCurrentRequestingId('calendar');
          calPrompt();
        } else if (id === 'contacts') {
          setCurrentRequestingId('contacts');
          contactsPrompt();
        }
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

        if (!mobileNumber) {
          // User cancelled the prompt
          return;
        }

        // Clean up the number just in case they added spaces or +91
        mobileNumber = mobileNumber.replace(/\D/g, '');
        if (mobileNumber.length > 10) {
          mobileNumber = mobileNumber.slice(-10); // get last 10 digits
        }

        setLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('aa-create-consent', {
            body: { userId: user.id, fiTypes: ['DEPOSIT'], vua: mobileNumber }
          });
          
          let responseData = data;
          if (error) {
            // Supabase returns error on 400 status. Try to extract our custom JSON body
            try {
              if (error.context && typeof error.context.json === 'function') {
                responseData = await error.context.json();
              } else if (error.context) {
                responseData = typeof error.context === 'string' ? JSON.parse(error.context) : error.context;
              }
            } catch (e) {
              console.log("Could not parse error context:", e);
            }
            if (!responseData?.isSetuError) {
              throw error; // Rethrow if it wasn't our controlled Setu error
            }
          }

          console.log("Supabase edge function response:", responseData, error);
          if (responseData?.isSetuError) {
            console.error("\n\n❌ [SETU API ERROR] ❌\n", responseData.error, "\n\n");
            throw new Error(responseData.error);
          }
          if (responseData?.url) {
            // Open the Setu consent browser. This resolves when the user closes/returns from the browser.
            await WebBrowser.openBrowserAsync(responseData.url);
            
            // After browser closes, Setu sends a server-to-server webhook which updates our DB.
            // Poll for up to 10 seconds for the status to flip to 'connected'.
            let connected = false;
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              await loadStatuses();
              const m = await import('../lib/supabase');
              const { data: { user: u } } = await m.default.auth.getUser();
              if (u) {
                const freshStatuses = await getIntegrationStatuses(u.id);
                setStatuses(freshStatuses);
                if (freshStatuses['bank_account']?.status === 'connected') {
                  connected = true;
                  break;
                }
              }
            }
            if (!connected) {
              // Reload one final time regardless
              await loadStatuses();
            }
          }
        } catch (err: any) {
          console.error("Setu API frontend error:", err.message);
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
        // Vault and Business Card might just be enabled directly
        import('../lib/supabase').then(async (m) => {
          const { data: { user } } = await m.default.auth.getUser();
          if (user) {
            await m.default.from('integration_consents').upsert({
              user_id: user.id,
              integration: id,
              status: 'connected',
              connected_at: new Date().toISOString() }, { onConflict: 'user_id,integration' });
            await loadStatuses();
          }
        });
      }
    }
  };

  const handleRetry = async (id: string) => {
    setLoading(true);
    const success = await retrySync(id);
    if (success) {
      Alert.alert('Success', 'Sync completed successfully');
    } else {
      Alert.alert('Failed', 'Sync failed again. Please try reconnecting.');
    }
    await loadStatuses();
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

        <View style={styles.headerTextContainer}>
          <Text style={styles.screenTitle}>Integrations Hub</Text>
          <Text style={styles.screenSubtitle}>Manage and sync your data across platforms</Text>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>


          {INTEGRATIONS_META.map(item => {
            const statusObj = statuses[item.id];
            const isConnected = statusObj?.status === 'connected' || statusObj?.status === 'error';
            const isError = statusObj?.status === 'error';

            return (
              <GlassCard key={item.id} borderRadius={16} style={styles.card}>
                <View style={styles.integrationRow}>
                  <View style={styles.iconSquare}>
                    {['document_vault', 'business_card', 'bank_account', 'credit_report'].includes(item.id) ? (
                      <StitchIcon 
                        name={item.id === 'document_vault' ? 'folder' : item.id === 'business_card' ? 'badge' : item.id === 'bank_account' ? 'account_balance' : 'bar_chart'} 
                        size={24} color={Colors.primary} />
                    ) : (
                      <Text style={styles.integrationIcon}>{item.icon}</Text>
                    )}
                  </View>
                  
                  <View style={styles.integrationText}>
                    <Text style={styles.integrationLabel}>{item.label}</Text>
                    {isConnected && statusObj?.last_synced_at && (
                      <Text style={styles.integrationStatus}>
                        Last synced: {new Date(statusObj.last_synced_at).toLocaleString()}
                      </Text>
                    )}
                    {isError && (
                      <Text style={styles.errorText}>
                        Error: {statusObj?.last_sync_error}
                      </Text>
                    )}
                    {!isConnected && (
                      <Text style={styles.integrationStatus}>
                        {item.id === 'gmail' ? 'Sync emails and attachments' 
                         : item.id === 'calendar' ? 'Sync calendar events'
                         : item.id === 'contacts' ? 'Sync your contacts'
                         : item.id === 'document_vault' ? 'Secure storage for your documents'
                         : item.id === 'business_card' ? 'Scan and manage business cards'
                         : item.id === 'bank_account' ? 'Connect and monitor your accounts'
                         : item.id === 'credit_report' ? 'Track and monitor your credit health'
                         : 'Sync your data'}
                      </Text>
                    )}
                  </View>
                  <Switch
                    value={isConnected}
                    onValueChange={() => handleToggle(item.id, isConnected)}
                    trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primary }}
                    thumbColor={'#ffffff'}
                    ios_backgroundColor={Colors.surfaceContainerHigh}
                    style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                  />
                </View>
                {isError && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => handleRetry(item.id)}>
                      <Text style={styles.retryBtnText}>Retry Sync</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </GlassCard>
            );
          })}
        </ScrollView>

        {phonePromptVisible && (
          <Modal visible transparent animationType="fade">
            <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'}}>
              <View style={{backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.md, width: '85%'}}>
                <Text style={{color: Colors.onSurface, fontSize: 18, fontWeight: 'bold', marginBottom: Spacing.sm}}>Mobile Number Required</Text>
                <Text style={{color: Colors.onSurfaceVariant, marginBottom: Spacing.md}}>Please enter your 10-digit mobile number for Setu linking.</Text>
                <TextInput
                  style={{backgroundColor: Colors.background, color: Colors.onSurface, padding: Spacing.md, borderRadius: Radius.sm, marginBottom: Spacing.lg}}
                  keyboardType="phone-pad"
                  placeholder="Enter mobile number"
                  placeholderTextColor={Colors.onSurfaceVariant}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                />
                <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md}}>
                  <TouchableOpacity onPress={() => { setPhonePromptVisible(false); phonePromptResolve?.(null); setPhoneInput(''); }}>
                    <Text style={{color: Colors.onSurfaceVariant, fontSize: 16}}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setPhonePromptVisible(false); phonePromptResolve?.(phoneInput); setPhoneInput(''); }}>
                    <Text style={{color: Colors.primary, fontSize: 16, fontWeight: 'bold'}}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
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
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100, gap: Spacing.md },
  


  card: {
    padding: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  integrationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconSquare: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  integrationIcon: { fontSize: 24, textAlign: 'center' },
  integrationText: { flex: 1, gap: 2 },
  integrationLabel: { ...typography.bodyLg, fontWeight: '600', color: Colors.onSurface },
  integrationStatus: { ...typography.bodySm, color: Colors.onSurfaceVariant },
  errorText: { ...typography.labelSm, color: Colors.error },
  actionRow: { marginTop: Spacing.md, alignItems: 'flex-end' },
  retryBtn: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.lg },
  retryBtnText: { color: Colors.onSecondary, ...typography.labelSm, fontWeight: '600' },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10, 15, 29, 0.6)',
    justifyContent: 'center', alignItems: 'center', zIndex: 999 
  } 
});
