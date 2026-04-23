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

export default function ImportScreen({ navigation }) {
  const { documents, importDocument, deleteDocument } = useAppContext();
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
          if (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Document</Text>
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.uploadDisabled]}
          onPress={handlePickDocument}
          disabled={uploading}
        >
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadBtnText}>Choose File</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Import notes and readings</Text>
          <Text style={styles.heroTitle}>Drop in a PDF or DOCX and start structuring instantly.</Text>
          <Text style={styles.heroSub}>
            The app extracts text, saves the file locally first, and syncs to the cloud when your account supports it.
          </Text>
          <TouchableOpacity style={styles.heroAction} onPress={handlePickDocument} disabled={uploading}>
            <Text style={styles.heroActionText}>{uploading ? 'Preparing file...' : 'Select a document'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notesRow}>
          <View style={styles.noteCard}>
            <Text style={styles.noteValue}>50MB</Text>
            <Text style={styles.noteLabel}>Size limit</Text>
          </View>
          <View style={styles.noteCard}>
            <Text style={styles.noteValue}>2</Text>
            <Text style={styles.noteLabel}>Supported formats</Text>
          </View>
          <View style={styles.noteCard}>
            <Text style={styles.noteValue}>Local</Text>
            <Text style={styles.noteLabel}>Fallback mode</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent imports</Text>
        {recentImports.length > 0 ? (
          recentImports.map((doc) => (
            <View key={doc.id} style={styles.docRow}>
              <TouchableOpacity
                style={styles.docRowContent}
                onPress={() => navigation.navigate('HighlightWorkspace', { doc })}
              >
                <View style={styles.docIcon}>
                  <Text style={styles.docIconText}>📄</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{doc.title}</Text>
                  <Text style={styles.docMeta}>
                    {doc.sizeLabel} · {doc.date} · {doc.syncStatus === 'synced' ? 'Cloud synced' : 'Local only'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(doc.id)}>
                <Text style={styles.deleteBtnText}>⌫</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>No data available</Text>
            <Text style={styles.emptyText}>Choose a file above to import your first reading.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cancelText: { fontSize: 17, color: '#007AFF', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', flex: 1, textAlign: 'center' },
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
  heroCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 22,
    padding: 24,
    marginBottom: 18,
  },
  heroEyebrow: { color: '#9A9AA2', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 31, marginTop: 10 },
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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  noteValue: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  noteLabel: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  docRowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  docIconText: { fontSize: 22 },
  docInfo: { flex: 1 },
  docName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  docMeta: { fontSize: 13, color: '#8E8E93', marginTop: 4 },
  chevron: { fontSize: 20, color: '#C7C7CC' },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF2F2',
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
    backgroundColor: '#fff',
    borderRadius: 18,
  },
  emptyIcon: { fontSize: 56, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  emptyText: { fontSize: 16, color: '#8E8E93', textAlign: 'center', marginTop: 8 },
});
