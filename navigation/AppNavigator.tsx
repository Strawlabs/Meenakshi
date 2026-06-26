import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, FontSize } from '../constants/theme';

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

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Onboarding: undefined;
  Main: undefined;
  Chat: { initialQuery?: string; scannedCardBase64?: string };
  Voice: undefined;
  Settings: undefined;
  BusinessCard: {
    origin?: 'chat';
    editContactId?: string;
    editContactData?: {
      name: string;
      designation?: string;
      organization?: string;
      email?: string;
      phone?: string;
      address?: string;
      notes?: string;
    };
  } | undefined;
  ContactProfile: { contactId: string };
};

export type TabParamList = {
  Home: undefined;
  Memory: undefined;
  _Spacer: undefined;
  Finance: undefined;
  Circles: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Stitch tab icons
const TAB_ICONS: Record<string, { icon: string; label: string }> = {
  Home: { icon: '⌂', label: 'Home' },
  Memory: { icon: '📚', label: 'Memory' },
  _Spacer: { icon: '', label: '' },
  Finance: { icon: '💳', label: 'Wealth' },
  Circles: { icon: '👥', label: 'Circles' },
};

function TabIcon({
  name,
  focused,
}: {
  name: string;
  focused: boolean;
}) {
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
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <RelationshipsScreen />
    </View>
  );
}

function SpacerScreen() {
  return null;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: `${Colors.onSurfaceVariant}99`,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
      })}
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

export default function AppNavigator() {
  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const Radius_xl = 16;

const styles = StyleSheet.create({
  // Stitch bottom nav:
  // bg-surface/80 backdrop-blur, border-t border-white/30
  // h-20, rounded-t-xl
  tabBar: {
    backgroundColor: `${Colors.surface}CC`, // 80% opacity
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    height: Platform.OS === 'ios' ? 88 : 72,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    borderTopLeftRadius: Radius_xl,
    borderTopRightRadius: Radius_xl,
    position: 'absolute',
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tabIconWrapActive: {
    backgroundColor: `${Colors.secondary}1A`, // secondary/10
  },
  tabIconText: {
    fontSize: 22,
    color: `${Colors.onSurfaceVariant}99`,
  },
  tabIconFocused: {
    color: Colors.secondary,
  },
  tabIconLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: `${Colors.onSurfaceVariant}99`,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  tabIconLabelFocused: {
    color: Colors.secondary,
  },
  spacer: { width: 48 },
});
