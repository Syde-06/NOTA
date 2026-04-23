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

function getInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning 👋';
  if (hour < 18) return 'Good afternoon 👋';
  return 'Good evening 👋';
}

export default function HomeScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [recentDocs, setRecentDocs] = useState([]);
  const { session, profile, statusMessage, activityFeed } = useAppContext();
  const userName = profile?.full_name || '';
  const userInitials = getInitials(userName);

  const loadRecent = useCallback(async () => {
    if (!session?.user?.id || !session?.access_token) {
      setRecentDocs([]);
      return;
    }

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/documents?user_id=eq.${session.user.id}&deleted_at=is.null&select=id,name,size,uploaded_at,url,extracted_text&order=uploaded_at.desc&limit=4`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setRecentDocs(
          data.map((d) => ({
            id: d.id,
            title: d.name,
            pages: Math.round((d.size || 0) / 10000) || '?',
            highlights: 0,
            date: new Date(d.uploaded_at).toLocaleDateString() || 'Today',
            url: d.url,
            extracted_text: d.extracted_text ?? null,
            colors: ['#FF3B30', '#FFCC00'],
          }))
        );
      }
    } catch (e) {
      console.log('Load recent error:', e);
    }
  }, [session]);

  useEffect(() => {
    loadRecent();
    const unsubscribe = navigation?.addListener('focus', () => {
      loadRecent();
    });
    return unsubscribe;
  }, [navigation, loadRecent]);

  const deleteDocument = async (docId) => {
    if (!session?.access_token) {
      Alert.alert('Unavailable', 'Document deletion requires a signed-in cloud account.');
      return;
    }

    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await fetch(
              `${SUPABASE_URL}/rest/v1/documents?id=eq.${docId}`,
              {
                method: 'PATCH',
                headers: {
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ deleted_at: new Date().toISOString() }),
              }
            );

            if (res.ok || res.status === 204) {
              setRecentDocs((prev) => prev.filter((d) => d.id !== docId));
            } else {
              Alert.alert('Error', 'Failed to delete document.');
            }
          },
        },
      ]
    );
  };

  const filtered = recentDocs.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={{ height: 25 }} />
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.headerTitle}>
            {userName ? `Hi, ${userName.split(' ')[0]}` : 'Your Documents'}
          </Text>
          <Text style={styles.statusLine}>{statusMessage}</Text>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => navigation?.navigate('Profile')}>
          <Text style={styles.avatarText}>{userInitials}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
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
        </View>

        {/* Quick Import */}
        <TouchableOpacity
          style={styles.importBtn}
          onPress={() => navigation?.navigate('Import')}>
          <Text style={styles.importIcon}>+</Text>
          <View>
            <Text style={styles.importTitle}>Import Document</Text>
            <Text style={styles.importSub}>PDF or DOCX • up to 50 MB</Text>
          </View>
        </TouchableOpacity>

        {/* Color Legend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color Roles</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.legendScroll}>
            {COLOR_ROLES.map((r, i) => (
              <View key={i} style={styles.legendChip}>
                <View
                  style={[styles.legendDot, { backgroundColor: r.color }]}
                />
                <Text style={styles.legendLabel}>{r.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Recent Documents */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Documents')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>No documents</Text>
              <Text style={styles.emptySub}>Import your first PDF or DOCX</Text>
            </View>
          ) : (
            filtered.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
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
                delayLongPress={400}>
                <View style={styles.docIcon}>
                  <Text style={styles.docIconText}>📄</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={styles.docMeta}>
                    {doc.pages} pages · {doc.highlights} highlights · {doc.date}
                  </Text>
                  <View style={styles.docColors}>
                    {doc.colors.map((c, i) => (
                      <View
                        key={i}
                        style={[styles.miniDot, { backgroundColor: c }]}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>

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
                  <Text style={styles.activityMeta}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Stats Banner */}
        <View style={styles.statsBanner}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{recentDocs.length}</Text>
            <Text style={styles.statLabel}>Docs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Highlights</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Exports</Text>
          </View>
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>
      <View style={{ height: 20 }} />
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 2,
  },
  statusLine: {
    fontSize: 13,
    color: '#6A6A73',
    marginTop: 4,
  },
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
  importIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 34,
  },
  importTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  importSub: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  section: { marginBottom: 20 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
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
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: '#007AFF',
  },
  activityBody: {
    flex: 1,
  },
  activityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  activityMeta: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
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
  docColors: { flexDirection: 'row', gap: 4, marginTop: 6 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  chevron: { fontSize: 22, color: '#C7C7CC', marginLeft: 8 },
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
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  emptySub: { fontSize: 15, color: '#8E8E93', textAlign: 'center' },
});
