import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { useAppContext } from '../contexts/AppContext';

const COLOR_ROLES = [
  { color: '#FF3B30', label: 'Title' },
  { color: '#FFCC00', label: 'Definition' },
  { color: '#34C759', label: 'List' },
  { color: '#007AFF', label: 'Example' },
  { color: '#AF52DE', label: 'Summary' },
];

const SORT_OPTIONS = ['Newest', 'Oldest', 'A–Z', 'Largest'];

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsScreen({ navigation }) {
  const { session } = useAppContext();
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Newest');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!session?.user?.id || !session?.access_token) {
      setDocs([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      let orderParam = 'uploaded_at.desc';
      if (sort === 'Oldest') orderParam = 'uploaded_at.asc';
      else if (sort === 'A–Z') orderParam = 'name.asc';
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

      if (res.ok) {
        const data = await res.json();
        setDocs(
          data.map((d) => ({
            id: d.id,
            title: d.name,
            size: d.size,
            sizeLabel: formatBytes(d.size),
            pages: Math.round((d.size || 0) / 10000) || '?',
            date: new Date(d.uploaded_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            url: d.url,
            extracted_text: d.extracted_text ?? null,
            colors: COLOR_ROLES.slice(0, 2).map((r) => r.color),
          }))
        );
      }
    } catch (e) {
      console.log('Load docs error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, sort]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    const unsubscribe = navigation?.addListener('focus', loadDocs);
    return unsubscribe;
  }, [navigation, loadDocs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDocs();
  };

  const deleteDocument = (docId) => {
    Alert.alert('Delete Document', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const {
            access_token,
          } = session || {};
          if (!access_token) {
            Alert.alert('Unavailable', 'Document deletion requires a signed-in cloud account.');
            return;
          }

          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/documents?id=eq.${docId}`,
            {
              method: 'PATCH',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ deleted_at: new Date().toISOString() }),
            }
          );

          if (res.ok || res.status === 204) {
            setDocs((prev) => prev.filter((d) => d.id !== docId));
          } else {
            Alert.alert('Error', 'Failed to delete document.');
          }
        },
      },
    ]);
  };

  const filtered = docs.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>All Documents</Text>
          <Text style={styles.headerSub}>{docs.length} files</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation?.navigate('Import')}>
          <Text style={styles.addIcon}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          placeholderTextColor="#8E8E93"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sort Pills */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sortScroll}
          contentContainerStyle={styles.sortContent}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.sortPill, sort === opt && styles.sortPillActive]}
              onPress={() => setSort(opt)}>
              <Text
                style={[
                  styles.sortPillText,
                  sort === opt && styles.sortPillTextActive,
                ]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1C1C1E" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{search ? '🔎' : '📂'}</Text>
              <Text style={styles.emptyTitle}>
                {search ? 'No results found' : 'No documents yet'}
              </Text>
              <Text style={styles.emptySub}>
                {search
                  ? `Nothing matched "${search}"`
                  : 'Import your first PDF or DOCX'}
              </Text>
              {!search && (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => navigation?.navigate('Import')}>
                  <Text style={styles.emptyBtnText}>Import Document</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {filtered.map((doc, index) => (
                <TouchableOpacity
                  key={doc.id}
                  style={[
                    styles.docCard,
                    index === filtered.length - 1 && { marginBottom: 0 },
                  ]}
                  onPress={() =>
                    navigation?.navigate('HighlightWorkspace', {
                      doc: {
                        title: doc.title,
                        url: doc.url,
                        extracted_text: doc.extracted_text,
                      },
                    })
                  }
                  onLongPress={() => deleteDocument(doc.id)}
                  delayLongPress={400}
                  activeOpacity={0.7}>
                  <View style={styles.docIconWrap}>
                    <Text style={styles.docIconText}>📄</Text>
                    <View style={styles.fileTypeBadge}>
                      <Text style={styles.fileTypeText}>
                        {doc.title?.toLowerCase().endsWith('.pdf')
                          ? 'PDF'
                          : 'DOC'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle} numberOfLines={2}>
                      {doc.title}
                    </Text>
                    <View style={styles.docMetaRow}>
                      <Text style={styles.docMeta}>{doc.pages} pages</Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.docMeta}>{doc.sizeLabel}</Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.docMeta}>{doc.date}</Text>
                    </View>
                    <View style={styles.docColors}>
                      {doc.colors.map((c, i) => (
                        <View
                          key={i}
                          style={[styles.miniDot, { backgroundColor: c }]}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={styles.hintText}>
                Long press a document to delete
              </Text>
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  backIcon: { fontSize: 26, color: '#1C1C1E', marginTop: -2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  headerSub: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: { color: '#fff', fontSize: 24, fontWeight: '300', lineHeight: 30 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#1C1C1E' },
  clearBtn: { fontSize: 14, color: '#8E8E93', paddingLeft: 8 },
  sortScroll: { 
    marginBottom: 10, // The requested 10px gap
    flexGrow: 0,      // Ensures the horizontal scroll doesn't expand
  },
  sortContent: { paddingHorizontal: 20, gap: 8 },
  sortPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 35,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center'
  },
  sortPillActive: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  sortPillText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  sortPillTextActive: { color: '#fff' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { 
    flex: 1, // Ensures the scroll view takes up the remaining screen space
  },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingTop: 0, // Set to 0 so the first item starts exactly after the 10px margin
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  docIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    position: 'relative',
  },
  docIconText: { fontSize: 26 },
  fileTypeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  fileTypeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  docInfo: { flex: 1 },
  docTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 20,
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  docMeta: { fontSize: 12, color: '#8E8E93' },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#C7C7CC',
  },
  docColors: { flexDirection: 'row', gap: 4, marginTop: 8 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  cardActions: { marginLeft: 8, alignItems: 'center' },
  chevron: { fontSize: 22, color: '#C7C7CC' },
  hintText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#C7C7CC',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 48,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyIcon: { fontSize: 52, marginBottom: 14 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
