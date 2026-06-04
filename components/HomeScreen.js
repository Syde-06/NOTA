import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
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

function getInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NU';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }) {
  const { session, profile, statusMessage, activityFeed, documents, deleteDocument, highlightsByDoc } = useAppContext();
  const { darkMode, theme } = useNotaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [search, setSearch] = useState('');
  const [recentDocs, setRecentDocs] = useState([]);

  const loadRecent = useCallback(async () => {
    if (!session?.user?.id || !session?.access_token) {
      setRecentDocs(documents.slice(0, 4));
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

      if (!res.ok) throw new Error('Could not load recent documents');
      const data = await res.json();
      const nextDocs = data.map((d) =>
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
      setRecentDocs(nextDocs);
    } catch (error) {
      console.log('Load recent error:', error);
      setRecentDocs(documents.slice(0, 4));
    }
  }, [documents, session]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const filtered = useMemo(
    () => recentDocs.filter((doc) => doc.title.toLowerCase().includes(search.trim().toLowerCase())),
    [recentDocs, search]
  );

  const totalHighlights = useMemo(
    () => Object.values(highlightsByDoc || {}).reduce((sum, map) => sum + Object.keys(map || {}).length, 0),
    [highlightsByDoc]
  );

  const confirmDelete = (doc) => {
    Alert.alert('Delete Document', 'Remove this document from your library?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(doc.id);
          setRecentDocs((current) => current.filter((item) => item.id !== doc.id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.headerTitle}>{profile?.full_name ? `Hi, ${profile.full_name.split(' ')[0]}` : 'Nota'}</Text>
          <Text style={styles.statusLine}>{statusMessage}</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => navigation?.navigate('Profile')}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(profile?.full_name)}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchLabel}>Search</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Documents and notes"
            placeholderTextColor={theme.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <TouchableOpacity style={styles.importBtn} onPress={() => navigation?.navigate('Import')}>
          <Text style={styles.importPlus}>+</Text>
          <View style={styles.importCopy}>
            <Text style={styles.importTitle}>Import Document</Text>
            <Text style={styles.importSub}>PDF or DOCX, up to 50 MB</Text>
          </View>
        </TouchableOpacity>

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
            <Text style={styles.statLabel}>Activity</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Color Roles</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRow}>
          {COLOR_ROLES.map((role) => (
            <View key={role.id} style={styles.legendChip}>
              <View style={[styles.legendDot, { backgroundColor: role.color }]} />
              <Text style={styles.legendLabel}>{role.label}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={() => navigation?.navigate('Document')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{search ? 'No matches' : 'No documents yet'}</Text>
            <Text style={styles.emptySub}>{search ? 'Try a different search.' : 'Import your first document to begin.'}</Text>
          </View>
        ) : (
          filtered.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.docCard}
              onPress={() => navigation?.navigate('Preview', { doc })}
              onLongPress={() => confirmDelete(doc)}
              delayLongPress={350}>
              <View style={styles.docIcon}>
                <Text style={styles.docIconText}>N</Text>
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                <Text style={styles.docMeta}>{doc.pages} pages | {Object.keys(highlightsByDoc?.[doc.id] || {}).length} highlights | {doc.date}</Text>
                <View style={styles.docColors}>
                  {(doc.colors || []).slice(0, 5).map((color) => (
                    <View key={color} style={[styles.miniDot, { backgroundColor: color }]} />
                  ))}
                </View>
              </View>
              <Text style={styles.chevron}>{'>'}</Text>
            </TouchableOpacity>
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>
        {activityFeed.slice(0, 4).map((item) => (
          <View key={item.id} style={styles.activityCard}>
            <View style={styles.activityDot} />
            <View style={styles.activityBody}>
              <Text style={styles.activityText}>{item.message}</Text>
              <Text style={styles.activityMeta}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
          </View>
        ))}
        {!activityFeed.length && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySub}>Imports, edits, and exports will appear here.</Text>
          </View>
        )}

        <View style={{ height: 92 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerCopy: { flex: 1, paddingRight: 16 },
  greeting: { fontSize: 13, color: theme.muted, fontWeight: '700' },
  headerTitle: { fontSize: 27, color: theme.text, fontWeight: '900', marginTop: 2 },
  statusLine: { fontSize: 13, color: theme.subtext, marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.button, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: theme.buttonText, fontWeight: '900', fontSize: 14 },
  scroll: { paddingHorizontal: 20 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 10,
  },
  searchLabel: { color: theme.muted, fontSize: 12, fontWeight: '900' },
  searchInput: { flex: 1, color: theme.text, fontSize: 16 },
  importBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.button, borderRadius: 16, padding: 18, gap: 14 },
  importPlus: { color: theme.buttonText, fontSize: 30, lineHeight: 32 },
  importCopy: { flex: 1 },
  importTitle: { color: theme.buttonText, fontSize: 16, fontWeight: '900' },
  importSub: { color: theme.darkMode ? '#3A3A40' : '#B8B8BE', fontSize: 12, marginTop: 2 },
  statsBanner: { flexDirection: 'row', backgroundColor: theme.card, borderRadius: 16, padding: 18, marginTop: 16, marginBottom: 18 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { color: theme.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: theme.muted, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: theme.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 2 },
  sectionTitle: { color: theme.text, fontSize: 17, fontWeight: '900' },
  seeAll: { color: theme.primary, fontSize: 14, fontWeight: '800' },
  legendRow: { gap: 8, paddingBottom: 18 },
  legendChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, gap: 7 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: theme.text, fontSize: 13, fontWeight: '800' },
  docCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, gap: 13 },
  docIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: theme.elevated, alignItems: 'center', justifyContent: 'center' },
  docIconText: { color: theme.text, fontSize: 18, fontWeight: '900' },
  docInfo: { flex: 1 },
  docTitle: { color: theme.text, fontSize: 15, fontWeight: '900' },
  docMeta: { color: theme.muted, fontSize: 12, marginTop: 4 },
  docColors: { flexDirection: 'row', gap: 4, marginTop: 7 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  chevron: { color: theme.faint, fontWeight: '900', fontSize: 18 },
  activityCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.card, borderRadius: 16, padding: 16, gap: 12, marginBottom: 10 },
  activityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary, marginTop: 5 },
  activityBody: { flex: 1 },
  activityText: { color: theme.text, fontSize: 15, fontWeight: '800' },
  activityMeta: { color: theme.muted, fontSize: 12, marginTop: 4 },
  emptyState: { backgroundColor: theme.card, borderRadius: 16, padding: 28, alignItems: 'center', marginBottom: 12 },
  emptyTitle: { color: theme.text, fontSize: 17, fontWeight: '900' },
  emptySub: { color: theme.muted, textAlign: 'center', marginTop: 5 },
  });
}
