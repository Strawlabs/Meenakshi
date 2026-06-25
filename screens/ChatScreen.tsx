import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { generateGeminiContent } from '../services/geminiService';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';
import { MEENAKSHI_SYSTEM_PROMPT } from '../constants';
import {
  saveSession,
  buildMemoryContext,
  buildEmailContext,
  MemoryMessage,
} from '../services/memoryService';
import supabase from '../lib/supabase';

// ⚠️ Set EXPO_PUBLIC_GEMINI_API_KEY in .env
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

type RouteType = RouteProp<RootStackParamList, 'Chat'>;

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

const QUICK_PROMPTS = [
  'What bills are due this week?',
  'Summarize my finances',
  'Who should I follow up with?',
  'Any insurance renewals coming?',
];

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const initialQuery = route.params?.initialQuery;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'model',
      text: "Hello! I'm Meenakshi — your AI memory and financial companion. I remember our past conversations, so feel free to continue right where we left off.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [memoryLoaded, setMemoryLoaded] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const isSendingRef = useRef(false);
  const messagesRef = useRef<Message[]>(messages);
  const sessionIdRef = useRef<string | undefined>(sessionId);

  // Keep refs up-to-date
  useEffect(() => {
    messagesRef.current = messages;
    sessionIdRef.current = sessionId;
  }, [messages, sessionId]);

  // Load memory context on mount
  useEffect(() => {
    (async () => {
      setMemoryLoaded(true); // mark ready even if context is empty
    })();
  }, []);

  // Fire initial query if provided (from HomeScreen suggestion)
  useEffect(() => {
    if (initialQuery && memoryLoaded) {
      sendMessage(initialQuery);
    }
  }, [memoryLoaded]);

  // Save session ONLY when unmounting to prevent duplicate upserts during conversation
  useEffect(() => {
    return () => {
      const msgs = messagesRef.current.filter(m => m.id !== '0');
      if (msgs.length >= 2) {
        const mem: MemoryMessage[] = msgs.map(m => ({
          role: m.role,
          text: m.text,
          timestamp: m.timestamp,
        }));
        saveSession(mem, sessionIdRef.current).catch(() => {});
      }
    };
  }, []);

  const scrollToBottom = () =>
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading || isSendingRef.current) return;

    isSendingRef.current = true;
    setIsLoading(true);
    if (!textOverride) setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    scrollToBottom();

    try {
      if (!GEMINI_API_KEY) {
        throw new Error(
          'Add your Gemini API key to .env:\nEXPO_PUBLIC_GEMINI_API_KEY=your_key_here\n\nThen restart the Expo server.'
        );
      }

      // Build enriched system prompt with memory and email contexts
      const memCtx = await buildMemoryContext();
      const emailCtx = await buildEmailContext();
      
      // Third context fetch: User's last 10 email events
      let financialEmailHistory = '';
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: historyEvents } = await supabase
          .from('email_events')
          .select('received_at, category, amount, ai_summary, sender_name, entity_email_links(entities(name))')
          .eq('user_id', user.id)
          .order('received_at', { ascending: false })
          .limit(10);
        
        if (historyEvents && historyEvents.length > 0) {
          const formattedEvents = historyEvents.map((e: any) => {
            const dateStr = new Date(e.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            const amountStr = e.amount ? e.amount : '0';
            const entityStr = e.entity_email_links?.[0]?.entities?.name || e.sender_name || 'Unknown Entity';
            return `- [${dateStr}] [${e.category}] [${entityStr}]: ₹${amountStr} — [${e.ai_summary || ''}]`;
          });
          financialEmailHistory = `FINANCIAL EMAIL HISTORY:\n${formattedEvents.join('\n')}`;
        }
      }

      let enrichedSystemPrompt = MEENAKSHI_SYSTEM_PROMPT;
      enrichedSystemPrompt += `\n\nTODAY'S DATE: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (current system time). Always evaluate timeline event dues relative to this date.`;
      if (memCtx) {
        enrichedSystemPrompt += `\n\n${memCtx}`;
      }
      if (emailCtx) {
        enrichedSystemPrompt += `\n\n${emailCtx}`;
      }
      if (financialEmailHistory) {
        enrichedSystemPrompt += `\n\n${financialEmailHistory}`;
      }

      const responseText = await generateGeminiContent(text, {
        systemInstruction: enrichedSystemPrompt,
        model: 'gemini-3-flash-preview',
      });

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText || "I couldn't process that. Please try again.",
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, modelMsg]);

      // Auto-save session after each exchange (2+ real messages)
      const msgs = [...messagesRef.current, modelMsg];
      const real = msgs.filter(m => m.id !== '0');
      if (real.length >= 2) {
        const mem: MemoryMessage[] = real.map(m => ({
          role: m.role,
          text: m.text,
          timestamp: m.timestamp,
        }));
        saveSession(mem, sessionIdRef.current).then(id => {
          if (!sessionIdRef.current) {
            sessionIdRef.current = id;
            setSessionId(id);
          }
        }).catch(() => {});
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `⚠️ ${err?.message || 'Something went wrong. Check your API key.'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
      scrollToBottom();
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowModel]}>
        {!isUser && (
          <View style={styles.modelAvatar}>
            <Text style={styles.modelAvatarText}>✦</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleModel]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.ornament} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerOrb}>
            <Text style={styles.headerOrbText}>✦</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Meenakshi</Text>
            <Text style={styles.headerStatus}>
              {isLoading ? 'Thinking…' : memoryLoaded ? '● Memory active' : 'Loading memory…'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Voice' as never)}
        >
          <Text style={styles.headerBtnText}>🎙️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.loadingRow}>
                <View style={styles.modelAvatar}>
                  <Text style={styles.modelAvatarText}>✦</Text>
                </View>
                <View style={styles.loadingBubble}>
                  <TypingDots />
                </View>
              </View>
            ) : null
          }
        />

        {/* Quick prompts — only show on fresh chat */}
        {messages.length === 1 && (
          <View style={styles.quickPrompts}>
            {QUICK_PROMPTS.map((p, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickChip}
                onPress={() => sendMessage(p)}
              >
                <Text style={styles.quickChipText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Meenakshi anything…"
            placeholderTextColor={`${Colors.onSurfaceVariant}80`}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
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

// ─── Typing dots ─────────────────────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  ornament: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.secondary,
    opacity: 0.04,
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerOrbText: { fontSize: 14, color: Colors.onSecondary },
  headerTitle: { ...Typography.bodyMd, fontWeight: '700', color: Colors.primary },
  headerStatus: { ...Typography.labelSm, color: Colors.secondary },
  messageList: {
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowModel: { justifyContent: 'flex-start' },
  modelAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modelAvatarText: { fontSize: 11, color: Colors.onSecondary },
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: Colors.secondary,
    borderBottomRightRadius: 4,
  },
  bubbleModel: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleText: { ...Typography.bodyMd, color: Colors.onSurface },
  bubbleTextUser: { color: Colors.onSecondary },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.containerMobile,
  },
  loadingBubble: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  typingDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.secondary },
  quickPrompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMobile,
    paddingBottom: Spacing.sm,
  },
  quickChip: {
    backgroundColor: Colors.secondaryFixed,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  quickChipText: {
    ...Typography.labelSm,
    color: Colors.onSecondaryFixed,
  },
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: Colors.surfaceContainerHighest },
  sendBtnText: { ...Typography.bodyLg, fontWeight: '700', color: Colors.onSecondary },
});
