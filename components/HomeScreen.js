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
} from 'react-native';
import { useAppContext } from '../contexts/AppContext';
import { ROLE_DEFINITIONS } from '../utils/documentUtils';

function getInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const {
    profile,
    statusMessage,
    activityFeed,
    documents,
    documentsLoading,
    refreshDocuments,
    deleteDocument,
  } = useAppContext();

  const userName = profile?.full_name || 'Nota User';
  const userInitials = getInitials(userName);
  const recentDocs = useMemo(
    () => documents.filter((doc) => doc.title.toLowerCase().includes(search.toLowerCase())).slice(0, 4),
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
          if (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const totalHighlights = documents.reduce((sum, doc) => sum + (doc.highlightCount || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={{ height: 25 }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.headerTitle}>Hi, {userName.split(' ')[0]}</Text>
          <Text style={styles.statusLine}>{statusMessage}</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => navigation?.navigate('Profile')}>
          <Text style={styles.avatarText}>{userInitials}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            placeholderTextColor="#8E8E93"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <TouchableOpacity style={styles.importBtn} onPress={() => navigation?.navigate('Import')}>
          <Text style={styles.importIcon}>+</Text>
          <View>
            <Text style={styles.importTitle}>Import Document</Text>
            <Text style={styles.importSub}>PDF or DOCX, local-first with cloud sync when available</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color Roles</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll}>
            {ROLE_DEFINITIONS.map((role) => (
              <View key={role.id} style={styles.legendChip}>
                <View style={[styles.legendDot, { backgroundColor: role.color }]} />
                <Text style={styles.legendLabel}>{role.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Documents')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {documentsLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#1C1C1E" />
              <Text style={styles.emptySub}>Loading your document library...</Text>
            </View>
          ) : recentDocs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>No documents</Text>
              <Text style={styles.emptySub}>Import your first PDF or DOCX to start highlighting.</Text>
            </View>
          ) : (
            recentDocs.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
                onPress={() => navigation.navigate('HighlightWorkspace', { doc })}
                onLongPress={() => confirmDelete(doc.id)}
                delayLongPress={400}
              >
                <View style={styles.docIcon}>
                  <Text style={styles.docIconText}>📄</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                  <Text style={styles.docMeta}>
                    {doc.pages} pages · {doc.highlightCount} highlights · {doc.date}
                  </Text>
                  <Text style={styles.syncMeta}>
                    {doc.syncStatus === 'synced' ? 'Cloud synced' : 'Saved on this device'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {activityFeed.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🕒</Text>
              <Text style={styles.emptyTitle}>No data available</Text>
              <Text style={styles.emptySub}>Your recent actions will appear here.</Text>
            </View>
          ) : (
            activityFeed.slice(0, 4).map((item) => (
              <View key={item.id} style={styles.activityCard}>
                <View style={styles.activityDot} />
                <View style={styles.activityBody}>
                  <Text style={styles.activityText}>{item.message}</Text>
                  <Text style={styles.activityMeta}>{new Date(item.createdAt).toLocaleString()}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.statsBanner}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{documents.length}</Text>
            <Text style={styles.statLabel}>Docs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalHighlights}</Text>
            <Text style={styles.statLabel}>Highlights</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{activityFeed.length}</Text>
            <Text style={styles.statLabel}>Actions</Text>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  greeting: { fontSize: 13, color: '#8E8E93' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1C1C1E', marginTop: 2 },
  statusLine: { fontSize: 13, color: '#6A6A73', marginTop: 4 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { paddingHorizontal: 20 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  searchInput: { flex: 1, fontSize: 16, color: '#1C1C1E' },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    gap: 14,
  },
  importIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 34 },
  importTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  importSub: { color: '#A7A7AE', fontSize: 12, marginTop: 2, maxWidth: 250 },
  section: { marginBottom: 20 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
  seeAll: { color: '#007AFF', fontSize: 14 },
  legendScroll: { marginHorizontal: -4 },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  legendLabel: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
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
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  docIconText: { fontSize: 22 },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  docMeta: { fontSize: 12, color: '#8E8E93', marginTop: 3 },
  syncMeta: { fontSize: 12, color: '#4F4F57', marginTop: 4 },
  chevron: { fontSize: 22, color: '#C7C7CC', marginLeft: 8 },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    gap: 12,
  },
  activityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: '#007AFF' },
  activityBody: { flex: 1 },
  activityText: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  activityMeta: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E5E5EA' },
  emptyState: {
    backgroundColor: '#fff',
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
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  emptySub: { fontSize: 15, color: '#8E8E93', textAlign: 'center' },
});
