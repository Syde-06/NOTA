import React from 'react';
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

function getViewerUrl(doc) {
  const sourceUrl = doc?.url || doc?.localUri || null;
  if (!sourceUrl) return null;
  if (sourceUrl.startsWith('file:')) return sourceUrl;

  const lower = sourceUrl.toLowerCase();
  if (lower.endsWith('.docx')) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sourceUrl)}`;
  }
  if (lower.endsWith('.pdf')) {
    return sourceUrl;
  }
  return sourceUrl;
}

export default function DocumentViewerScreen({ route, navigation }) {
  const doc = route.params?.doc || {};
  const viewerUrl = getViewerUrl(doc);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{doc.title || 'Document'}</Text>
          <Text style={styles.headerSub}>{doc.type || 'File'} · {doc.sizeLabel || 'Ready to view'}</Text>
        </View>
        {doc.url || doc.localUri ? (
          <TouchableOpacity style={styles.openBtn} onPress={() => Linking.openURL(doc.url || doc.localUri)}>
            <Text style={styles.openBtnText}>Open</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {viewerUrl ? (
        <WebView source={{ uri: viewerUrl }} style={styles.webview} startInLoadingState />
      ) : (
        <ScrollView contentContainerStyle={styles.emptyWrap}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Original file unavailable</Text>
            <Text style={styles.emptySub}>
              This document does not have a direct viewer source, but your extracted text and highlights are still available in the workspace.
            </Text>
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#F5F5F7',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 26, color: '#1C1C1E', marginTop: -2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  headerSub: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  openBtn: {
    backgroundColor: '#1C1C1E',
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  openBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  webview: { flex: 1, backgroundColor: '#fff' },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  emptySub: { marginTop: 10, fontSize: 15, color: '#6A6A73', textAlign: 'center', lineHeight: 22 },
});
