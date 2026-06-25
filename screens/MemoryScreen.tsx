import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import {
  loadSessionIndex,
  searchMemory,
  loadSession,
  deleteSession,
  getMemoryStats,
  clearAllMemory,
  SessionIndex,
  MemorySession,
} from '../services/memoryService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function tagColor(tag: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    finance: { bg: Colors.secondaryFixed, text: Colors.onSecondaryFixed },
    insurance: { bg: Colors.primaryFixed, text: Colors.onPrimaryFixed },
    tax: { bg: Colors.errorContainer, text: Colors.onErrorContainer },
    health: { bg: Colors.tertiaryFixed, text: Colors.onTertiaryFixed },
    reminder: { bg: Colors.surfaceContainerHigh, text: Colors.onSurface },
  };
  return map[tag] ?? { bg: Colors.surfaceContainerHigh, text: Colors.onSurface };
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onPress,
  onDelete,
}: {
  session: SessionIndex;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={styles.sessionCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.sessionCardRow}>
        {/* Date badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{formatDate(session.updatedAt)}</Text>
        </View>
        {/* Delete */}
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sessionTitle} numberOfLines={2}>{session.title}</Text>
      <Text style={styles.sessionSummary} numberOfLines={2}>{session.summary}</Text>

      {/* Tags */}
      {session.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {session.tags.slice(0, 3).map(tag => {
            const c = tagColor(tag);
            return (
              <View key={tag} style={[styles.tag, { backgroundColor: c.bg }]}>
                <Text style={[styles.tagText, { color: c.text }]}>{tag}</Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Session Detail Modal ─────────────────────────────────────────────────────

function SessionModal({
  sessionId,
  onClose,
  onAskAbout,
}: {
  sessionId: string | null;
  onClose: () => void;
  onAskAbout: (title: string) => void;
}) {
  const [session, setSession] = useState<MemorySession | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId).then(setSession);
    } else {
      setSession(null);
    }
  }, [sessionId]);

  if (!session) return null;

  return (
    <Modal visible={!!sessionId} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        {/* Modal header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={1}>{session.title}</Text>
          <TouchableOpacity
            style={styles.modalAskBtn}
            onPress={() => {
              onClose();
              onAskAbout(session.title);
            }}
          >
            <Text style={styles.modalAskBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>

        {/* Date */}
        <View style={styles.modalMeta}>
          <Text style={styles.modalMetaText}>
            {new Date(session.startedAt).toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </Text>
          <Text style={styles.modalMetaText}>
            {session.messages.length} messages
          </Text>
        </View>

        {/* Messages */}
        <FlatList
          data={session.messages}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={styles.modalMessages}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.modalMsgRow, isUser ? styles.modalMsgRowUser : styles.modalMsgRowModel]}>
                {!isUser && (
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>✦</Text>
                  </View>
                )}
                <View style={[styles.modalBubble, isUser ? styles.modalBubbleUser : styles.modalBubbleModel]}>
                  <Text style={[styles.modalBubbleText, isUser && styles.modalBubbleTextUser]}>
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MemoryScreen() {
  const navigation = useNavigation();

  const [sessions, setSessions] = useState<SessionIndex[]>([]);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState<SessionIndex[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ sessionCount: 0, tags: [] as string[] });

  // Reload when screen is focused (after chatting)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [index, s] = await Promise.all([loadSessionIndex(), getMemoryStats()]);
    setSessions(index);
    setFiltered(index);
    setStats(s);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const onSearch = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setFiltered(sessions);
      return;
    }
    const results = await searchMemory(q);
    setFiltered(results);
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    await loadData();
  };

  const handleAskAbout = (title: string) => {
    (navigation as any).navigate('Chat', { initialQuery: `Tell me what you remember about: "${title}"` });
  };

  const handleClearAll = async () => {
    await clearAllMemory();
    await loadData();
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Ambient ornament */}
      <View style={styles.ornamentTop} />
      <View style={styles.ornamentMid} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Memory</Text>
        <Text style={styles.headerSubtitle}>
          {stats.sessionCount > 0
            ? `${stats.sessionCount} conversation${stats.sessionCount !== 1 ? 's' : ''} stored`
            : 'No memories yet'}
        </Text>
      </View>

      {/* Search — Stitch glass input shelf */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={onSearch}
            placeholder="Search your memory…"
            placeholderTextColor={`${Colors.onSurfaceVariant}80`}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => onSearch('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
      >
        {/* Stats chips */}
        {stats.tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
            {stats.tags.slice(0, 6).map(tag => {
              const c = tagColor(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.statChip, { backgroundColor: c.bg }]}
                  onPress={() => onSearch(tag)}
                >
                  <Text style={[styles.statChipText, { color: c.text }]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Results */}
        {filtered.length === 0 ? (
          <EmptyState query={query} onStart={() => navigation.navigate('Chat' as never)} />
        ) : (
          <>
            {query ? (
              <Text style={styles.resultsLabel}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{query}"
              </Text>
            ) : (
              <Text style={styles.sectionLabel}>RECENT CONVERSATIONS</Text>
            )}

            {filtered.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onPress={() => setSelectedId(session.id)}
                onDelete={() => handleDelete(session.id)}
              />
            ))}

            {/* Clear all */}
            {sessions.length > 0 && !query && (
              <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
                <Text style={styles.clearBtnText}>Clear All Memory</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* Session detail modal */}
      <SessionModal
        sessionId={selectedId}
        onClose={() => setSelectedId(null)}
        onAskAbout={handleAskAbout}
      />

      {/* FAB — new chat */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Chat' as never)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>✦</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ query, onStart }: { query: string; onStart: () => void }) {
  return (
    <View style={styles.emptyState}>
      {/* Orb illustration */}
      <View style={styles.emptyOrb}>
        <Text style={styles.emptyOrbText}>✦</Text>
      </View>
      <Text style={styles.emptyTitle}>
        {query ? 'No memories found' : 'Memory is empty'}
      </Text>
      <Text style={styles.emptyBody}>
        {query
          ? `No conversations match "${query}". Try a different keyword.`
          : "Every conversation with Meenakshi is saved here. Start chatting to build your memory graph."}
      </Text>
      {!query && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onStart}>
          <Text style={styles.emptyBtnText}>Start a conversation</Text>
          <Text style={styles.emptyBtnArrow}> →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  ornamentTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.secondary,
    opacity: 0.05,
  },
  ornamentMid: {
    position: 'absolute',
    top: '40%',
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.primaryFixedDim,
    opacity: 0.08,
  },
  // Header
  header: {
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.onSurface,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: FontSize.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  // Search
  searchWrap: {
    paddingHorizontal: Spacing.containerMobile,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: FontSize.bodyMd,
    color: Colors.onSurface,
  },
  searchClear: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    padding: 4,
  },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.containerMobile,
    paddingBottom: 120,
    gap: Spacing.sm,
  },
  statsRow: {
    marginBottom: Spacing.sm,
  },
  statChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    marginRight: Spacing.sm,
  },
  statChipText: {
    fontSize: FontSize.labelSm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: FontSize.labelSm,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  resultsLabel: {
    fontSize: FontSize.bodyMd,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.sm,
  },
  // Session card — Stitch glass card
  sessionCard: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateBadge: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  dateBadgeText: {
    fontSize: FontSize.labelSm,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 10, color: Colors.onSurfaceVariant },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onSurface,
    lineHeight: 22,
  },
  sessionSummary: {
    fontSize: FontSize.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Clear button
  clearBtn: {
    alignItems: 'center',
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  clearBtnText: {
    fontSize: FontSize.labelSm,
    color: Colors.error,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyOrb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.secondaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyOrbText: { fontSize: 40, color: Colors.secondary },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.onSurface,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: FontSize.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  emptyBtnText: { fontSize: FontSize.bodyMd, color: '#fff', fontWeight: '700' },
  emptyBtnArrow: { fontSize: FontSize.bodyMd, color: '#fff' },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 92,
    right: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 50,
  },
  fabText: { fontSize: 22, color: '#fff' },
  // Modal
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  modalCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  modalCloseBtnText: { fontSize: FontSize.bodyMd, color: Colors.secondary },
  modalTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.onSurface,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  modalAskBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
  },
  modalAskBtnText: { fontSize: FontSize.labelSm, color: '#fff', fontWeight: '700' },
  modalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLow,
  },
  modalMetaText: { fontSize: FontSize.labelSm, color: Colors.onSurfaceVariant },
  modalMessages: {
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  modalMsgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modalMsgRowUser: { justifyContent: 'flex-end' },
  modalMsgRowModel: { justifyContent: 'flex-start' },
  modalAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarText: { fontSize: 10, color: '#fff' },
  modalBubble: {
    maxWidth: '78%',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  modalBubbleUser: { backgroundColor: Colors.secondary, borderBottomRightRadius: 2 },
  modalBubbleModel: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderBottomLeftRadius: 2,
  },
  modalBubbleText: { fontSize: FontSize.bodyMd, color: Colors.onSurface, lineHeight: 22 },
  modalBubbleTextUser: { color: '#fff' },
});
