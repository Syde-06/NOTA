import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../contexts/AppContext';
import {
  COLOR_ROLES,
  ROLE_BY_ID,
  SAMPLE_TEXT,
  buildExportPayload,
  getHighlightedGroups,
  normalizeDocument,
  splitIntoTokens,
} from './notaData';
import { useNotaTheme } from './theme';

const TOKEN_CHUNK_SIZE = 120;
const SAVE_DEBOUNCE_MS = 650;

const WordToken = React.memo(function WordToken({
  token,
  roleId,
  previousRoleId,
  nextRoleId,
  onPress,
  onLongPress,
  searchQuery,
  styles,
}) {
  if (token.isLineBreak) {
    return <View style={[styles.lineBreak, { height: token.lineBreaks > 1 ? 20 : 8 }]} />;
  }

  if (token.isSpace) {
    const sharedRole = previousRoleId && previousRoleId === nextRoleId ? ROLE_BY_ID[previousRoleId] : null;
    return (
      <View style={[styles.wordWrap, sharedRole && { backgroundColor: `${sharedRole.color}22` }]}>
        <Text style={styles.space}>{token.text}</Text>
      </View>
    );
  }

  const role = roleId ? ROLE_BY_ID[roleId] : null;
  const isSearchHit = searchQuery && token.text.toLowerCase().includes(searchQuery.toLowerCase());
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={() => onPress(token.index)}
      onLongPress={() => onLongPress(token.index)}
      delayLongPress={260}
      style={[
        styles.wordWrap,
        isSearchHit && styles.searchHit,
        role && {
          backgroundColor: `${role.color}22`,
          borderTopLeftRadius: previousRoleId === roleId ? 0 : 4,
          borderBottomLeftRadius: previousRoleId === roleId ? 0 : 4,
          borderTopRightRadius: nextRoleId === roleId ? 0 : 4,
          borderBottomRightRadius: nextRoleId === roleId ? 0 : 4,
        },
      ]}>
      <Text style={[styles.wordText, role && { color: role.color, fontWeight: '700' }]}>{token.text}</Text>
    </TouchableOpacity>
  );
});

function didChunkHighlightRolesChange(item, previousHighlights, nextHighlights) {
  if (!item?.tokens?.length) return previousHighlights !== nextHighlights;

  const firstPosition = item.tokens[0].position;
  const lastPosition = item.tokens[item.tokens.length - 1].position;

  for (let position = firstPosition - 2; position <= lastPosition + 2; position += 1) {
    const token = item.lookup.get(position);
    if (token && !token.isSpace && previousHighlights?.[token.index] !== nextHighlights?.[token.index]) {
      return true;
    }
  }

  return false;
}

const TokenChunk = React.memo(function TokenChunk({ item, highlights, onWordPress, onWordLongPress, searchQuery, styles }) {
  return (
    <View style={styles.textWrap}>
      {item.tokens.map(({ token, position }) => {
        const roleId = token.isSpace ? null : highlights[token.index];
        const previousToken = item.lookup.get(position - 2);
        const nextToken = item.lookup.get(position + 2);
        const previousRoleId = previousToken && !previousToken.isSpace ? highlights[previousToken.index] : null;
        const nextRoleId = nextToken && !nextToken.isSpace ? highlights[nextToken.index] : null;
        const previousSpaceToken = item.lookup.get(position - 1);
        const nextSpaceToken = item.lookup.get(position + 1);
        const previousSpaceRole =
          previousSpaceToken && !previousSpaceToken.isSpace ? highlights[previousSpaceToken.index] : previousRoleId;
        const nextSpaceRole =
          nextSpaceToken && !nextSpaceToken.isSpace ? highlights[nextSpaceToken.index] : nextRoleId;

        return (
          <WordToken
            key={`${token.index}-${position}`}
            token={token}
            roleId={roleId}
            previousRoleId={token.isSpace ? previousSpaceRole : previousRoleId}
            nextRoleId={token.isSpace ? nextSpaceRole : nextRoleId}
            onPress={onWordPress}
            onLongPress={onWordLongPress}
            searchQuery={searchQuery}
            styles={styles}
          />
        );
      })}
    </View>
  );
}, (previous, next) => (
  previous.item === next.item &&
  previous.styles === next.styles &&
  previous.searchQuery === next.searchQuery &&
  previous.onWordPress === next.onWordPress &&
  previous.onWordLongPress === next.onWordLongPress &&
  !didChunkHighlightRolesChange(next.item, previous.highlights, next.highlights)
));

function chunkTokens(tokens) {
  const lookup = new Map(tokens.map((token, position) => [position, token]));
  const chunks = [];

  for (let start = 0; start < tokens.length; start += TOKEN_CHUNK_SIZE) {
    chunks.push({
      id: `chunk-${start}`,
      tokens: tokens.slice(start, start + TOKEN_CHUNK_SIZE).map((token, offset) => ({
        token,
        position: start + offset,
      })),
      lookup,
    });
  }

  return chunks;
}

function paginateTokens(tokens, wordsPerPage = 700) {
  const pages = [];
  let current = [];
  let wordCount = 0;

  tokens.forEach((token) => {
    current.push(token);
    if (!token.isSpace) wordCount += 1;

    if (wordCount >= wordsPerPage && token.isLineBreak) {
      pages.push({ id: `page-${pages.length + 1}`, tokens: current });
      current = [];
      wordCount = 0;
    }
  });

  if (current.length) pages.push({ id: `page-${pages.length + 1}`, tokens: current });
  return pages.length ? pages : [{ id: 'page-1', tokens }];
}

function findTokenPosition(tokens, wordIndex) {
  return tokens.findIndex((token) => token.index === wordIndex);
}

function getSentenceRange(tokens, wordIndex) {
  const position = findTokenPosition(tokens, wordIndex);
  if (position < 0) return [wordIndex, wordIndex];
  let start = position;
  let end = position;

  while (start > 0) {
    const prev = tokens[start - 1];
    if (prev.isLineBreak || /[.!?]\s*$/.test(prev.text)) break;
    start -= 1;
  }

  while (end < tokens.length - 1) {
    const item = tokens[end];
    if (!item.isSpace && /[.!?]\s*$/.test(item.text)) break;
    if (tokens[end + 1]?.isLineBreak) break;
    end += 1;
  }

  const wordTokens = tokens.slice(start, end + 1).filter((token) => !token.isSpace);
  return [wordTokens[0]?.index ?? wordIndex, wordTokens[wordTokens.length - 1]?.index ?? wordIndex];
}

function getParagraphRange(tokens, wordIndex) {
  const position = findTokenPosition(tokens, wordIndex);
  if (position < 0) return [wordIndex, wordIndex];
  let start = position;
  let end = position;

  while (start > 0 && !tokens[start - 1].isLineBreak) start -= 1;
  while (end < tokens.length - 1 && !tokens[end + 1].isLineBreak) end += 1;

  const wordTokens = tokens.slice(start, end + 1).filter((token) => !token.isSpace);
  return [wordTokens[0]?.index ?? wordIndex, wordTokens[wordTokens.length - 1]?.index ?? wordIndex];
}

export default function HighlightWorkspaceScreen({ route, navigation }) {
  const { darkMode, theme } = useNotaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { documents, highlightsByDoc, saveHighlightsForDoc, appendActivity } = useAppContext();
  const routeDoc = normalizeDocument(route?.params?.doc || documents[0] || {});
  const doc = documents.find((item) => item.id === routeDoc.id) || routeDoc;
  const text = doc.extracted_text || SAMPLE_TEXT;
  const [activeRole, setActiveRole] = useState(COLOR_ROLES[0].id);
  const [highlights, setHighlights] = useState({});
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [tapMode, setTapMode] = useState('word');
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('Saved offline');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePage, setActivePage] = useState(0);
  const [pageDraft, setPageDraft] = useState('1');
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const saveTimerRef = useRef(null);
  const latestHighlightsRef = useRef({});
  const savingRef = useRef(false);
  const saveStateRef = useRef('Saved offline');
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const searchInputRef = useRef(null);

  const tokens = useMemo(() => splitIntoTokens(text), [text]);
  const pages = useMemo(() => paginateTokens(tokens), [tokens]);
  const pageTokens = pages[activePage]?.tokens || pages[0]?.tokens || tokens;
  const tokenChunks = useMemo(() => chunkTokens(pageTokens), [pageTokens]);
  const highlightedTotal = useMemo(() => Object.keys(highlights).length, [highlights]);
  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return 0;
    return tokens.filter((token) => !token.isSpace && token.text.toLowerCase().includes(query)).length;
  }, [searchQuery, tokens]);
  const roleCounts = useMemo(() => {
    const counts = Object.fromEntries(COLOR_ROLES.map((role) => [role.id, 0]));
    pageTokens.forEach((token) => {
      if (token.isSpace) return;
      const roleId = highlights[token.index];
      if (counts[roleId] !== undefined) counts[roleId] += 1;
    });
    return counts;
  }, [highlights, pageTokens]);
  const pageHighlightCounts = useMemo(
    () => pages.map((page) => page.tokens.reduce((sum, token) => (
      !token.isSpace && highlights[token.index] ? sum + 1 : sum
    ), 0)),
    [highlights, pages]
  );

  useEffect(() => {
    const storedHighlights = highlightsByDoc?.[doc.id] || {};
    latestHighlightsRef.current = storedHighlights;
    setHighlights(storedHighlights);
    setRangeMode(false);
    setRangeStart(null);
    setActivePage(0);
    setPageDraft('1');
    setSaveState('Saved offline');
    saveStateRef.current = 'Saved offline';
    savingRef.current = false;
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryState({ undo: 0, redo: 0 });
  }, [doc.id]);

  useEffect(() => {
    if (activePage > pages.length - 1) setActivePage(Math.max(0, pages.length - 1));
    setPageDraft(String(Math.min(activePage + 1, pages.length)));
  }, [activePage, pages.length]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (doc.id) saveHighlightsForDoc(doc.id, latestHighlightsRef.current);
    },
    [doc.id, saveHighlightsForDoc]
  );

  const persistHighlightsNow = useCallback(
    async (nextHighlights) => {
      latestHighlightsRef.current = nextHighlights;
      if (!savingRef.current) {
        savingRef.current = true;
        setSaving(true);
      }
      if (saveStateRef.current !== 'Saving...') {
        saveStateRef.current = 'Saving...';
        setSaveState('Saving...');
      }
      try {
        await saveHighlightsForDoc(doc.id, nextHighlights);
        if (saveStateRef.current !== 'Saved offline') {
          saveStateRef.current = 'Saved offline';
          setSaveState('Saved offline');
        }
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [doc.id, saveHighlightsForDoc]
  );

  const schedulePersistHighlights = useCallback(
    (nextHighlights) => {
      latestHighlightsRef.current = nextHighlights;
      if (!savingRef.current) {
        savingRef.current = true;
        setSaving(true);
      }
      if (saveStateRef.current !== 'Saving...') {
        saveStateRef.current = 'Saving...';
        setSaveState('Saving...');
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistHighlightsNow(latestHighlightsRef.current);
      }, SAVE_DEBOUNCE_MS);
    },
    [persistHighlightsNow]
  );

  const updateHighlights = useCallback(
    (updater, { remember = true } = {}) => {
      setHighlights((current) => {
        const next = updater(current);
        if (next === current) return current;
        if (remember) {
          undoStackRef.current = [...undoStackRef.current.slice(-24), current];
          redoStackRef.current = [];
          setHistoryState({ undo: undoStackRef.current.length, redo: 0 });
        }
        schedulePersistHighlights(next);
        return next;
      });
    },
    [schedulePersistHighlights]
  );

  const restoreHighlights = useCallback((nextHighlights) => {
    latestHighlightsRef.current = nextHighlights;
    setHighlights(nextHighlights);
    schedulePersistHighlights(nextHighlights);
    setHistoryState({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  }, [schedulePersistHighlights]);

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push(latestHighlightsRef.current);
    restoreHighlights(previous);
  }, [restoreHighlights]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(latestHighlightsRef.current);
    restoreHighlights(next);
  }, [restoreHighlights]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const handleKeyDown = (event) => {
      const key = event.key?.toLowerCase();
      if (event.ctrlKey && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.ctrlKey && key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus?.();
      } else if (key === 'arrowright') {
        setActivePage((page) => Math.min(pages.length - 1, page + 1));
      } else if (key === 'arrowleft') {
        setActivePage((page) => Math.max(0, page - 1));
      } else if (/^[1-5]$/.test(key)) {
        const role = COLOR_ROLES[Number(key) - 1];
        if (role) setActiveRole(role.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pages.length, redo, undo]);

  const handleWordPress = useCallback((index) => {
    if (rangeMode && rangeStart === null) {
      setRangeStart(index);
      return;
    }

    updateHighlights((current) => {
      const next = { ...current };

      if (rangeMode && rangeStart !== null) {
        const start = Math.min(rangeStart, index);
        const end = Math.max(rangeStart, index);
        for (let i = start; i <= end; i += 1) {
          next[i] = activeRole;
        }
        setRangeMode(false);
        setRangeStart(null);
        return next;
      }

      if (next[index] === activeRole) {
        delete next[index];
      } else {
        if (tapMode === 'sentence') {
          const [start, end] = getSentenceRange(tokens, index);
          for (let i = start; i <= end; i += 1) next[i] = activeRole;
        } else {
          next[index] = activeRole;
        }
      }
      return next;
    });
  }, [activeRole, rangeMode, rangeStart, tapMode, tokens, updateHighlights]);

  const clearAll = () => {
    Alert.alert('Clear Highlights', 'Remove every highlight from this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          updateHighlights(() => ({}));
          await appendActivity(`Cleared highlights in ${doc.title}.`);
        },
      },
    ]);
  };

  const applyRoleToRange = useCallback((range, roleId) => {
    updateHighlights((current) => {
      const next = { ...current };
      const [start, end] = range;
      for (let i = start; i <= end; i += 1) {
        if (roleId) next[i] = roleId;
        else delete next[i];
      }
      return next;
    });
  }, [updateHighlights]);

  const applySmartSuggestions = useCallback(() => {
    Alert.alert('Smart Suggestions', 'Auto-mark likely titles, definitions, examples, lists, and summaries?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Apply',
        onPress: () => {
          updateHighlights((current) => {
            const next = { ...current };
            const lines = [];
            let line = [];

            tokens.forEach((token) => {
              if (token.isLineBreak) {
                if (line.length) lines.push(line);
                line = [];
                return;
              }
              if (!token.isSpace) line.push(token);
            });
            if (line.length) lines.push(line);

            lines.forEach((lineTokens, lineIndex) => {
              const lineText = lineTokens.map((token) => token.text).join(' ');
              const lower = lineText.toLowerCase();
              let roleId = null;

              if (lineIndex === 0 || (lineTokens.length <= 8 && /^[A-Z]/.test(lineTokens[0]?.text || ''))) {
                roleId = 'title';
              } else if (/\b(refers to|is defined as|means|is|are)\b/.test(lower)) {
                roleId = 'definition';
              } else if (/^(for example|example|e\.g\.|for instance)\b/.test(lower)) {
                roleId = 'example';
              } else if (/^([-*]|\d+[.)])/.test(lineText) || /\b(first|second|third|types|steps|parts)\b/.test(lower)) {
                roleId = 'list';
              } else if (/\b(in summary|therefore|overall|central idea|key takeaway)\b/.test(lower)) {
                roleId = 'summary';
              }

              if (roleId) lineTokens.forEach((token) => { next[token.index] = roleId; });
            });

            return next;
          });
        },
      },
    ]);
  }, [tokens, updateHighlights]);

  const jumpToPage = useCallback(() => {
    const page = Number(pageDraft);
    if (!Number.isFinite(page)) return;
    setActivePage(Math.min(pages.length - 1, Math.max(0, Math.round(page) - 1)));
  }, [pageDraft, pages.length]);

  const handleWordLongPress = useCallback((index) => {
    const actions = [
      ...COLOR_ROLES.map((role) => ({
        text: `Mark as ${role.label}`,
        onPress: () => applyRoleToRange([index, index], role.id),
      })),
      {
        text: 'Mark Sentence',
        onPress: () => applyRoleToRange(getSentenceRange(tokens, index), activeRole),
      },
      {
        text: 'Mark Paragraph',
        onPress: () => applyRoleToRange(getParagraphRange(tokens, index), activeRole),
      },
      {
        text: 'Remove Highlight',
        style: 'destructive',
        onPress: () => applyRoleToRange([index, index], null),
      },
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Edit Highlight', 'Choose how to update this text.', actions);
  }, [activeRole, applyRoleToRange, tokens]);

  const exportNow = async () => {
    const groups = getHighlightedGroups(tokens, latestHighlightsRef.current);
    if (groups.length === 0) {
      Alert.alert('No Highlights', 'Highlight some text before exporting.');
      return;
    }

    const selectedRoles = Object.fromEntries(COLOR_ROLES.map((role) => [role.id, true]));
    const message = buildExportPayload({ doc, groups, format: 'markdown', selectedRoles });
    await Share.share({ title: `${doc.title} Highlights`, message });
    await appendActivity(`Exported highlights from ${doc.title}.`);
  };

  if (!tokens.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.text} />
          <Text style={styles.loadingText}>Preparing document...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.iconText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>{doc.title}</Text>
          <Text style={styles.topSub}>
            {highlightedTotal} words highlighted | {saveState}
          </Text>
        </View>
        <TouchableOpacity style={styles.previewBtn} onPress={() => navigation?.navigate('Preview', { doc })}>
          <Text style={styles.previewText}>Preview</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.quickButton, tapMode === 'sentence' && styles.quickButtonActive]}
          onPress={() => setTapMode((mode) => (mode === 'word' ? 'sentence' : 'word'))}>
          <Text style={[styles.quickText, tapMode === 'sentence' && styles.quickTextActive]}>
            {tapMode === 'sentence' ? 'Sentence Tap' : 'Word Tap'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickButton, !historyState.undo && styles.quickButtonDisabled]} onPress={undo} disabled={!historyState.undo}>
          <Text style={styles.quickText}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickButton, !historyState.redo && styles.quickButtonDisabled]} onPress={redo} disabled={!historyState.redo}>
          <Text style={styles.quickText}>Redo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickButton} onPress={applySmartSuggestions}>
          <Text style={styles.quickText}>Suggest</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        {COLOR_ROLES.map((role) => (
          <TouchableOpacity
            key={role.id}
            style={[
              styles.roleChip,
              { borderColor: role.color },
              activeRole === role.id && { backgroundColor: role.color },
            ]}
            onPress={() => setActiveRole(role.id)}>
            <Text style={[styles.roleChipText, activeRole === role.id && styles.roleChipTextActive]}>
              {role.shortLabel} {roleCounts[role.id]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search this document"
          placeholderTextColor={theme.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Text style={styles.searchCount}>{searchQuery.trim() ? `${searchMatches} found` : `${activePage + 1}/${pages.length}`}</Text>
      </View>

      {pages.length > 1 && (
        <View style={styles.pageRow}>
          <TouchableOpacity
            style={[styles.pageButton, activePage === 0 && styles.pageButtonDisabled]}
            disabled={activePage === 0}
            onPress={() => setActivePage((page) => Math.max(0, page - 1))}>
          <Text style={styles.pageButtonText}>Prev</Text>
          </TouchableOpacity>
          <View style={styles.pageJump}>
            <Text style={styles.pageText}>Page</Text>
            <TextInput
              style={styles.pageInput}
              value={pageDraft}
              onChangeText={setPageDraft}
              onSubmitEditing={jumpToPage}
              onBlur={jumpToPage}
              keyboardType="number-pad"
            />
            <Text style={styles.pageText}>of {pages.length}</Text>
          </View>
          <TouchableOpacity
            style={[styles.pageButton, activePage === pages.length - 1 && styles.pageButtonDisabled]}
            disabled={activePage === pages.length - 1}
            onPress={() => setActivePage((page) => Math.min(pages.length - 1, page + 1))}>
            <Text style={styles.pageButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {pages.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.minimap} contentContainerStyle={styles.minimapContent}>
          {pages.map((page, index) => {
            const count = pageHighlightCounts[index] || 0;
            const height = Math.min(28, 8 + count * 2);
            return (
              <TouchableOpacity key={page.id} style={styles.mapButton} onPress={() => setActivePage(index)}>
                <View style={[styles.mapBar, index === activePage && styles.mapBarActive, { height }]} />
                <Text style={[styles.mapText, index === activePage && styles.mapTextActive]}>{index + 1}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {rangeMode && (
        <View style={styles.rangeBanner}>
          <Text style={styles.rangeText}>
            {rangeStart === null ? 'Tap the first word in the range.' : 'Tap the last word in the range.'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setRangeMode(false);
              setRangeStart(null);
            }}>
            <Text style={styles.rangeCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        style={styles.canvas}
        contentContainerStyle={styles.canvasContent}
        data={tokenChunks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TokenChunk
            item={item}
            highlights={highlights}
            onWordPress={handleWordPress}
            onWordLongPress={handleWordLongPress}
            searchQuery={searchQuery.trim()}
            styles={styles}
          />
        )}
        ListFooterComponent={<View style={{ height: 130 }} />}
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        removeClippedSubviews
      />

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolbarButton, rangeMode && styles.toolbarButtonActive]}
          onPress={() => {
            setRangeMode((current) => !current);
            setRangeStart(null);
          }}>
          <Text style={[styles.toolbarButtonText, rangeMode && styles.toolbarButtonTextActive]}>
            {rangeMode ? 'Cancel Range' : 'Range'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={clearAll}>
          <Text style={styles.toolbarButtonText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={exportNow}>
          <Text style={styles.exportButtonText}>{saving ? 'Saving...' : 'Export'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: theme.muted, fontSize: 15 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.elevated,
  },
  iconText: { fontSize: 18, fontWeight: '800', color: theme.text },
  topCenter: { flex: 1 },
  topTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
  topSub: { fontSize: 12, color: theme.muted, marginTop: 2 },
  previewBtn: {
    backgroundColor: theme.button,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  previewText: { color: theme.buttonText, fontWeight: '800', fontSize: 13 },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  quickButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.elevated,
    paddingHorizontal: 6,
  },
  quickButtonActive: { backgroundColor: theme.warning },
  quickButtonDisabled: { opacity: 0.45 },
  quickText: { color: theme.text, fontSize: 11, fontWeight: '900' },
  quickTextActive: { color: '#1C1C1E' },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.card,
    gap: 8,
  },
  roleChip: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.card,
    minHeight: 31,
    justifyContent: 'center',
  },
  roleChipText: { fontSize: 12, fontWeight: '800', color: theme.text },
  roleChipTextActive: { color: '#fff' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    fontSize: 14,
  },
  searchCount: { color: theme.muted, fontSize: 12, fontWeight: '900' },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  pageButton: {
    backgroundColor: theme.elevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pageButtonDisabled: { opacity: 0.45 },
  pageButtonText: { color: theme.text, fontSize: 12, fontWeight: '900' },
  pageText: { color: theme.muted, fontSize: 12, fontWeight: '900' },
  pageJump: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageInput: {
    minWidth: 42,
    borderRadius: 9,
    backgroundColor: theme.card,
    color: theme.text,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '900',
  },
  minimap: {
    flexGrow: 0,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  minimapContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'flex-end' },
  mapButton: { alignItems: 'center', justifyContent: 'flex-end', minWidth: 22 },
  mapBar: {
    width: 12,
    borderRadius: 6,
    backgroundColor: theme.elevated,
    borderWidth: 1,
    borderColor: theme.border,
  },
  mapBarActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  mapText: { color: theme.muted, fontSize: 9, fontWeight: '900', marginTop: 3 },
  mapTextActive: { color: theme.text },
  rangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.button,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rangeText: { color: theme.buttonText, fontWeight: '700', flex: 1, fontSize: 13, lineHeight: 18 },
  rangeCancel: { color: theme.warning, fontWeight: '800', fontSize: 13, marginLeft: 12 },
  canvas: { flex: 1 },
  canvasContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  textWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  wordWrap: { paddingHorizontal: 1, paddingVertical: 2, marginVertical: 1 },
  searchHit: { backgroundColor: `${theme.warning}33`, borderRadius: 4 },
  wordText: { fontSize: 17, lineHeight: 28, color: theme.text },
  space: { fontSize: 17, lineHeight: 28, color: 'transparent' },
  lineBreak: { width: '100%' },
  toolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  toolbarButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: theme.elevated,
  },
  toolbarButtonActive: { backgroundColor: theme.warning },
  toolbarButtonText: { color: theme.text, fontWeight: '800', fontSize: 12 },
  toolbarButtonTextActive: { color: '#1C1C1E' },
  exportButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: theme.button,
  },
  exportButtonText: { color: theme.buttonText, fontWeight: '800', fontSize: 12 },
  });
}
