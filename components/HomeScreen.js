import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useAppContext } from '../contexts/AppContext';
import { ROLE_DEFINITIONS } from '../utils/documentUtils';

function getInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function makeColors(dark) {
  return {
    bg: dark ? '#1C1C1E' : '#F5F5F7',
    card: dark ? '#2C2C2E' : '#fff',
    cardBg: dark ? '#3A3A3C' : '#F2F2F7',
    text: dark ? '#F5F5F7' : '#1C1C1E',
    sub: dark ? '#A0A0A8' : '#8E8E93',
    sub2: dark ? '#8A8A8E' : '#4F4F57',
    inputBg: dark ? '#2C2C2E' : '#fff',
    importBtn: dark ? '#F5F5F7' : '#1C1C1E',
    importBtnText: dark ? '#1C1C1E' : '#fff',
    statusBar: dark ? 'light-content' : 'dark-content',
    divider: dark ? '#3A3A3C' : '#E5E5EA',
    actDot: '#007AFF',
  };
}

export default function HomeScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const {
    profile,
    profilePhoto,
    statusMessage,
    activityFeed,
    documents,
    documentsLoading,
    refreshDocuments,
    deleteDocument,
    darkMode,
  } = useAppContext();
  const C = makeColors(darkMode);

  const userName = profile?.full_name || 'Nota User';
  const userInitials = getInitials(userName);
  const recentDocs = useMemo(
    () =>
      documents
        .filter((doc) => doc.title.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 4),
    [documents, search]
  );

  useEffect(() => {
    const unsubscribe = navigation?.addListener('focus', refreshDocuments);
    return unsubscribe;
  }, [navigation, refreshDocuments]);

  const confirmDelete = (docId) => {
    Alert.alert('Delete Document', 'Remove this document from your library?', [
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

  const totalHighlights = documents.reduce(
    (sum, doc) => sum + (doc.highlightCount || 0),
    0
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} />
      <View style={{ height: 25 }} />
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: C.sub }]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>
            Hi, {userName.split(' ')[0]}
          </Text>
          <Text style={[styles.statusLine, { color: C.sub2 }]}>
            {statusMessage}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.avatar, { backgroundColor: C.importBtn }]}
          onPress={() => navigation?.navigate('Profile')}>
          <Text style={[styles.avatarText, { color: C.importBtnText }]}>
            {userInitials}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={[styles.searchWrap, { backgroundColor: C.card }]}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={[styles.searchInput, { color: C.text }]}
            placeholder="Search documents..."
            placeholderTextColor={C.sub}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <TouchableOpacity
          style={[styles.importBtn, { backgroundColor: C.importBtn }]}
          onPress={() => navigation?.navigate('Import')}>
          <Text style={[styles.importIcon, { color: C.importBtnText }]}>+</Text>
          <View>
            <Text style={[styles.importTitle, { color: C.importBtnText }]}>
              Import Document
            </Text>
            <Text
              style={[
                styles.importSub,
                { color: darkMode ? '#8E8E93' : '#A7A7AE' },
              ]}>
              PDF or DOCX, local-first with cloud sync when available
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>
            Color Roles
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.legendScroll}>
            {ROLE_DEFINITIONS.map((role) => (
              <View
                key={role.id}
                style={[styles.legendChip, { backgroundColor: C.card }]}>
                <View
                  style={[styles.legendDot, { backgroundColor: role.color }]}
                />
                <Text style={[styles.legendLabel, { color: C.text }]}>
                  {role.label}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>Recent</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Documents')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {documentsLoading ? (
            <View style={[styles.emptyState, { backgroundColor: C.card }]}>
              <ActivityIndicator size="large" color={C.text} />
              <Text style={[styles.emptySub, { color: C.sub }]}>
                Loading your document library...
              </Text>
            </View>
          ) : recentDocs.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: C.card }]}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={[styles.emptyTitle, { color: C.text }]}>
                No documents
              </Text>
              <Text style={[styles.emptySub, { color: C.sub }]}>
                Import your first PDF or DOCX to start highlighting.
              </Text>
            </View>
          ) : (
            recentDocs.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={[styles.docCard, { backgroundColor: C.card }]}
                onPress={() =>
                  navigation.navigate('HighlightWorkspace', { doc })
                }
                onLongPress={() => confirmDelete(doc.id)}
                delayLongPress={400}>
                <View style={[styles.docIcon, { backgroundColor: C.cardBg }]}>
                  <Text style={styles.docIconText}>📄</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text
                    style={[styles.docTitle, { color: C.text }]}
                    numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={[styles.docMeta, { color: C.sub }]}>
                    {doc.pages} pages · {doc.highlightCount} highlights ·{' '}
                    {doc.date}
                  </Text>
                  <Text style={[styles.syncMeta, { color: C.sub2 }]}>
                    {doc.syncStatus === 'synced'
                      ? 'Cloud synced'
                      : 'Saved on this device'}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: C.sub }]}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>
            Recent Activity
          </Text>
          {activityFeed.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: C.card }]}>
              <Text style={styles.emptyIcon}>🕒</Text>
              <Text style={[styles.emptyTitle, { color: C.text }]}>
                No data available
              </Text>
              <Text style={[styles.emptySub, { color: C.sub }]}>
                Your recent actions will appear here.
              </Text>
            </View>
          ) : (
            activityFeed.slice(0, 4).map((item) => (
              <View
                key={item.id}
                style={[styles.activityCard, { backgroundColor: C.card }]}>
                <View style={styles.activityDot} />
                <View style={styles.activityBody}>
                  <Text style={[styles.activityText, { color: C.text }]}>
                    {item.message}
                  </Text>
                  <Text style={[styles.activityMeta, { color: C.sub }]}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={[styles.statsBanner, { backgroundColor: C.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: C.text }]}>
              {documents.length}
            </Text>
            <Text style={[styles.statLabel, { color: C.sub }]}>Docs</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: C.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: C.text }]}>
              {totalHighlights}
            </Text>
            <Text style={[styles.statLabel, { color: C.sub }]}>Highlights</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: C.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: C.text }]}>
              {activityFeed.length}
            </Text>
            <Text style={[styles.statLabel, { color: C.sub }]}>Actions</Text>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  greeting: { fontSize: 13 },
  headerTitle: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  statusLine: { fontSize: 13, marginTop: 4 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontWeight: '700', fontSize: 16 },
  avatarImage: { width: 42, height: 42, borderRadius: 21 },
  scroll: { paddingHorizontal: 20 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    gap: 14,
  },
  importIcon: { fontSize: 28, fontWeight: '300', lineHeight: 34 },
  importTitle: { fontSize: 16, fontWeight: '700' },
  importSub: { fontSize: 12, marginTop: 2, maxWidth: 250 },
  section: { marginBottom: 20 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  seeAll: { color: '#007AFF', fontSize: 14 },
  legendScroll: { marginHorizontal: -4 },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 4,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 13, fontWeight: '600' },
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
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  docIconText: { fontSize: 22 },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '700' },
  docMeta: { fontSize: 12, marginTop: 3 },
  syncMeta: { fontSize: 12, marginTop: 4 },
  chevron: { fontSize: 22, marginLeft: 8 },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    gap: 12,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: '#007AFF',
  },
  activityBody: { flex: 1 },
  activityText: { fontSize: 15, fontWeight: '600' },
  activityMeta: { fontSize: 12, marginTop: 4 },
  statsBanner: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1 },
  emptyState: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  emptySub: { fontSize: 15, textAlign: 'center' },
});
