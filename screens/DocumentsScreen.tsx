import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import supabase from '../lib/supabase';
import {
  uploadDocument,
  processDocument,
  getUserDocuments,
  deleteDocument,
  Document,
} from '../services/documentService';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, Radius, Typography, FontSize } from '../constants/theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const DOC_TYPES = ['All', 'salary_slip', 'bank_statement', 'insurance', 'rent_agreement', 'loan', 'other'];

const TYPE_LABELS: Record<string, string> = {
  All: 'All',
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

function getDocIcon(docType: string | null) {
  return TYPE_ICONS[docType || 'other'] || '📄';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function DocumentsScreen() {
  const navigation = useNavigation<NavProp>();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filtered, setFiltered] = useState<Document[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await loadDocuments(user.id);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (activeFilter === 'All') {
      setFiltered(documents);
    } else {
      setFiltered(documents.filter(d => d.document_type === activeFilter));
    }
  }, [activeFilter, documents]);

  async function loadDocuments(uid: string) {
    const docs = await getUserDocuments(uid);
    setDocuments(docs);
  }

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await loadDocuments(userId);
    setRefreshing(false);
  }, [userId]);

  async function handleUpload() {
    if (!userId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const { uri, name, mimeType } = asset;

      setUploading(true);

      // Upload to storage + create DB row
      const uploaded = await uploadDocument(userId, uri, name || 'document', mimeType || 'application/pdf');
      if (!uploaded) {
        Alert.alert('Upload Failed', 'Could not upload the document. Please try again.');
        setUploading(false);
        return;
      }

      // Prepend unprocessed row so user sees it immediately
      setDocuments(prev => [uploaded, ...prev]);

      // Process in background — Gemini analysis
      const processed = await processDocument(uploaded.id);
      if (processed) {
        setDocuments(prev => prev.map(d => d.id === uploaded.id ? processed : d));
      }
    } catch (err: any) {
      console.error('[DocumentsScreen] Upload error:', err);
      Alert.alert('Error', err?.message || 'Something went wrong during upload.');
    } finally {
      setUploading(false);
    }
  }

  function confirmDelete(doc: Document) {
    Alert.alert(
      'Delete Document',
      `Delete "${doc.file_name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteDocument(doc.id, doc.storage_path);
            if (ok) {
              setDocuments(prev => prev.filter(d => d.id !== doc.id));
            } else {
              Alert.alert('Error', 'Could not delete document. Please try again.');
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Background ornament */}
      <View style={styles.ornamentTopRight} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />
        }
      >
        {/* Upload Zone */}
        <TouchableOpacity
          style={[styles.uploadZone, uploading && styles.uploadZoneLoading]}
          onPress={handleUpload}
          disabled={uploading}
          activeOpacity={0.75}
        >
          {uploading ? (
            <>
              <ActivityIndicator size="large" color={Colors.secondary} />
              <Text style={styles.uploadZoneTitle}>Processing document…</Text>
              <Text style={styles.uploadZoneSub}>Meenakshi is reading your document</Text>
            </>
          ) : (
            <>
              <View style={styles.uploadIconWrap}>
                <Text style={styles.uploadIcon}>📄</Text>
              </View>
              <Text style={styles.uploadZoneTitle}>Upload Document</Text>
              <Text style={styles.uploadZoneSub}>PDF or image · Tap to choose</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {DOC_TYPES.map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, activeFilter === type && styles.filterChipActive]}
              onPress={() => setActiveFilter(type)}
            >
              <Text style={[styles.filterChipText, activeFilter === type && styles.filterChipTextActive]}>
                {type !== 'All' && `${TYPE_ICONS[type]} `}{TYPE_LABELS[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Document list */}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.secondary} style={styles.loadingSpinner} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'All' ? 'No documents yet' : `No ${TYPE_LABELS[activeFilter]} documents`}
            </Text>
            <Text style={styles.emptySub}>
              Upload your first financial document above to get AI-powered insights.
            </Text>
          </View>
        ) : (
          <View style={styles.docList}>
            {filtered.map(doc => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
                onPress={() => navigation.navigate('DocumentDetail', { documentId: doc.id })}
                onLongPress={() => confirmDelete(doc)}
                activeOpacity={0.8}
              >
                <View style={styles.docCardLeft}>
                  <View style={styles.docIconWrap}>
                    <Text style={styles.docIcon}>{getDocIcon(doc.document_type)}</Text>
                  </View>
                </View>

                <View style={styles.docCardContent}>
                  <View style={styles.docCardTop}>
                    <Text style={styles.docFileName} numberOfLines={1}>{doc.file_name}</Text>
                    {doc.document_type && (
                      <View style={styles.docTypeBadge}>
                        <Text style={styles.docTypeBadgeText}>{TYPE_LABELS[doc.document_type] || doc.document_type}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.docDate}>{formatDate(doc.uploaded_at)}</Text>

                  {!doc.processed ? (
                    <View style={styles.processingRow}>
                      <ActivityIndicator size="small" color={Colors.secondary} />
                      <Text style={styles.processingText}>Processing…</Text>
                    </View>
                  ) : doc.summary ? (
                    <Text style={styles.docSummary} numberOfLines={2}>{doc.summary}</Text>
                  ) : null}

                  {doc.processed && (
                    <View style={styles.docMetaRow}>
                      {Array.isArray(doc.obligations) && doc.obligations.length > 0 && (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>
                            {doc.obligations.length} obligation{doc.obligations.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                      {Array.isArray(doc.key_dates) && doc.key_dates.length > 0 && (
                        <View style={[styles.metaChip, styles.metaChipGreen]}>
                          <Text style={[styles.metaChipText, styles.metaChipTextGreen]}>
                            {doc.key_dates.length} key date{doc.key_dates.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <Text style={styles.docChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.longPressHint}>Long-press a document to delete</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  // Upload zone
  uploadZone: {
    borderWidth: 2,
    borderColor: Colors.secondary,
    borderStyle: 'dashed',
    borderRadius: Radius.xl,
    backgroundColor: Colors.secondaryFixed,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  uploadZoneLoading: {
    borderStyle: 'solid',
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: Colors.outlineVariant,
  },
  uploadIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  uploadIcon: { fontSize: 26 },
  uploadZoneTitle: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.onSecondaryFixed,
  },
  uploadZoneSub: {
    ...Typography.labelSm,
    color: `${Colors.onSecondaryFixed}99`,
  },
  // Filter chips
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  filterChipActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  filterChipText: {
    ...Typography.labelSm,
    color: Colors.onSurface,
  },
  filterChipTextActive: {
    color: Colors.onSecondary,
  },
  // Loading
  loadingSpinner: { marginTop: Spacing.xl },
  // Empty
  emptyCard: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.xs },
  emptyTitle: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.onSurface,
    textAlign: 'center',
  },
  emptySub: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Document list
  docList: { gap: Spacing.sm },
  docCard: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  docCardLeft: { paddingTop: 2 },
  docIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIcon: { fontSize: 22 },
  docCardContent: { flex: 1, gap: 4 },
  docCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  docFileName: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.onSurface,
    flex: 1,
  },
  docTypeBadge: {
    backgroundColor: Colors.secondaryFixed,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  docTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.onSecondaryFixed,
    letterSpacing: 0.3,
  },
  docDate: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  processingText: {
    ...Typography.labelSm,
    color: Colors.secondary,
  },
  docSummary: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    marginTop: 4,
  },
  docMetaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaChip: {
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.onErrorContainer,
  },
  metaChipGreen: {
    backgroundColor: Colors.tertiaryFixed,
  },
  metaChipTextGreen: {
    color: Colors.onTertiaryFixed,
  },
  docChevron: {
    fontSize: 22,
    color: Colors.secondary,
    opacity: 0.5,
    alignSelf: 'center',
  },
  longPressHint: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    opacity: 0.5,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
