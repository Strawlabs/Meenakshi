import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import supabase from '../lib/supabase';
import { getDocumentById, Document, DocumentObligation, DocumentKeyDate, DocumentAction, DocumentEntity } from '../services/documentService';
import { askDocumentQuestion, getDocumentQAHistory, QASession } from '../services/documentQAService';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, Radius, Typography, FontSize } from '../constants/theme';

type RouteType = RouteProp<RootStackParamList, 'DocumentDetail'>;

const TYPE_LABELS: Record<string, string> = {
  salary_slip: 'Salary Slip',
  bank_statement: 'Bank Statement',
  insurance: 'Insurance',
  rent_agreement: 'Rent / Lease',
  loan: 'Loan',
  other: 'Other',
};

const TYPE_ICONS: Record<string, string> = {
  salary_slip: '💰',
  bank_statement: '🏦',
  insurance: '🛡️',
  rent_agreement: '🏠',
  loan: '🏛️',
  other: '📄',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatAmount(amount: number | null) {
  if (!amount) return null;
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function getDueDateStyle(due: string | null) {
  if (!due) return {};
  const now = new Date();
  const dueDate = new Date(due);
  const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return { backgroundColor: Colors.errorContainer, color: Colors.onErrorContainer };
  if (diffDays <= 7) return { backgroundColor: '#fff3cd', color: '#856404' };
  return { backgroundColor: Colors.tertiaryFixed, color: Colors.onTertiaryFixed };
}

function getPriorityStyle(priority: string) {
  if (priority === 'high') return { bg: Colors.errorContainer, text: Colors.onErrorContainer };
  if (priority === 'medium') return { bg: '#fff3cd', text: '#856404' };
  return { bg: Colors.tertiaryFixed, text: Colors.onTertiaryFixed };
}

function getEntityStyle(type: string) {
  if (type === 'org') return { bg: Colors.secondaryFixed, text: Colors.onSecondaryFixed };
  if (type === 'person') return { bg: Colors.primaryFixed, text: Colors.onPrimaryFixed };
  if (type === 'amount') return { bg: Colors.tertiaryFixed, text: Colors.onTertiaryFixed };
  return { bg: Colors.surfaceContainerHigh, text: Colors.onSurface };
}

function TypingDots() {
  const dots = [0, 200, 400].map(delay => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      ).start();
    }, []);
    return anim;
  });
  return (
    <View style={styles.typingDots}>
      {dots.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function DocumentDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { documentId } = route.params;

  const [doc, setDoc] = useState<Document | null>(null);
  const [qaHistory, setQaHistory] = useState<QASession[]>([]);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const [docData, history] = await Promise.all([
        getDocumentById(documentId),
        getDocumentQAHistory(documentId),
      ]);
      setDoc(docData);
      setQaHistory(history);
      setLoading(false);
    })();
  }, [documentId]);

  async function handleAsk() {
    if (!question.trim() || isAsking || !userId) return;
    const q = question.trim();
    setQuestion('');
    setIsAsking(true);

    // Optimistically append the question
    const tempQ: QASession = {
      id: `temp-${Date.now()}`,
      document_id: documentId,
      question: q,
      answer: '',
      asked_at: new Date().toISOString(),
    };
    setQaHistory(prev => [...prev, tempQ]);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    const answer = await askDocumentQuestion(documentId, userId, q);

    setQaHistory(prev =>
      prev.map(s => s.id === tempQ.id ? { ...s, answer } : s)
    );
    setIsAsking(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Loading document…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!doc) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingCenter}>
          <Text style={styles.errorText}>Document not found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const docIcon = TYPE_ICONS[doc.document_type || 'other'] || '📄';
  const docTypeLabel = TYPE_LABELS[doc.document_type || 'other'] || 'Document';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.ornamentTopRight} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{doc.file_name}</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── SECTION 1: Summary Card ── */}
          <View style={styles.card}>
            {/* Doc type header */}
            <View style={styles.cardHeader}>
              <View style={styles.docIconWrap}>
                <Text style={styles.docIcon}>{docIcon}</Text>
              </View>
              <View style={styles.cardHeaderText}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{docTypeLabel}</Text>
                </View>
                <Text style={styles.uploadDate}>Uploaded {formatDate(doc.uploaded_at)}</Text>
              </View>
            </View>

            {/* Summary */}
            {doc.summary && (
              <Text style={styles.summaryText}>{doc.summary}</Text>
            )}

            {/* Key Dates */}
            {Array.isArray(doc.key_dates) && doc.key_dates.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>📅 Key Dates</Text>
                {(doc.key_dates as DocumentKeyDate[]).map((kd, i) => (
                  <View key={i} style={styles.dateRow}>
                    <View style={styles.dateLabelWrap}>
                      <Text style={styles.dateLabelText}>{kd.label}</Text>
                    </View>
                    <View style={styles.dateValueWrap}>
                      <Text style={styles.dateValue}>{formatDate(kd.date)}</Text>
                      {kd.description && (
                        <Text style={styles.dateDesc}>{kd.description}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Obligations */}
            {Array.isArray(doc.obligations) && doc.obligations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>💳 Obligations</Text>
                {(doc.obligations as DocumentObligation[]).map((ob, i) => {
                  const duStyle = getDueDateStyle(ob.due_date || null);
                  return (
                    <View key={i} style={styles.obligationRow}>
                      <Text style={styles.obligationDesc}>{ob.description}</Text>
                      <View style={styles.obligationMeta}>
                        {ob.amount != null && (
                          <Text style={styles.obligationAmount}>{formatAmount(ob.amount)}</Text>
                        )}
                        {ob.due_date && (
                          <View style={[styles.dueDateChip, { backgroundColor: (duStyle as any).backgroundColor }]}>
                            <Text style={[styles.dueDateChipText, { color: (duStyle as any).color }]}>
                              Due {formatDate(ob.due_date)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Actions */}
            {Array.isArray(doc.actions) && doc.actions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>⚡ Recommended Actions</Text>
                <View style={styles.actionsWrap}>
                  {(doc.actions as DocumentAction[]).map((ac, i) => {
                    const p = getPriorityStyle(ac.priority);
                    return (
                      <View key={i} style={[styles.actionChip, { backgroundColor: p.bg }]}>
                        <Text style={[styles.actionChipText, { color: p.text }]}>{ac.action}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* ── SECTION 2: Entities ── */}
          {Array.isArray(doc.entities) && doc.entities.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>🔍 Extracted Entities</Text>
              <View style={styles.entitiesGrid}>
                {(doc.entities as DocumentEntity[]).map((en, i) => {
                  const s = getEntityStyle(en.type);
                  return (
                    <View key={i} style={[styles.entityChip, { backgroundColor: s.bg }]}>
                      <Text style={[styles.entityName, { color: s.text }]}>{en.name}</Text>
                      <Text style={[styles.entityType, { color: s.text }]}>{en.type}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── SECTION 3: Q&A History ── */}
          {qaHistory.length > 0 && (
            <View style={styles.qaSection}>
              <Text style={styles.sectionLabel}>💬 Document Q&A</Text>
              {qaHistory.map((qa, i) => (
                <View key={qa.id || i}>
                  {/* User question bubble */}
                  <View style={styles.msgRowUser}>
                    <View style={styles.bubbleUser}>
                      <Text style={styles.bubbleTextUser}>{qa.question}</Text>
                    </View>
                  </View>
                  {/* Meenakshi answer bubble */}
                  <View style={styles.msgRowModel}>
                    <View style={styles.modelAvatar}>
                      <Text style={styles.modelAvatarText}>✦</Text>
                    </View>
                    <View style={styles.bubbleModel}>
                      {qa.answer ? (
                        <Text style={styles.bubbleText}>{qa.answer}</Text>
                      ) : (
                        <TypingDots />
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Spacer so content clears input bar */}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── Sticky Q&A input bar ── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask about this document…"
            placeholderTextColor={`${Colors.onSurfaceVariant}80`}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleAsk}
            blurOnSubmit={false}
            editable={!isAsking}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!question.trim() || isAsking) && styles.sendBtnDisabled]}
            onPress={handleAsk}
            disabled={!question.trim() || isAsking}
          >
            {isAsking ? (
              <ActivityIndicator size="small" color={Colors.onSecondary} />
            ) : (
              <Text style={styles.sendBtnText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  ornamentTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.secondary,
    opacity: 0.05,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.sm,
    backgroundColor: `${Colors.surface}B3`,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
  },
  headerBtnText: { fontSize: 24, color: Colors.onSurface, fontWeight: '300' },
  headerTitle: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.lg,
    paddingBottom: 16,
    gap: Spacing.md,
  },
  // Loading/error
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  errorText: { ...Typography.bodyMd, color: Colors.error, fontWeight: '600' },
  backLink: { ...Typography.bodyMd, color: Colors.secondary, fontWeight: '600' },
  // Card
  card: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  docIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIcon: { fontSize: 24 },
  cardHeaderText: { flex: 1, gap: 4 },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSecondary,
    letterSpacing: 0.3,
  },
  uploadDate: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  summaryText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    lineHeight: 24,
  },
  // Section label
  sectionLabel: {
    fontSize: FontSize.labelSm,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  section: { gap: Spacing.sm },
  // Key dates
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  dateLabelWrap: {
    width: 110,
  },
  dateLabelText: {
    ...Typography.labelSm,
    color: Colors.secondary,
    fontWeight: '700',
  },
  dateValueWrap: { flex: 1, gap: 2 },
  dateValue: {
    ...Typography.bodyMd,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  dateDesc: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  // Obligations
  obligationRow: {
    gap: 6,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  obligationDesc: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  obligationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  obligationAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary,
  },
  dueDateChip: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dueDateChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Actions
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionChip: {
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  // Entities
  entitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  entityChip: {
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    alignItems: 'center',
  },
  entityName: {
    fontSize: 13,
    fontWeight: '700',
  },
  entityType: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  // Q&A
  qaSection: { gap: Spacing.sm },
  msgRowUser: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: Spacing.sm },
  msgRowModel: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginBottom: Spacing.sm },
  modelAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  modelAvatarText: { fontSize: 11, color: Colors.onSecondary },
  bubbleUser: {
    maxWidth: '78%',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  bubbleTextUser: { ...Typography.bodyMd, color: Colors.onSecondary },
  bubbleModel: {
    maxWidth: '78%',
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  bubbleText: { ...Typography.bodyMd, color: Colors.onSurface },
  typingDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.secondary },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    backgroundColor: `${Colors.surface}B3`,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.secondary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: Colors.surfaceContainerHighest },
  sendBtnText: { ...Typography.bodyLg, fontWeight: '700', color: Colors.onSecondary },
});
