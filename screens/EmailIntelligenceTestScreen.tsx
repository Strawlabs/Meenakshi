import React, { useState } from 'react';
import { View, Text, Button, ScrollView, ActivityIndicator, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { mockEmails } from '../data/mockEmails';
import { classifyAllEmails } from '../services/emailIntelligence';
import { mergeDuplicateEvents } from '../services/duplicateDetector';
import { saveFinancialEvent } from '../services/memoryService';
import supabase from '../lib/supabase';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

export default function EmailIntelligenceTestScreen() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const runTest = async () => {
    setLoading(true);
    try {
      const classified = await classifyAllEmails(mockEmails);
      const merged = mergeDuplicateEvents(classified);
      setResults(merged);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to classify');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (item: any, index: number) => {
    setSaving(prev => ({ ...prev, [index]: true }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Not Logged In', 'Please make sure you are authenticated in Supabase.');
        return;
      }
      await saveFinancialEvent(user.id, item);
      Alert.alert('Saved', 'Saved event to entities table!');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Error saving event');
    } finally {
      setSaving(prev => ({ ...prev, [index]: false }));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        Gmail Intelligence Pipeline Test
      </Text>
      <Button title="Test Email Classification & Merge" onPress={runTest} color={Colors.secondary} />
      {loading && <ActivityIndicator color={Colors.secondary} style={styles.loader} />}
      {results.map((r, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.categoryBadge}>{r.category.toUpperCase()}</Text>
            {r.duplicateCount > 1 && (
              <View style={styles.duplicateBadgeWrap}>
                <Text style={styles.duplicateBadgeText}>Merged {r.duplicateCount} duplicates</Text>
              </View>
            )}
          </View>
          <Text style={styles.summary}>{r.summary}</Text>
          <Text style={styles.details}>Amount: ₹{r.amount || 'N/A'} | Due: {r.dueDate || 'N/A'}</Text>
          
          <TouchableOpacity 
            style={styles.saveBtn}
            onPress={() => handleSave(r, i)}
            disabled={saving[i]}
          >
            {saving[i] ? (
              <ActivityIndicator size="small" color={Colors.onSecondary} />
            ) : (
              <Text style={styles.saveBtnText}>Save to Supabase</Text>
            )}
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
  },
  content: {
    paddingBottom: 50,
  },
  title: {
    ...Typography.headlineLgMobile,
    color: Colors.primary,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  loader: {
    marginTop: Spacing.containerMobile,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    ...Typography.labelSm,
    color: Colors.secondary,
  },
  duplicateBadgeWrap: {
    backgroundColor: Colors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  duplicateBadgeText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  summary: {
    ...Typography.bodyMd,
    fontWeight: '600',
    color: Colors.onSurface,
    marginTop: Spacing.sm,
  },
  details: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: Colors.secondary,
    padding: 10,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  saveBtnText: {
    ...Typography.labelSm,
    color: Colors.onSecondary,
  },
});
