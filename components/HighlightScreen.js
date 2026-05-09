import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppContext } from '../contexts/AppContext';
import {
  ROLE_DEFINITIONS,
  ROLE_MAP,
  buildExportText,
  buildHighlightSummary,
  buildStructuredSections,
  splitIntoTokens,
} from '../utils/documentUtils';

function makeColors(dark) {
  return {
    bg: dark ? '#161618' : '#FAFAFA',
    topBar: dark ? '#1C1C1E' : '#fff',
    topBarBorder: dark ? '#2C2C2E' : '#F2F2F7',
    backBtn: dark ? '#2C2C2E' : '#F2F2F7',
    text: dark ? '#F5F5F7' : '#1C1C1E',
    sub: dark ? '#A0A0A8' : '#8E8E93',
    noteCard: dark ? '#1C1C1E' : '#fff',
    noteEyebrow: dark ? '#636366' : '#8E8E93',
    noteSub: dark ? '#8A8A8E' : '#6A6A73',
    wordText: dark ? '#F5F5F7' : '#1C1C1E',
    clearBtnBg: dark ? '#2C2C2E' : '#F2F2F7',
    toolbar: dark ? '#1C1C1E' : '#fff',
    toolbarBorder: dark ? '#2C2C2E' : '#E5E5EA',
    secondaryBtn: dark ? '#2C2C2E' : '#F2F2F7',
    secondaryBtnText: dark ? '#F5F5F7' : '#1C1C1E',
    primaryBtn: dark ? '#F5F5F7' : '#1C1C1E',
    primaryBtnText: dark ? '#1C1C1E' : '#fff',
    actionBtn: dark ? '#F5F5F7' : '#1C1C1E',
    actionBtnText: dark ? '#1C1C1E' : '#fff',
    statusBar: dark ? 'light-content' : 'dark-content',
  };
}

const WordToken = React.memo(function WordToken({
  token,
  role,
  previousRole,
  nextRole,
  onPress,
  darkMode,
}) {
  if (token.isSpace) return <Text style={styles.space}>{token.text}</Text>;
  const roleDef = role ? ROLE_MAP[role] : null;
  const textColor = roleDef ? roleDef.color : darkMode ? '#F5F5F7' : '#1C1C1E';
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(token.index)}
      style={[
        styles.wordWrap,
        roleDef ? { backgroundColor: roleDef.bg } : null,
        roleDef
          ? {
              borderTopLeftRadius: previousRole === role ? 0 : 5,
              borderBottomLeftRadius: previousRole === role ? 0 : 5,
              borderTopRightRadius: nextRole === role ? 0 : 5,
              borderBottomRightRadius: nextRole === role ? 0 : 5,
            }
          : null,
      ]}>
      <Text
        style={[
          styles.wordText,
          { color: textColor },
          roleDef ? { fontWeight: '700' } : null,
        ]}>
        {token.text}
      </Text>
    </TouchableOpacity>
  );
});

export default function HighlightWorkspaceScreen({ route, navigation }) {
  const { doc: routeDoc } = route.params;
  const { documents, saveDocumentHighlights, darkMode } = useAppContext();
  const C = makeColors(darkMode);
  const currentDoc =
    documents.find((item) => item.id === routeDoc?.id) || routeDoc;

  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [activeRole, setActiveRole] = useState(ROLE_DEFINITIONS[0].id);
  const [highlights, setHighlights] = useState(currentDoc?.highlights || {});
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [toastRole, setToastRole] = useState(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const saveTimerRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const nextText =
      currentDoc?.extracted_text?.trim() ||
      `${
        currentDoc?.title || 'Document'
      }\n\nNo extracted text is available yet for this file.`;
    setText(nextText);
    setHighlights(currentDoc?.highlights || {});
    setLoading(false);
  }, [currentDoc?.id, currentDoc?.extracted_text]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!currentDoc?.id) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDocumentHighlights(currentDoc.id, highlights);
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [currentDoc?.id, highlights, saveDocumentHighlights]);

  const tokens = useMemo(() => splitIntoTokens(text), [text]);
  const summary = useMemo(
    () => buildHighlightSummary(highlights),
    [highlights]
  );
  const totalHighlights = Object.keys(highlights).length;
  const structuredSections = useMemo(
    () => buildStructuredSections(text, highlights),
    [text, highlights]
  );

  const triggerToast = (roleId) => {
    setToastRole(roleId);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(toastAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
      Animated.delay(700),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleWordPress = (index) => {
    setHighlights((previous) => {
      const next = { ...previous };
      if (rangeMode && rangeStart === null) {
        setRangeStart(index);
        return previous;
      }
      if (rangeMode && rangeStart !== null) {
        const start = Math.min(rangeStart, index);
        const end = Math.max(rangeStart, index);
        for (let cursor = start; cursor <= end; cursor += 1) {
          const token = tokens.find((item) => item.index === cursor);
          if (!token?.isSpace) next[cursor] = activeRole;
        }
        setRangeMode(false);
        setRangeStart(null);
        triggerToast(activeRole);
        return next;
      }
      if (next[index] === activeRole) {
        delete next[index];
      } else {
        next[index] = activeRole;
        triggerToast(activeRole);
      }
      return next;
    });
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
            setRangeMode(false);
            setRangeStart(null);
          },
        },
      ]
    );
  };

  const handleShareExport = async () => {
    if (totalHighlights === 0) {
      Alert.alert('No Highlights', 'Highlight some text before exporting.');
      return;
    }
    await Share.share({
      title: `${currentDoc?.title || 'Document'} Highlights`,
      message: buildExportText(
        {
          ...currentDoc,
          highlightCount: totalHighlights,
          pages: currentDoc?.pages || 1,
        },
        structuredSections,
        { includeColorLegend: true }
      ),
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.text} />
          <Text style={[styles.loadingText, { color: C.sub }]}>
            Preparing your workspace...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} />
      <View
        style={[
          styles.topBar,
          { backgroundColor: C.topBar, borderBottomColor: C.topBarBorder },
        ]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: C.backBtn }]}
          onPress={() => navigation?.goBack()}>
          <Text style={[styles.backIcon, { color: C.text }]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={[styles.topTitle, { color: C.text }]} numberOfLines={1}>
            {currentDoc?.title || 'Document'}
          </Text>
          <Text style={[styles.topSub, { color: C.sub }]}>
            {totalHighlights} highlight{totalHighlights === 1 ? '' : 's'} ·{' '}
            {structuredSections.length} structured block
            {structuredSections.length === 1 ? '' : 's'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: C.actionBtn }]}
          onPress={() =>
            navigation.navigate('Preview', {
              doc: { ...currentDoc, highlights, extracted_text: text },
            })
          }>
          <Text style={[styles.actionBtnText, { color: C.actionBtnText }]}>
            Preview
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.summaryRow,
          { backgroundColor: C.topBar, borderBottomColor: C.topBarBorder },
        ]}>
        {ROLE_DEFINITIONS.map((role) => (
          <View
            key={role.id}
            style={[styles.summaryChip, { borderColor: role.color }]}>
            <View
              style={[styles.summaryDot, { backgroundColor: role.color }]}
            />
            <Text style={[styles.summaryCount, { color: C.text }]}>
              {summary[role.id]}
            </Text>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.clearBtn, { backgroundColor: C.clearBtnBg }]}
          onPress={clearAll}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {rangeMode ? (
        <View style={[styles.rangeBanner, { backgroundColor: C.actionBtn }]}>
          <Text style={[styles.rangeBannerText, { color: C.actionBtnText }]}>
            {rangeStart === null
              ? 'Tap the first word in the range.'
              : 'Now tap the last word to apply the role.'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setRangeMode(false);
              setRangeStart(null);
            }}>
            <Text style={styles.rangeCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={[styles.canvas, { backgroundColor: C.bg }]}
        contentContainerStyle={styles.canvasContent}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.noteCard, { backgroundColor: C.noteCard }]}>
          <Text style={[styles.noteEyebrow, { color: C.noteEyebrow }]}>
            Workspace
          </Text>
          <Text style={[styles.noteTitle, { color: C.text }]}>
            Tap words for quick tagging or switch to range mode for phrases.
          </Text>
          <Text style={[styles.noteSub, { color: C.noteSub }]}>
            Your highlights save automatically and drive the preview/export
            screens.
          </Text>
        </View>
        <View style={styles.textWrap}>
          {tokens.map((token, index) => {
            const role = highlights[token.index];
            const previousRole =
              index > 1 ? highlights[tokens[index - 2]?.index] : null;
            const nextRole =
              index < tokens.length - 2
                ? highlights[tokens[index + 2]?.index]
                : null;
            return (
              <WordToken
                key={token.index}
                token={token}
                role={role}
                previousRole={previousRole}
                nextRole={nextRole}
                onPress={handleWordPress}
                darkMode={darkMode}
              />
            );
          })}
        </View>
        <View style={{ height: 180 }} />
      </ScrollView>

      <View style={styles.toastAnchor} pointerEvents="none">
        {toastRole ? (
          <Animated.View
            style={[
              styles.tagPopup,
              {
                backgroundColor: ROLE_MAP[toastRole].color,
                opacity: toastAnim,
                transform: [{ scale: toastAnim }],
              },
            ]}>
            <Text style={styles.tagPopupText}>
              {ROLE_MAP[toastRole].label} applied
            </Text>
          </Animated.View>
        ) : null}
      </View>

      <View
        style={[
          styles.toolbar,
          { backgroundColor: C.toolbar, borderTopColor: C.toolbarBorder },
        ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarRoles}>
          {ROLE_DEFINITIONS.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.roleBtn,
                { borderColor: role.color },
                activeRole === role.id
                  ? { backgroundColor: role.color }
                  : { backgroundColor: role.soft },
              ]}
              onPress={() => setActiveRole(role.id)}>
              <Text style={styles.roleEmoji}>{role.emoji}</Text>
              <Text
                style={[
                  styles.roleLabel,
                  {
                    color:
                      activeRole === role.id
                        ? '#fff'
                        : darkMode
                        ? '#D0D0D8'
                        : '#3F3F46',
                  },
                ]}>
                {role.shortLabel}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.toolbarActions}>
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { backgroundColor: rangeMode ? C.primaryBtn : C.secondaryBtn },
            ]}
            onPress={() => {
              setRangeMode((v) => !v);
              setRangeStart(null);
            }}>
            <Text
              style={[
                styles.secondaryBtnText,
                { color: rangeMode ? C.primaryBtnText : C.secondaryBtnText },
              ]}>
              {rangeMode ? 'Cancel Range' : 'Range'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: C.secondaryBtn }]}
            onPress={() =>
              navigation.navigate('DocumentViewer', { doc: currentDoc })
            }>
            <Text
              style={[styles.secondaryBtnText, { color: C.secondaryBtnText }]}>
              Original
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: C.primaryBtn }]}
            onPress={() =>
              navigation.navigate('Export', {
                doc: { ...currentDoc, highlights, extracted_text: text },
              })
            }>
            <Text style={[styles.primaryBtnText, { color: C.primaryBtnText }]}>
              Export
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: C.primaryBtn }]}
            onPress={handleShareExport}>
            <Text style={[styles.primaryBtnText, { color: C.primaryBtnText }]}>
              Share
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: { fontSize: 15, fontWeight: '500' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 24, marginTop: -2 },
  topCenter: { flex: 1 },
  topTitle: { fontSize: 15, fontWeight: '700' },
  topSub: { fontSize: 11, marginTop: 1 },
  actionBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
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
  summaryCount: { fontSize: 13, fontWeight: '700' },
  clearBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: '#FF3B30' },
  rangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rangeBannerText: { fontSize: 13, fontWeight: '500', flex: 1 },
  rangeCancelText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 12,
  },
  canvas: { flex: 1 },
  canvasContent: { paddingHorizontal: 20, paddingTop: 20 },
  noteCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  noteEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  noteTitle: { fontSize: 18, fontWeight: '800', marginTop: 8, lineHeight: 24 },
  noteSub: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  textWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  wordWrap: { paddingHorizontal: 2, paddingVertical: 2, marginVertical: 1 },
  wordText: { fontSize: 16, lineHeight: 28, fontFamily: 'Georgia' },
  space: { fontSize: 16, lineHeight: 28, color: 'transparent' },
  toastAnchor: {
    position: 'absolute',
    top: '46%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tagPopup: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  tagPopupText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  toolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 30,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  toolbarRoles: { gap: 8, paddingRight: 6 },
  roleBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    gap: 4,
  },
  roleEmoji: { fontSize: 18 },
  roleLabel: { fontSize: 11, fontWeight: '700' },
  toolbarActions: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700' },
  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 13, fontWeight: '700' },
});
