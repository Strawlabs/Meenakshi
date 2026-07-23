import { useAppTheme } from '../context/ThemeContext';
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
  Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius} from '../constants/theme';
import GlassCard from '../components/GlassCard';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import supabase from '../lib/supabase';
import { discovery, exchangeCodeForTokens, saveEmailAccount } from '../services/gmailAuthService';
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

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'meenakshi' });
  console.log('OAuth Redirect URI generated:', redirectUri);

  const baseConfig = {
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
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
      await saveEmailAccount(tokens.email, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
      
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
          
          // Trigger the initial sync in the background
          retrySync(integrationId).then(() => {
            loadStatuses(); // Refresh UI after sync completes
          });
        }
      });
      Alert.alert('Success', `${integrationId} connected and syncing in background.`);
    } catch (err: any) {
      console.error('OAuth exchange error:', err);
      Alert.alert('Connection Failed', err.message);
    } finally {
      setLoading(false);
      setCurrentRequestingId(null);
    }
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
      if (id === 'gmail') {
        setCurrentRequestingId('gmail');
        gmailPrompt();
      } else if (id === 'calendar') {
        setCurrentRequestingId('calendar');
        calPrompt();
      } else if (id === 'contacts') {
        setCurrentRequestingId('contacts');
        contactsPrompt();
      } else if (id === 'bank_account') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert("Error", "Not logged in");
          return;
        }

        let mobileNumber = user.phone || user.user_metadata?.phone;

        if (!mobileNumber) {
          if (Platform.OS === 'ios') {
            mobileNumber = await new Promise<string | null>((resolve) => {
              Alert.prompt(
                "Mobile Number Required",
                "Please enter your 10-digit mobile number for Setu Account Aggregator linking.",
                [
                  { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
                  { text: "Continue", onPress: (text?: string) => resolve(text || null) }
                ],
                "plain-text",
                "",
                "phone-pad"
              );
            });
          } else if (Platform.OS === 'web') {
            mobileNumber = window.prompt("Please enter your 10-digit mobile number for Setu Account Aggregator linking:");
          } else {
            Alert.alert("Error", "Please update your profile with a mobile number to continue.");
            return;
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Integrations Hub</Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {INTEGRATIONS_META.map(item => {
          const statusObj = statuses[item.id];
          const isConnected = statusObj?.status === 'connected' || statusObj?.status === 'error';
          const isError = statusObj?.status === 'error';

          return (
            <GlassCard key={item.id} style={styles.card}>
              <View style={styles.integrationRow}>
                <Text style={styles.integrationIcon}>{item.icon}</Text>
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
                    <Text style={styles.integrationStatus}>Not connected</Text>
                  )}
                </View>
                <Switch
                  value={isConnected}
                  onValueChange={() => handleToggle(item.id, isConnected)}
                  trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.secondary }}
                  thumbColor={isConnected ? Colors.secondaryContainer : Colors.outline}
                  ios_backgroundColor={Colors.surfaceContainerHigh}
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
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  backBtn: { marginBottom: 8 },
  backText: { ...typography.bodyMd, color: Colors.onSurfaceVariant },
  screenTitle: { ...typography.headlineLgMobile, color: Colors.onSurface },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100, gap: Spacing.md },
  card: {
    padding: Spacing.md },
  integrationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  integrationIcon: { fontSize: 28, width: 40, textAlign: 'center' },
  integrationText: { flex: 1, gap: 4 },
  integrationLabel: { ...typography.bodyMd, fontWeight: '600', color: Colors.onSurface },
  integrationStatus: { ...typography.labelSm, color: Colors.outline },
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
    justifyContent: 'center', alignItems: 'center', zIndex: 999 } });
