import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';
import { useAppContext } from '../contexts/AppContext';
import { COLOR_ROLES, formatBytes, normalizeDocument } from './notaData';
import { useNotaTheme } from './theme';

const SORT_OPTIONS = ['Newest', 'Oldest', 'A-Z', 'Largest'];

function sortDocuments(items, sort) {
  const sorted = [...items].map(normalizeDocument);
  if (sort === 'Oldest') sorted.sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at));
  else if (sort === 'A-Z') sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'Largest') sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
  else sorted.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
  return sorted;
}

export default function DocumentsScreen({ navigation }) {
  const { session, documents, replaceDocuments, deleteDocument } = useAppContext();
  const { darkMode, theme } = useNotaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Newest');
  const [folder, setFolder] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!session?.user?.id || !session?.access_token) {
      setDocs(sortDocuments(documents, sort));
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      let orderParam = 'uploaded_at.desc';
      if (sort === 'Oldest') orderParam = 'uploaded_at.asc';
      else if (sort === 'A-Z') orderParam = 'name.asc';
      else if (sort === 'Largest') orderParam = 'size.desc';

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/documents?user_id=eq.${session.user.id}&deleted_at=is.null&select=id,name,size,uploaded_at,url,extracted_text&order=${orderParam}`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) throw new Error('Could not load documents');
      const data = await res.json();
      const cloudDocs = data.map((d) =>
        normalizeDocument({
          id: d.id,
          title: d.name,
          name: d.name,
          size: d.size,
          sizeLabel: formatBytes(d.size),
          uploaded_at: d.uploaded_at,
          url: d.url,
          extracted_text: d.extracted_text ?? null,
          colors: COLOR_ROLES.slice(0, 2).map((role) => role.color),
        })
      );
      setDocs(cloudDocs);
      replaceDocuments(cloudDocs);
    } catch (error) {
      console.log('Load docs error:', error);
      setDocs(sortDocuments(documents, sort));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [documents, replaceDocuments, session, sort]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDocs();
  };

  const confirmDelete = (doc) => {
    Alert.alert('Delete Document', 'This removes the document and its saved highlights.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (session?.access_token) {
            try {
              await fetch(`${SUPABASE_URL}/rest/v1/documents?id=eq.${doc.id}`, {
                method: 'PATCH',
                headers: {
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ deleted_at: new Date().toISOString() }),
              });
            } catch (error) {
              console.log('Cloud delete failed:', error);
            }
          }
          await deleteDocument(doc.id);
          setDocs((current) => current.filter((item) => item.id !== doc.id));
        },
      },
    ]);
  };

  const folders = useMemo(() => ['All', ...Array.from(new Set(docs.map((doc) => doc.folder || 'General')))], [docs]);
  const filtered = useMemo(
    () => docs.filter((doc) => {
      const matchesSearch = doc.title.toLowerCase().includes(search.trim().toLowerCase());
      const matchesFolder = folder === 'All' || (doc.folder || 'General') === folder;
      return matchesSearch && matchesFolder;
    }),
    [docs, folder, search]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Documents</Text>
          <Text style={styles.headerSub}>{docs.length} files in your library</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation?.navigate('Import')}>
          <Text style={styles.addIcon}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>Search</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Find documents..."
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll} contentContainerStyle={styles.sortContent}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity key={option} style={[styles.sortPill, sort === option && styles.sortPillActive]} onPress={() => setSort(option)}>
            <Text style={[styles.sortPillText, sort === option && styles.sortPillTextActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderScroll} contentContainerStyle={styles.sortContent}>
        {folders.map((item) => (
          <TouchableOpacity key={item} style={[styles.folderPill, folder === item && styles.sortPillActive]} onPress={() => setFolder(item)}>
            <Text style={[styles.sortPillText, folder === item && styles.sortPillTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{search ? 'No matches' : 'No documents yet'}</Text>
              <Text style={styles.emptySub}>{search ? `Nothing matched "${search}".` : 'Import a PDF or DOCX to start highlighting.'}</Text>
              {!search && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation?.navigate('Import')}>
                  <Text style={styles.emptyBtnText}>Import Document</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
                activeOpacity={0.75}
                onPress={() => navigation?.navigate('Preview', { doc })}
                onLongPress={() => confirmDelete(doc)}
                delayLongPress={350}>
                <View style={styles.docIconWrap}>
                  <Text style={styles.docIconText}>DOC</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={2}>{doc.title}</Text>
                  <Text style={styles.docMeta}>{doc.folder} | {doc.syncStatus} | {doc.sizeLabel} | {doc.date}</Text>
                  {doc.tags?.length ? <Text style={styles.docTags}>{doc.tags.map((tag) => `#${tag}`).join(' ')}</Text> : null}
                  <View style={styles.docColors}>
                    {(doc.colors || []).slice(0, 5).map((color) => (
                      <View key={color} style={[styles.miniDot, { backgroundColor: color }]} />
                    ))}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.smallAction} onPress={() => navigation?.navigate('HighlightWorkspace', { doc })}>
                    <Text style={styles.smallActionText}>Mark</Text>
                  </TouchableOpacity>
                  <Text style={styles.chevron}>{'>'}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <Text style={styles.hintText}>Long press a document to delete it.</Text>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: theme.text },
  headerSub: { color: theme.subtext, fontSize: 13, marginTop: 2 },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: { color: theme.buttonText, fontSize: 27, lineHeight: 30 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  searchIcon: { color: theme.muted, fontSize: 12, fontWeight: '800' },
  searchInput: { flex: 1, color: theme.text, fontSize: 16 },
  clearText: { color: theme.primary, fontWeight: '700', fontSize: 12 },
  sortScroll: { flexGrow: 0, marginBottom: 10 },
  folderScroll: { flexGrow: 0, marginBottom: 10 },
  sortContent: { paddingHorizontal: 20, gap: 8 },
  sortPill: {
    height: 35,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sortPillActive: { backgroundColor: theme.button, borderColor: theme.button },
  folderPill: {
    height: 35,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sortPillText: { color: theme.subtext, fontWeight: '800', fontSize: 13 },
  sortPillTextActive: { color: theme.buttonText },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  docIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: theme.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconText: { color: theme.text, fontWeight: '900', fontSize: 12 },
  docInfo: { flex: 1 },
  docTitle: { color: theme.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  docMeta: { color: theme.muted, fontSize: 12, marginTop: 4 },
  docTags: { color: theme.primary, fontSize: 11, marginTop: 4, fontWeight: '800' },
  docColors: { flexDirection: 'row', gap: 4, marginTop: 8 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  cardActions: { alignItems: 'center', gap: 5 },
  smallAction: { backgroundColor: theme.elevated, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  smallActionText: { color: theme.text, fontSize: 11, fontWeight: '800' },
  chevron: { color: theme.faint, fontSize: 18, fontWeight: '800' },
  emptyState: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 36,
    alignItems: 'center',
    marginTop: 18,
  },
  emptyTitle: { fontSize: 18, color: theme.text, fontWeight: '900' },
  emptySub: { color: theme.muted, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  emptyBtn: { backgroundColor: theme.button, borderRadius: 13, paddingHorizontal: 22, paddingVertical: 12, marginTop: 18 },
  emptyBtnText: { color: theme.buttonText, fontWeight: '800' },
  hintText: { color: theme.faint, fontSize: 12, textAlign: 'center', marginTop: 8 },
  });
}
