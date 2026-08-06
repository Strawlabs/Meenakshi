import { useAppTheme } from '../context/ThemeContext';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { FontSize } from '../constants/theme';
import StitchIcon from '../components/StitchIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import VoiceScreen from '../screens/VoiceScreen';
import FinanceScreen from '../screens/FinanceScreen';
import RelationshipsScreen from '../screens/RelationshipsScreen';
import MemoryScreen from '../screens/MemoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BusinessCardScreen from '../screens/BusinessCardScreen';
import ContactProfileScreen from '../screens/ContactProfileScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import DocumentDetailScreen from '../screens/DocumentDetailScreen';
import IntegrationsScreen from '../screens/IntegrationsScreen';

import { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Stitch tab icons
const TAB_ICONS: Record<string, { icon: string; label: string }> = {
  Home: { icon: 'home', label: 'Home' },
  Memory: { icon: 'history_edu', label: 'Memory' },
  Finance: { icon: 'account_balance_wallet', label: 'Wealth' },
  Circles: { icon: 'group', label: 'Circles' },
};

function TabIcon({
  name,
  focused }: {
  name: string;
  focused: boolean;
}) {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const tab = TAB_ICONS[name];
  if (!tab || name === '_Spacer') return null;

  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <StitchIcon 
        name={tab.icon as any} 
        size={24} 
        color={focused ? Colors.secondary : `${Colors.onSurfaceVariant}99`} 
      />
      <Text
        style={[styles.tabIconLabel, focused && styles.tabIconLabelFocused]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {tab.label}
      </Text>
    </View>
  );
}

// Placeholder for Circles tab
function CirclesScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = getStyles(Colors);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <RelationshipsScreen />
    </View>
  );
}

// Center Chat FAB button embedded in the tab bar
function CenterChatButton() {
  const { colors: Colors } = useAppTheme();
  const styles = getStyles(Colors);
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      style={styles.centerTabBtn}
      onPress={() => navigation.navigate('Chat')}
      activeOpacity={0.85}
    >
      <View style={styles.centerTabOrb}>
        <Text style={styles.centerTabOrbIcon}>✦</Text>
      </View>
      <Text style={styles.centerTabLabel}>AI</Text>
    </TouchableOpacity>
  );
}

function SpacerScreen() {
  return null;
}

function MainTabs() {
  const { colors: Colors, typography, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Ensure a minimum bottom padding of 12 for devices with gesture navigation
  const bottomInset = Math.max(insets.bottom, 12);
  const styles = getStyles(Colors, typography, bottomInset);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: `${Colors.onSurfaceVariant}99`,
        tabBarBackground: () => (
          <BlurView 
            intensity={Platform.OS === 'android' ? 100 : 80}
            tint={isDark ? 'dark' : 'light'}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill} 
          />
        ),
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ) })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Memory" component={MemoryScreen} />
      {/* Center Chat FAB button */}
      <Tab.Screen
        name="_Spacer"
        component={SpacerScreen}
        options={{ tabBarButton: () => <CenterChatButton /> }}
      />
      <Tab.Screen name="Finance" component={FinanceScreen} />
      <Tab.Screen name="Circles" component={CirclesScreen} />
    </Tab.Navigator>
  );
}

import * as Linking from 'expo-linking';

// ... (Rest of imports remain the same up to AppNavigator)

export default function AppNavigator() {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const linking = {
    prefixes: [Linking.createURL('/'), 'meenakshi://'],
    config: {
      screens: {
        Integrations: 'integrations/aa-callback',
        // Other screens can be mapped here if needed
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Voice"
          component={VoiceScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="BusinessCard"
          component={BusinessCardScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="ContactProfile"
          component={ContactProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Documents"
          component={DocumentsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DocumentDetail"
          component={DocumentDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Integrations"
          component={IntegrationsScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const Radius_xl = 16;

const getStyles = (Colors: any, typography?: any, bottomInset: number = 0) => StyleSheet.create({
  // Stitch bottom nav:
  // bg-surface/80 backdrop-blur, border-t border-white/30
  // h-20, rounded-t-xl
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: Colors.inversePrimary || 'rgba(255,255,255,0.3)',
    height: 64 + bottomInset,
    paddingBottom: bottomInset,
    paddingTop: 8,
    borderTopLeftRadius: Radius_xl,
    borderTopRightRadius: Radius_xl,
    position: 'absolute',
    elevation: 0,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12 },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 56,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 20 },
  tabIconWrapActive: {
    backgroundColor: `${Colors.secondary}1A`, // secondary/10
  },
  tabIconText: {
    fontSize: 22,
    color: `${Colors.onSurfaceVariant}99` },
  tabIconFocused: {
    color: Colors.secondary },
  tabIconLabel: {
    fontFamily: typography?.labelSm?.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    color: `${Colors.onSurfaceVariant}99`,
    letterSpacing: 0.3,
    marginTop: 2 },
  tabIconLabelFocused: {
    color: Colors.secondary },
  // Center Chat FAB
  centerTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
    gap: 3,
    marginTop: -20 },
  centerTabOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 8 },
  centerTabOrbIcon: {
    fontSize: 22,
    color: Colors.onSecondary },
  centerTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
    letterSpacing: 0.5,
    marginTop: 2 } });

