import React, { useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../contexts/AppContext';
import { COLOR_ROLES, getHighlightedGroups, isExtractionFallbackText, normalizeDocument, splitIntoTokens } from './notaData';
import { useNotaTheme } from './theme';

export default function PreviewScreen({ route, navigation }) {
  const { documents, highlightsByDoc, deleteDocument } = useAppContext();
  const { darkMode, theme } = useNotaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const routeDoc = normalizeDocument(route?.params?.doc || documents[0] || {});
  const doc = documents.find((item) => item.id === routeDoc.id) || routeDoc;
  const tokens = useMemo(() => splitIntoTokens(doc.extracted_text || ''), [doc.extracted_text]);
  const highlights = highlightsByDoc?.[doc.id] || {};
  const groups = useMemo(() => getHighlightedGroups(tokens, highlights), [tokens, highlights]);
  const textPreview = (doc.extracted_text || '').split(/\n{2,}/).filter(Boolean).slice(0, 5);
  const extractionFallback = isExtractionFallbackText(doc.extracted_text);

  const confirmDelete = () => {
    Alert.alert('Delete Document', 'Remove this document and its highlights?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(doc.id);
          navigation?.navigate('Document');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview</Text>
        <TouchableOpacity onPress={() => navigation?.navigate('Export', { doc })} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.docHero}>
          <View style={styles.docMark}>
            <Text style={styles.docMarkText}>N</Text>
          </View>
          <View style={styles.docHeroCopy}>
            <Text style={styles.docTitle}>{doc.title}</Text>
            <Text style={styles.docMeta}>{doc.pages} pages | {doc.sizeLabel} | {doc.date}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryAction} onPress={() => navigation?.navigate('HighlightWorkspace', { doc })}>
            <Text style={styles.primaryActionText}>Highlight</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation?.navigate('DocumentViewer', { doc })}>
            <Text style={styles.secondaryActionText}>View Source</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerAction} onPress={confirmDelete}>
            <Text style={styles.dangerActionText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {extractionFallback && (
          <View style={styles.warningBlock}>
            <Text style={styles.warningTitle}>This file may be scanned</Text>
            <Text style={styles.warningText}>
              OCR is needed for scanned PDFs. You can preview the source, paste text manually, or enable OCR on the Edge Function.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Roles</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRow}>
          {COLOR_ROLES.map((role) => (
            <View key={role.id} style={styles.legendChip}>
              <View style={[styles.legendDot, { backgroundColor: role.color }]} />
              <Text style={styles.legendLabel}>{role.label}</Text>
              <Text style={styles.legendCount}>{Object.values(highlights).filter((id) => id === role.id).length}</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Structured Highlights</Text>
        {groups.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No highlights yet</Text>
            <Text style={styles.emptySub}>Open the highlighter and tap words to structure this document.</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.id} style={[styles.highlightBlock, { borderLeftColor: group.role.color }]}>
              <Text style={[styles.blockLabel, { color: group.role.color }]}>{group.role.label}</Text>
              <Text style={styles.blockText}>{group.text}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Text Preview</Text>
        <View style={styles.previewPaper}>
          {textPreview.length ? (
            textPreview.map((paragraph, index) => (
              <Text key={`${index}-${paragraph.slice(0, 10)}`} style={styles.paragraph}>{paragraph}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>No extracted text is available for this document.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerButton: { minWidth: 64 },
  headerButtonText: { color: theme.primary, fontSize: 16, fontWeight: '800' },
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: '900' },
  content: { padding: 20, paddingBottom: 40 },
  docHero: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 18, padding: 18, gap: 16, marginBottom: 14 },
  docMark: { width: 64, height: 78, borderRadius: 10, backgroundColor: theme.button, alignItems: 'center', justifyContent: 'center' },
  docMarkText: { color: theme.buttonText, fontSize: 30, fontWeight: '900' },
  docHeroCopy: { flex: 1 },
  docTitle: { color: theme.text, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  docMeta: { color: theme.muted, fontSize: 13, marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  primaryAction: { flex: 1, backgroundColor: theme.button, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  primaryActionText: { color: theme.buttonText, fontWeight: '900' },
  secondaryAction: { flex: 1, backgroundColor: theme.card, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  secondaryActionText: { color: theme.text, fontWeight: '900' },
  dangerAction: { backgroundColor: theme.dangerBg, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, alignItems: 'center' },
  dangerActionText: { color: theme.danger, fontWeight: '900' },
  sectionTitle: { color: theme.muted, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginBottom: 10 },
  legendRow: { gap: 8, paddingBottom: 20 },
  legendChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, gap: 7 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { color: theme.text, fontWeight: '800', fontSize: 12 },
  legendCount: { color: theme.muted, fontWeight: '900', fontSize: 12 },
  emptyBlock: { backgroundColor: theme.card, borderRadius: 16, padding: 24, marginBottom: 20 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: '900' },
  emptySub: { color: theme.muted, marginTop: 6, lineHeight: 20 },
  warningBlock: { backgroundColor: theme.dangerBg, borderRadius: 16, padding: 16, marginBottom: 18 },
  warningTitle: { color: theme.danger, fontSize: 15, fontWeight: '900' },
  warningText: { color: theme.text, marginTop: 6, lineHeight: 20, fontSize: 13 },
  highlightBlock: { backgroundColor: theme.card, borderRadius: 14, borderLeftWidth: 4, padding: 15, marginBottom: 10 },
  blockLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  blockText: { color: theme.text, fontSize: 15, lineHeight: 23 },
  previewPaper: { backgroundColor: theme.card, borderRadius: 16, padding: 18 },
  paragraph: { color: theme.text, fontSize: 15, lineHeight: 24, marginBottom: 12 },
  });
}
