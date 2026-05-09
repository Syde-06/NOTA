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
import { useAppContext } from '../contexts/AppContext';

function getViewerUrl(doc) {
  const sourceUrl = doc?.url || doc?.localUri || null;
  if (!sourceUrl) return null;
  if (sourceUrl.startsWith('file:')) return sourceUrl;
  const lower = sourceUrl.toLowerCase();
  if (lower.endsWith('.docx'))
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      sourceUrl
    )}`;
  return sourceUrl;
}

function makeColors(dark) {
  return {
    bg: dark ? '#1C1C1E' : '#F5F5F7',
    card: dark ? '#2C2C2E' : '#fff',
    text: dark ? '#F5F5F7' : '#1C1C1E',
    sub: dark ? '#A0A0A8' : '#8E8E93',
    sub2: dark ? '#8A8A8E' : '#6A6A73',
    backBtn: dark ? '#2C2C2E' : '#fff',
    openBtn: dark ? '#F5F5F7' : '#1C1C1E',
    openBtnText: dark ? '#1C1C1E' : '#fff',
    statusBar: dark ? 'light-content' : 'dark-content',
  };
}

export default function DocumentViewerScreen({ route, navigation }) {
  const { darkMode } = useAppContext();
  const C = makeColors(darkMode);
  const doc = route.params?.doc || {};
  const viewerUrl = getViewerUrl(doc);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} />
      <View style={[styles.header, { backgroundColor: C.bg }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: C.backBtn }]}
          onPress={() => navigation?.goBack()}>
          <Text style={[styles.backIcon, { color: C.text }]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text
            style={[styles.headerTitle, { color: C.text }]}
            numberOfLines={1}>
            {doc.title || 'Document'}
          </Text>
          <Text style={[styles.headerSub, { color: C.sub }]}>
            {doc.type || 'File'} · {doc.sizeLabel || 'Ready to view'}
          </Text>
        </View>
        {doc.url || doc.localUri ? (
          <TouchableOpacity
            style={[styles.openBtn, { backgroundColor: C.openBtn }]}
            onPress={() => Linking.openURL(doc.url || doc.localUri)}>
            <Text style={[styles.openBtnText, { color: C.openBtnText }]}>
              Open
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {viewerUrl ? (
        <WebView
          source={{ uri: viewerUrl }}
          style={[styles.webview, { backgroundColor: C.card }]}
          startInLoadingState
        />
      ) : (
        <ScrollView contentContainerStyle={styles.emptyWrap}>
          <View style={[styles.emptyCard, { backgroundColor: C.card }]}>
            <Text style={[styles.emptyTitle, { color: C.text }]}>
              Original file unavailable
            </Text>
            <Text style={[styles.emptySub, { color: C.sub2 }]}>
              This document does not have a direct viewer source, but your
              extracted text and highlights are still available in the
              workspace.
            </Text>
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 26, marginTop: -2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  openBtn: { borderRadius: 19, paddingHorizontal: 14, paddingVertical: 9 },
  openBtnText: { fontSize: 13, fontWeight: '700' },
  webview: { flex: 1 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyCard: { borderRadius: 18, padding: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: {
    marginTop: 10,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
