import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Animated,
  Share,
  Alert,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Color Role Config ────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'title',
    color: '#FF3B30',
    bg: '#FF3B3022',
    label: 'Title',
    emoji: '🔴',
    shortLabel: 'Title',
  },
  {
    id: 'description',
    color: '#FFCC00',
    bg: '#FFCC0022',
    label: 'Description',
    emoji: '🟡',
    shortLabel: 'Desc',
  },
  {
    id: 'bullet',
    color: '#34C759',
    bg: '#34C75922',
    label: 'Bullet',
    emoji: '🟢',
    shortLabel: 'List',
  },
  {
    id: 'quote',
    color: '#007AFF',
    bg: '#007AFF22',
    label: 'Quote',
    emoji: '🔵',
    shortLabel: 'Quote',
  },
];

const ROLE_MAP = Object.fromEntries(ROLES.map((r) => [r.id, r]));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function splitIntoWords(text) {
  const tokens = [];
  let i = 0;
  const re = /(\S+|\s+)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    tokens.push({ text: match[0], index: i, isSpace: /^\s+$/.test(match[0]) });
    i++;
  }
  return tokens;
}

// ─── Word Token Component ─────────────────────────────────────────────────────
const WordToken = React.memo(
  ({
    token,
    highlight,
    prevHighlight,
    nextHighlight,
    prevSame,
    nextSame,
    onPress,
  }) => {
    // 1. Handle Spaces: If the word before and after have the SAME highlight, fill the space!
    if (token.isSpace) {
      if (prevHighlight && prevHighlight === nextHighlight) {
        const role = ROLE_MAP[prevHighlight];
        return (
          <View
            style={[
              styles.wordWrap,
              { backgroundColor: role.bg, paddingHorizontal: 0 },
            ]}>
            <Text style={styles.space}>{token.text}</Text>
          </View>
        );
      }
      return (
        <View style={[styles.wordWrap, { paddingHorizontal: 0 }]}>
          <Text style={styles.space}>{token.text}</Text>
        </View>
      );
    }

    // 2. Handle Words
    const role = highlight ? ROLE_MAP[highlight] : null;

    return (
      <TouchableOpacity
        onPress={() => onPress(token.index)}
        activeOpacity={0.7}
        style={[
          styles.wordWrap,
          role && { backgroundColor: role.bg },
          role && {
            borderRadius: 3,
            // Flatten borders if the adjacent word shares the exact same highlight role
            borderTopLeftRadius: prevSame ? 0 : 3,
            borderBottomLeftRadius: prevSame ? 0 : 3,
            borderTopRightRadius: nextSame ? 0 : 3,
            borderBottomRightRadius: nextSame ? 0 : 3,
          },
        ]}>
        <Text
          style={[
            styles.wordText,
            role && { color: role.color, fontWeight: '600' },
          ]}>
          {token.text}
        </Text>
      </TouchableOpacity>
    );
  }
);

// ─── Tag Confirmation Popup ───────────────────────────────────────────────────
function TagPopup({ role, visible }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 8,
        }),
        Animated.delay(900),
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, role]);

  if (!role) return null;
  const r = ROLE_MAP[role];
  return (
    <Animated.View
      style={[
        styles.tagPopup,
        {
          backgroundColor: r.color,
          opacity: anim,
          transform: [{ scale: anim }],
        },
      ]}>
      <Text style={styles.tagPopupText}>
        {r.emoji} [{r.label}]
      </Text>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HighlightWorkspaceScreen({ route, navigation }) {
  const { doc } = route.params;

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Loading document…');
  const [activeRole, setActiveRole] = useState(ROLES[0].id);
  const [highlights, setHighlights] = useState({});
  const [lastTagRole, setLastTagRole] = useState(null);
  const [tagPopupKey, setTagPopupKey] = useState(0);
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [summary, setSummary] = useState({
    title: 0,
    description: 0,
    bullet: 0,
    quote: 0,
  });

  // ── Load text ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadText();

    // This is the "Cleanup" function that runs when leaving the screen
    return () => {
      // We call saveHighlights here to sync with Supabase
      saveHighlights();
    };
  }, [doc.id]); // Keep docId as the dependency

  const saveHighlights = async () => {
    const {
      data: { session },
    } = supabase.auth.getSession();
    if (!session) return;

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/documents?id=eq.${doc.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        // We save the current highlights object as JSON in your database column
        body: JSON.stringify({ highlights: highlights }),
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const loadText = async () => {
    try {
      // 1. Best case: extracted_text passed directly via route params
      if (doc.extracted_text) {
        finalizeText(doc.extracted_text);
        return;
      }

      // 2. Fetch from DB — doc was opened from history without extracted_text in params
      setLoadingMsg('Fetching text…');
      const session = supabase.auth.getSession()?.data?.session;
      const token = session?.access_token || SUPABASE_ANON_KEY;

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/documents?url=eq.${encodeURIComponent(
          doc.url
        )}&select=extracted_text&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const rows = await res.json();
        const extracted = rows?.[0]?.extracted_text;
        if (extracted) {
          finalizeText(extracted);
          return;
        }
      }

      // 3. Nothing found — show fallback
      finalizeText(generateFallbackMessage(doc));
    } catch (e) {
      console.log('Load error:', e);
      finalizeText(generateFallbackMessage(doc));
    }
  };

  const generateFallbackMessage = (d) =>
    `${
      d.title || 'Document'
    }\n\nNo extracted text found for this document.\n\nPlease re-upload it from the Import screen to enable word-level highlighting.`;

  const finalizeText = (rawText) => {
    const clean = (rawText || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    setTokens(splitIntoWords(clean));
    setLoading(false);
  };

  // ── Highlight logic ──────────────────────────────────────────────────────
  const handleWordPress = useCallback(
    (index) => {
      setHighlights((prev) => {
        if (isRangeMode && rangeStart !== null) {
          const start = Math.min(rangeStart, index);
          const end = Math.max(rangeStart, index);
          const next = { ...prev };
          for (let i = start; i <= end; i++) next[i] = activeRole;
          setRangeStart(null);
          setIsRangeMode(false);
          triggerTag(activeRole);
          updateSummary(next);
          return next;
        }

        if (isRangeMode && rangeStart === null) {
          setRangeStart(index);
          return prev;
        }

        const next = { ...prev };
        if (next[index] === activeRole) {
          delete next[index];
        } else {
          next[index] = activeRole;
          triggerTag(activeRole);
        }
        updateSummary(next);
        return next;
      });
    },
    [activeRole, isRangeMode, rangeStart]
  );

  const triggerTag = (role) => {
    setLastTagRole(role);
    setTagPopupKey((k) => k + 1);
  };

  const updateSummary = (h) => {
    const s = { title: 0, description: 0, bullet: 0, quote: 0 };
    Object.values(h).forEach((r) => {
      if (s[r] !== undefined) s[r]++;
    });
    setSummary(s);
  };

  const clearAll = () => {
    Alert.alert(
      'Clear All Highlights',
      'Remove all highlights from this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setHighlights({});
            setSummary({ title: 0, description: 0, bullet: 0, quote: 0 });
          },
        },
      ]
    );
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = () => {
    const sections = { title: [], description: [], bullet: [], quote: [] };
    tokens.forEach((t) => {
      if (!t.isSpace && highlights[t.index]) {
        sections[highlights[t.index]].push(t.text);
      }
    });

    const totalHighlights = Object.keys(highlights).length;
    if (totalHighlights === 0) {
      Alert.alert(
        'No Highlights',
        'Highlight some words first before exporting.'
      );
      return;
    }

    const lines = [
      `📄 ${doc.title || 'Document'}`,
      `Exported highlights\n`,
      sections.title.length ? `🔴 TITLES\n${sections.title.join(' ')}\n` : '',
      sections.description.length
        ? `🟡 DESCRIPTIONS\n${sections.description.join(' ')}\n`
        : '',
      sections.bullet.length
        ? `🟢 BULLETS\n${sections.bullet.join(' ')}\n`
        : '',
      sections.quote.length ? `🔵 QUOTES\n${sections.quote.join(' ')}\n` : '',
    ]
      .filter(Boolean)
      .join('\n');

    Share.share({
      title: `${doc.title || 'Document'} — Highlights`,
      message: lines,
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1C1C1E" />
          <Text style={styles.loadingText}>{loadingMsg}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalHighlights = Object.keys(highlights).length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {doc.title || 'Document'}
          </Text>
          <Text style={styles.topSub}>
            {totalHighlights} word{totalHighlights !== 1 ? 's' : ''} highlighted
          </Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={saveHighlights}>
          <Text style={styles.exportBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* ── Summary Chips ── */}
      <View style={styles.summaryRow}>
        {ROLES.map((r) => (
          <View
            key={r.id}
            style={[styles.summaryChip, { borderColor: r.color }]}>
            <View style={[styles.summaryDot, { backgroundColor: r.color }]} />
            <Text style={styles.summaryCount}>{summary[r.id]}</Text>
          </View>
        ))}
        <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* ── Range Mode Banner ── */}
      {isRangeMode && (
        <View style={styles.rangeBanner}>
          <Text style={styles.rangeBannerText}>
            {rangeStart === null
              ? '👆 Tap the FIRST word of your range'
              : '👆 Now tap the LAST word of your range'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setIsRangeMode(false);
              setRangeStart(null);
            }}>
            <Text style={styles.rangeCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Main Canvas ── */}
      <ScrollView
        style={styles.canvas}
        contentContainerStyle={styles.canvasContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.textWrap}>
          {tokens.map((token, i) => {
            const highlight = highlights[token.index];
            let prevHighlight = null;
            let nextHighlight = null;
            let prevSame = false;
            let nextSame = false;

            if (token.isSpace) {
              // For spaces, look at the word immediately before and after
              prevHighlight = i > 0 ? highlights[tokens[i - 1].index] : null;
              nextHighlight =
                i < tokens.length - 1 ? highlights[tokens[i + 1].index] : null;
            } else {
              // For words, skip the adjacent space (i +/- 1) and look at the actual adjacent words (i +/- 2)
              if (i > 1 && highlight) {
                prevSame = highlights[tokens[i - 2].index] === highlight;
              }
              if (i < tokens.length - 2 && highlight) {
                nextSame = highlights[tokens[i + 2].index] === highlight;
              }
            }

            return (
              <WordToken
                key={token.index}
                token={token}
                highlight={highlight}
                prevHighlight={prevHighlight}
                nextHighlight={nextHighlight}
                prevSame={prevSame}
                nextSame={nextSame}
                onPress={handleWordPress}
              />
            );
          })}
        </View>
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ── Tag Confirmation Popup ── */}
      <View style={styles.popupAnchor} pointerEvents="none">
        <TagPopup key={tagPopupKey} role={lastTagRole} visible={true} />
      </View>

      {/* ── Toolbar ── */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarRoles}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.roleBtn,
                { borderColor: role.color },
                activeRole === role.id && { backgroundColor: role.color },
              ]}
              onPress={() => setActiveRole(role.id)}>
              <Text style={styles.roleEmoji}>{role.emoji}</Text>
              <Text
                style={[
                  styles.roleLabel,
                  activeRole === role.id && styles.roleLabelActive,
                ]}>
                {role.shortLabel}
              </Text>
              {activeRole === role.id && (
                <View style={styles.activeIndicator} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.rangeToggle, isRangeMode && styles.rangeToggleActive]}
          onPress={() => {
            setIsRangeMode((r) => !r);
            setRangeStart(null);
          }}>
          <Text
            style={[
              styles.rangeToggleText,
              isRangeMode && styles.rangeToggleTextActive,
            ]}>
            {isRangeMode ? '✕ Cancel Range' : '⇔ Range'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: { fontSize: 15, color: '#8E8E93', fontWeight: '500' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 24, color: '#1C1C1E', marginTop: -2 },
  topCenter: { flex: 1 },
  topTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  topSub: { fontSize: 11, color: '#8E8E93', marginTop: 1 },
  exportBtn: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  exportBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    gap: 8,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryCount: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  clearBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: '#FF3B30' },
  rangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rangeBannerText: { color: '#fff', fontSize: 13, fontWeight: '500', flex: 1 },
  rangeCancelText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 12,
  },
  canvas: { flex: 1, backgroundColor: '#FAFAFA' },
  canvasContent: { paddingHorizontal: 20, paddingTop: 20 },
  textWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  wordWrap: { paddingHorizontal: 1, paddingVertical: 2, marginVertical: 1 },
  wordText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#1C1C1E',
    fontFamily: 'Georgia',
  },
  space: { fontSize: 16, lineHeight: 26, color: 'transparent' },
  popupAnchor: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  tagPopup: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  tagPopupText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  toolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
    paddingBottom: 30,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  toolbarRoles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  roleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: '#F9F9F9',
    position: 'relative',
    gap: 3,
  },
  roleEmoji: { fontSize: 20 },
  roleLabel: { fontSize: 11, fontWeight: '600', color: '#8E8E93' },
  roleLabelActive: { color: '#fff' },
  activeIndicator: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  rangeToggle: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  rangeToggleActive: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  rangeToggleText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  rangeToggleTextActive: { color: '#fff' },
});
