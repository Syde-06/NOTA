import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAppContext } from '../contexts/AppContext';

function makeColors(dark) {
  return {
    bg: dark ? '#1C1C1E' : '#F5F5F7',
    card: dark ? '#2C2C2E' : '#fff',
    cardBg: dark ? '#3A3A3C' : '#F2F2F7',
    text: dark ? '#F5F5F7' : '#1C1C1E',
    sub: dark ? '#A0A0A8' : '#8E8E93',
    headerBg: dark ? '#2C2C2E' : '#fff',
    border: dark ? '#3A3A3C' : '#E5E5EA',
    statusBar: dark ? 'light-content' : 'dark-content',
    deleteRowBg: dark ? '#3A1E1E' : '#FFF2F2',
  };
}

export default function ImportScreen({ navigation }) {
  const { documents, importDocument, deleteDocument, darkMode } =
    useAppContext();
  const C = makeColors(darkMode);
  const [uploading, setUploading] = useState(false);
  const recentImports = useMemo(() => documents.slice(0, 5), [documents]);

  const handlePickDocument = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) {
        setUploading(false);
        return;
      }
      const file = result.assets[0];
      if ((file.size ?? file.fileSize ?? 0) > 50 * 1024 * 1024) {
        Alert.alert('Error', 'File too large. The maximum size is 50MB.');
        setUploading(false);
        return;
      }
      const { doc, warning, error } = await importDocument(file);
      if (error) {
        Alert.alert('Import Failed', error.message);
        setUploading(false);
        return;
      }
      Alert.alert(
        'Imported',
        warning || `${file.name} is ready to review and highlight.`,
        [
          {
            text: 'Open',
            onPress: () => navigation.navigate('HighlightWorkspace', { doc }),
          },
          { text: 'Done', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('Import failed:', error);
      Alert.alert('Error', 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (docId) => {
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} />
      <View
        style={[
          styles.header,
          { backgroundColor: C.headerBg, borderBottomColor: C.border },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>
          Import Document
        </Text>
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.uploadDisabled]}
          onPress={handlePickDocument}
          disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadBtnText}>Choose File</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View
          style={[
            styles.heroCard,
            { backgroundColor: darkMode ? '#2C2C2E' : '#1C1C1E' },
          ]}>
          <Text style={styles.heroEyebrow}>Import notes and readings</Text>
          <Text style={styles.heroTitle}>
            Drop in a PDF or DOCX and start structuring instantly.
          </Text>
          <Text style={styles.heroSub}>
            The app extracts text, saves the file locally first, and syncs to
            the cloud when your account supports it.
          </Text>
          <TouchableOpacity
            style={styles.heroAction}
            onPress={handlePickDocument}
            disabled={uploading}>
            <Text style={styles.heroActionText}>
              {uploading ? 'Preparing file...' : 'Select a document'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notesRow}>
          {[
            { val: '50MB', label: 'Size limit' },
            { val: '2', label: 'Supported formats' },
            { val: 'Local', label: 'Fallback mode' },
          ].map((item) => (
            <View
              key={item.label}
              style={[styles.noteCard, { backgroundColor: C.card }]}>
              <Text style={[styles.noteValue, { color: C.text }]}>
                {item.val}
              </Text>
              <Text style={[styles.noteLabel, { color: C.sub }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: C.sub }]}>
          Recent imports
        </Text>

        {recentImports.length > 0 ? (
          recentImports.map((doc) => (
            <View
              key={doc.id}
              style={[styles.docRow, { backgroundColor: C.card }]}>
              <TouchableOpacity
                style={styles.docRowContent}
                onPress={() =>
                  navigation.navigate('HighlightWorkspace', { doc })
                }>
                <View style={[styles.docIcon, { backgroundColor: C.cardBg }]}>
                  <Text style={styles.docIconText}>📄</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text
                    style={[styles.docName, { color: C.text }]}
                    numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={[styles.docMeta, { color: C.sub }]}>
                    {doc.sizeLabel} · {doc.date} ·{' '}
                    {doc.syncStatus === 'synced'
                      ? 'Cloud synced'
                      : 'Local only'}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: C.sub }]}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: C.deleteRowBg }]}
                onPress={() => handleDelete(doc.id)}>
                <Text style={styles.deleteBtnText}>⌫</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={[styles.emptyState, { backgroundColor: C.card }]}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={[styles.emptyTitle, { color: C.text }]}>
              No data available
            </Text>
            <Text style={[styles.emptyText, { color: C.sub }]}>
              Choose a file above to import your first reading.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  cancelText: { fontSize: 17, color: '#007AFF', fontWeight: '600' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  uploadBtn: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 110,
    alignItems: 'center',
  },
  uploadDisabled: { backgroundColor: '#8E8E93' },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  scroll: { padding: 20, paddingBottom: 60 },
  heroCard: { borderRadius: 22, padding: 24, marginBottom: 18 },
  heroEyebrow: {
    color: '#9A9AA2',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
    marginTop: 10,
  },
  heroSub: { color: '#C2C2CA', fontSize: 14, lineHeight: 22, marginTop: 12 },
  heroAction: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 18,
  },
  heroActionText: { color: '#1C1C1E', fontSize: 14, fontWeight: '700' },
  notesRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  noteCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  noteValue: { fontSize: 18, fontWeight: '800' },
  noteLabel: { fontSize: 12, marginTop: 4 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  docRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  docIconText: { fontSize: 22 },
  docInfo: { flex: 1 },
  docName: { fontSize: 16, fontWeight: '600' },
  docMeta: { fontSize: 13, marginTop: 4 },
  chevron: { fontSize: 20 },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderRadius: 10,
    width: 48,
    height: 48,
  },
  deleteBtnText: { fontSize: 18, color: '#FF3B30' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    borderRadius: 18,
  },
  emptyIcon: { fontSize: 56, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 16, textAlign: 'center', marginTop: 8 },
});
