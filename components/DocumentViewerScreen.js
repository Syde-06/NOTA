import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAppContext } from '../contexts/AppContext';
import { normalizeDocument } from './notaData';
import { useNotaTheme } from './theme';

function getViewerUrl(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.startsWith('file:')) return url;
  if (lower.includes('.docx')) return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  if (lower.includes('.pdf')) return `https://docs.google.com/gviewer?embedded=true&url=${encodeURIComponent(url)}`;
  return url;
}

export default function DocumentViewerScreen({ route, navigation }) {
  const { documents } = useAppContext();
  const { darkMode, theme } = useNotaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const routeDoc = normalizeDocument(route?.params?.doc || documents[0] || {});
  const doc = documents.find((item) => item.id === routeDoc.id) || routeDoc;
  const [loading, setLoading] = useState(Boolean(doc.url));
  const [failed, setFailed] = useState(false);
  const viewerUrl = getViewerUrl(doc.url);
  const paragraphs = useMemo(() => (doc.extracted_text || '').split(/\n{2,}/).filter(Boolean), [doc.extracted_text]);

  const shareDoc = async () => {
    await Share.share({
      title: doc.title,
      message: doc.url ? `${doc.title}\n${doc.url}` : `${doc.title}\n\n${doc.extracted_text || ''}`,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.iconText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{doc.title}</Text>
          <Text style={styles.headerSub}>{doc.pages} pages | {doc.sizeLabel}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={shareDoc}>
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>
      </View>

      {viewerUrl && !failed ? (
        <View style={styles.viewer}>
          <WebView
            source={{ uri: viewerUrl }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setFailed(true);
              setLoading(false);
            }}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.text} />
              <Text style={styles.loadingText}>Loading source...</Text>
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={styles.fallback} contentContainerStyle={styles.fallbackContent}>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Source preview unavailable</Text>
            <Text style={styles.noticeSub}>Showing extracted text instead.</Text>
          </View>
          {paragraphs.length ? (
            paragraphs.map((paragraph, index) => (
              <Text key={`${index}-${paragraph.slice(0, 12)}`} style={styles.paragraph}>{paragraph}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>No source URL or extracted text is available for this document.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10, backgroundColor: theme.background },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: theme.text, fontSize: 18, fontWeight: '900' },
  headerCenter: { flex: 1 },
  headerTitle: { color: theme.text, fontSize: 16, fontWeight: '900' },
  headerSub: { color: theme.muted, fontSize: 12, marginTop: 2 },
  shareBtn: { backgroundColor: theme.button, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  shareText: { color: theme.buttonText, fontWeight: '900', fontSize: 12 },
  viewer: { flex: 1, backgroundColor: theme.card },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: theme.muted, fontSize: 15, fontWeight: '700' },
  fallback: { flex: 1 },
  fallbackContent: { padding: 20 },
  notice: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  noticeTitle: { color: theme.text, fontSize: 16, fontWeight: '900' },
  noticeSub: { color: theme.muted, marginTop: 4 },
  paragraph: { color: theme.text, fontSize: 16, lineHeight: 25, marginBottom: 14 },
  });
}
