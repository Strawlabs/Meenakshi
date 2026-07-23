import { useAppTheme } from '../context/ThemeContext';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { FontSize } from '../constants/theme';

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
  Home: { icon: '⌂', label: 'Home' },
  Memory: { icon: '📚', label: 'Memory' },
  _Spacer: { icon: '', label: '' },
  Finance: { icon: '💳', label: 'Wealth' },
  Circles: { icon: '👥', label: 'Circles' } };

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
      <Text style={[styles.tabIconText, focused && styles.tabIconFocused]}>
        {tab.icon}
      </Text>
      <Text
        style={[styles.tabIconLabel, focused && styles.tabIconLabelFocused]}
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

function SpacerScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = getStyles(Colors);

  return null;
}

function MainTabs() {
  const { colors: Colors, typography, isDark } = useAppTheme();
  const styles = getStyles(Colors, typography);

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
            intensity={20} 
            tint={isDark ? 'dark' : 'light'} 
            style={StyleSheet.absoluteFill} 
          />
        ),
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ) })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Memory" component={MemoryScreen} />
      {/* Center spacer — Stitch has a floating orb in the center on home screen */}
      <Tab.Screen
        name="_Spacer"
        component={SpacerScreen}
        options={{ tabBarButton: () => <View style={styles.spacer} /> }}
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

const getStyles = (Colors: any, typography?: any) => StyleSheet.create({
  // Stitch bottom nav:
  // bg-surface/80 backdrop-blur, border-t border-white/30
  // h-20, rounded-t-xl
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: Colors.inversePrimary || 'rgba(255,255,255,0.3)',
    height: Platform.OS === 'ios' ? 88 : 72,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    borderTopLeftRadius: Radius_xl,
    borderTopRightRadius: Radius_xl,
    position: 'absolute',
    elevation: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12 },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 8,
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
  spacer: { width: 48 } });
