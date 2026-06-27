import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

const INTEGRATIONS = [
  {
    id: 'gmail',
    icon: '✉️',
    title: 'Gmail',
    description: 'Financial emails, statements & follow-ups',
    color: '#EA4335',
  },
  {
    id: 'calendar',
    icon: '📅',
    title: 'Google Calendar',
    description: 'Meeting context & payment reminders',
    color: '#4285F4',
  },
  {
    id: 'contacts',
    icon: '👥',
    title: 'Google Contacts',
    description: 'Relationship memory & follow-up tracking',
    color: '#34A853',
  },
  {
    id: 'wealth',
    icon: '🏦',
    title: 'Account Aggregator',
    description: 'Bank statements & financial intelligence',
    color: '#FBBC04',
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    gmail: false,
    calendar: false,
    contacts: false,
    wealth: false,
  });

  const toggle = (id: string) => {
    setEnabled(prev => ({ ...prev, [id]: !prev[id] }));
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.primaryContainer,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: 40,
    paddingBottom: 20,
  },
  glow: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.purple,
    opacity: 0.15,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
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
    elevation: 8,
  },
  orbIcon: {
    fontSize: 22,
    color: Colors.onPrimary,
  },
  title: {
    ...Typography.headlineLgMobile,
    color: Colors.onPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodyMd,
    color: Colors.onPrimaryContainer,
    textAlign: 'center',
    maxWidth: 300,
  },
  list: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Dark glass panel style
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  cardDesc: {
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
    lineHeight: 17,
  },
  progressNote: {
    backgroundColor: 'rgba(107, 56, 212, 0.15)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(107, 56, 212, 0.3)',
    padding: Spacing.md,
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  progressText: {
    ...Typography.bodyMd,
    color: Colors.primaryFixedDim,
    textAlign: 'center',
    fontWeight: '600',
  },
  cta: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
    alignItems: 'center',
  },
  ctaBtn: {
    width: '100%',
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ctaBtnActive: {
    backgroundColor: Colors.onPrimary,
    borderColor: Colors.onPrimary,
  },
  ctaBtnText: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  ctaBtnTextActive: {
    color: Colors.primaryContainer,
  },
  legalText: {
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
    textAlign: 'center',
  },
});
