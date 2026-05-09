import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppContext } from '../contexts/AppContext';

const SORT_OPTIONS = ['Newest', 'Oldest', 'A-Z', 'Largest', 'Most Highlighted'];

function makeColors(dark) {
  return {
    bg: dark ? '#1C1C1E' : '#F5F5F7',
    card: dark ? '#2C2C2E' : '#fff',
    cardBg: dark ? '#3A3A3C' : '#F2F2F7',
    text: dark ? '#F5F5F7' : '#1C1C1E',
    sub: dark ? '#A0A0A8' : '#8E8E93',
    sub2: dark ? '#8A8A8E' : '#4F4F57',
    statusBar: dark ? 'light-content' : 'dark-content',
    pillActive: dark ? '#F5F5F7' : '#1C1C1E',
    pillActiveTxt: dark ? '#1C1C1E' : '#fff',
    border: dark ? '#3A3A3C' : '#E5E5EA',
    dot: dark ? '#636366' : '#C7C7CC',
  };
}

export default function DocumentsScreen({ navigation }) {
  const {
    documents,
    documentsLoading,
    refreshDocuments,
    deleteDocument,
    darkMode,
  } = useAppContext();
  const C = makeColors(darkMode);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Newest');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const searched = documents.filter((doc) =>
      doc.title.toLowerCase().includes(search.toLowerCase())
    );
    return [...searched].sort((left, right) => {
      if (sort === 'Oldest')
        return (
          new Date(left.uploaded_at).getTime() -
          new Date(right.uploaded_at).getTime()
        );
      if (sort === 'A-Z') return left.title.localeCompare(right.title);
      if (sort === 'Largest') return (right.size || 0) - (left.size || 0);
      if (sort === 'Most Highlighted')
        return (right.highlightCount || 0) - (left.highlightCount || 0);
      return (
        new Date(right.uploaded_at).getTime() -
        new Date(left.uploaded_at).getTime()
      );
    });
  }, [documents, search, sort]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshDocuments();
    setRefreshing(false);
  };
  const handleDelete = (docId) => {
    Alert.alert('Delete Document', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteDocument(docId);
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} />
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: C.card }]}
          onPress={() => navigation?.goBack()}>
          <Text style={[styles.backIcon, { color: C.text }]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.text }]}>
            All Documents
          </Text>
          <Text style={[styles.headerSub, { color: C.sub }]}>
            {documents.length} files
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: C.pillActive }]}
          onPress={() => navigation?.navigate('Import')}>
          <Text style={[styles.addIcon, { color: C.pillActiveTxt }]}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: C.card }]}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={[styles.searchInput, { color: C.text }]}
          placeholder="Search documents..."
          placeholderTextColor={C.sub}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={[styles.clearBtn, { color: C.sub }]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sortScroll}
        contentContainerStyle={styles.sortContent}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.sortPill,
              {
                backgroundColor: sort === option ? C.pillActive : C.card,
                borderColor: sort === option ? C.pillActive : C.border,
              },
            ]}
            onPress={() => setSort(option)}>
            <Text
              style={[
                styles.sortPillText,
                { color: sort === option ? C.pillActiveTxt : C.sub },
              ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {documentsLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.text} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: C.card }]}>
              <Text style={styles.emptyIcon}>{search ? '⌕' : '📂'}</Text>
              <Text style={[styles.emptyTitle, { color: C.text }]}>
                {search ? 'No results found' : 'No documents yet'}
              </Text>
              <Text style={[styles.emptySub, { color: C.sub }]}>
                {search
                  ? `Nothing matched "${search}"`
                  : 'Import your first PDF or DOCX'}
              </Text>
              {!search ? (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: C.pillActive }]}
                  onPress={() => navigation?.navigate('Import')}>
                  <Text
                    style={[styles.emptyBtnText, { color: C.pillActiveTxt }]}>
                    Import Document
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            filtered.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={[styles.docCard, { backgroundColor: C.card }]}
                onPress={() =>
                  navigation?.navigate('HighlightWorkspace', { doc })
                }
                onLongPress={() => handleDelete(doc.id)}
                delayLongPress={400}
                activeOpacity={0.8}>
                <View
                  style={[styles.docIconWrap, { backgroundColor: C.cardBg }]}>
                  <Text style={styles.docIconText}>📄</Text>
                  <View style={styles.fileTypeBadge}>
                    <Text style={styles.fileTypeText}>{doc.type}</Text>
                  </View>
                </View>
                <View style={styles.docInfo}>
                  <Text
                    style={[styles.docTitle, { color: C.text }]}
                    numberOfLines={2}>
                    {doc.title}
                  </Text>
                  <View style={styles.docMetaRow}>
                    <Text style={[styles.docMeta, { color: C.sub }]}>
                      {doc.pages} pages
                    </Text>
                    <View
                      style={[styles.metaDot, { backgroundColor: C.dot }]}
                    />
                    <Text style={[styles.docMeta, { color: C.sub }]}>
                      {doc.sizeLabel}
                    </Text>
                    <View
                      style={[styles.metaDot, { backgroundColor: C.dot }]}
                    />
                    <Text style={[styles.docMeta, { color: C.sub }]}>
                      {doc.date}
                    </Text>
                  </View>
                  <Text style={[styles.docSync, { color: C.sub2 }]}>
                    {doc.highlightCount} highlights ·{' '}
                    {doc.syncStatus === 'synced'
                      ? 'Cloud synced'
                      : 'Local only'}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: C.dot }]}>›</Text>
              </TouchableOpacity>
            ))
          )}
          {filtered.length > 0 ? (
            <Text style={[styles.hintText, { color: C.dot }]}>
              Long press a document to delete
            </Text>
          ) : null}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  backIcon: { fontSize: 26, marginTop: -2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 1 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: { fontSize: 24, fontWeight: '300', lineHeight: 30 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
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
  searchInput: { flex: 1, fontSize: 16 },
  clearBtn: { fontSize: 14, paddingLeft: 8 },
  sortScroll: { marginBottom: 10, flexGrow: 0 },
  sortContent: { paddingHorizontal: 20, gap: 8 },
  sortPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 35,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  sortPillText: { fontSize: 13, fontWeight: '600' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  docTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  docMeta: { fontSize: 12 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5 },
  docSync: { fontSize: 12, marginTop: 8 },
  chevron: { fontSize: 22, marginLeft: 8 },
  hintText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyState: {
    borderRadius: 20,
    padding: 48,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyIcon: { fontSize: 40, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 20,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '700' },
});
