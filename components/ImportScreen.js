import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

export default function ImportScreen({ navigation }) {
  const [uploading, setUploading] = useState(false);
  const [recentImports, setRecentImports] = useState([]);

  const loadRecent = useCallback(async () => {
    const {
      data: { session },
    } = supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/documents?user_id=eq.${session.user.id}&deleted_at=is.null&select=id,name,size,uploaded_at,url,extracted_text&order=uploaded_at.desc&limit=5`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setRecentImports(
          data.map((d) => ({
            id: d.id,
            name: d.name,
            size: `${Math.round((d.size || 0) / 1024)} KB`,
            date: new Date(d.uploaded_at).toLocaleDateString(),
            url: d.url,
            extracted_text: d.extracted_text ?? null,
          }))
        );
      }
    } catch (error) {
      console.log('Load recent failed:', error);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // ─── Text Extraction Helpers ────────────────────────────────────────────────

  const extractTextFromDocx = async (uri) => {
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(arrayBuffer);
      const xmlFile = zip.file('word/document.xml');
      if (!xmlFile) return null;

      const xml = await xmlFile.async('string');
      const paragraphs = [];
      const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
      let paraMatch;

      while ((paraMatch = paraRegex.exec(xml)) !== null) {
        const paraXml = paraMatch[0];
        const textMatches = [...paraXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
        const line = textMatches.map((m) => m[1]).join('');
        if (line.trim()) paragraphs.push(line.trim());
      }

      return paragraphs.join('\n\n') || null;
    } catch (e) {
      console.log('DOCX extraction error:', e);
      return null;
    }
  };

  const extractTextFromPdf = async (uri) => {
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const decoder = new TextDecoder('latin1');
      const raw = decoder.decode(bytes);
      const chunks = [];

      const btBlocks = raw.matchAll(/BT([\s\S]*?)ET/g);
      for (const block of btBlocks) {
        const strings = block[1].matchAll(/\(([^)]{1,300})\)\s*T[jJ]/g);
        for (const s of strings) {
          const clean = s[1]
            .replace(/\\(\d{3})/g, (_, oct) =>
              String.fromCharCode(parseInt(oct, 8))
            )
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\\\/g, '\\')
            .replace(/\\'/g, "'")
            .trim();
          if (clean.length > 1) chunks.push(clean);
        }
      }

      const hexStrings = raw.matchAll(/<([0-9a-fA-F]{4,})>\s*Tj/g);
      for (const s of hexStrings) {
        const hex = s[1];
        let str = '';
        for (let i = 0; i < hex.length - 1; i += 2) {
          const code = parseInt(hex.slice(i, i + 2), 16);
          if (code > 31 && code < 127) str += String.fromCharCode(code);
        }
        if (str.trim().length > 1) chunks.push(str.trim());
      }

      const result = chunks
        .join(' ')
        .replace(/\s{3,}/g, '\n\n')
        .trim();
      return result.length > 50 ? result : null;
    } catch (e) {
      console.log('PDF extraction error:', e);
      return null;
    }
  };

  const extractText = async (uri, mimeType) => {
    const isDocx =
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      uri.toLowerCase().endsWith('.docx');
    const isPdf =
      mimeType === 'application/pdf' || uri.toLowerCase().endsWith('.pdf');

    if (isDocx) return extractTextFromDocx(uri);
    if (isPdf) return extractTextFromPdf(uri);
    return null;
  };

  // ─── Upload Handler ─────────────────────────────────────────────────────────

  const handlePickDocument = async () => {
    const {
      data: { session },
    } = supabase.auth.getSession();

    if (!session) {
      Alert.alert('Login Required');
      navigation.navigate('Login');
      return;
    }

    try {
      setUploading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const file = result.assets[0];

      if ((file.size ?? file.fileSize) > 50 * 1024 * 1024) {
        Alert.alert('Error', 'File too large (max 50MB)');
        setUploading(false);
        return;
      }

      const userId = session.user.id;
      const fileName = `${userId}/${Date.now()}_${file.name}`;

      // ── Upload to storage ──
      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/documents/${fileName}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': file.mimeType || 'application/octet-stream',
            'x-upsert': 'true',
          },
          body: await fetch(file.uri).then((r) => r.blob()),
        }
      );

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.log('Upload error:', errorText);
        Alert.alert('Upload Failed', errorText);
        setUploading(false);
        return;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/documents/${fileName}`;

      // ── Extract text from local file ──
      const extracted = await extractText(file.uri, file.mimeType);
      console.log(
        'Extracted text length:',
        extracted ? extracted.length : 'none'
      );

      // ── Save to DB ──
      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/documents`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size ?? file.fileSize ?? 0,
          url: publicUrl,
          uploaded_at: new Date().toISOString(),
          user_id: userId,
          extracted_text: extracted ?? null,
        }),
      });

      const dbData = await dbRes.json();
      console.log('DB insert response:', dbData);

      if (!dbRes.ok) {
        Alert.alert('Save Failed', 'Upload succeeded but metadata save failed');
        setUploading(false);
        return;
      }

      await loadRecent();

      Alert.alert('Success!', `${file.name} imported`, [
        {
          text: 'Open',
          onPress: () =>
            navigation.navigate('HighlightWorkspace', {
              doc: {
                title: file.name,
                url: publicUrl,
                extracted_text: extracted ?? null,
              },
            }),
        },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Import failed:', error);
      Alert.alert('Error', 'Upload failed - please try again');
    } finally {
      setUploading(false);
    }
  };

  // ─── Delete Handler ─────────────────────────────────────────────────────────

  const deleteDocument = async (docId) => {
    const {
      data: { session },
    } = supabase.auth.getSession();
    if (!session) return;

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
                method: 'PATCH', // Changed from DELETE to PATCH
                headers: {
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                // Added the body to set the deleted_at timestamp
                body: JSON.stringify({ deleted_at: new Date().toISOString() }),
              }
            );

            if (res.ok || res.status === 204) {
              // Optimistically remove from UI immediately
              setRecentImports((prev) => prev.filter((d) => d.id !== docId));
            } else {
              const err = await res.text();
              console.log('Delete error:', err);
              Alert.alert('Error', 'Could not delete document');
            }
          },
        },
      ]
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

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
          disabled={uploading}>
          <Text style={styles.uploadBtnText}>
            {uploading ? '⏳ Uploading...' : '📁 Choose File'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Upload Notes</Text>
          <Text style={styles.infoSub}>PDF or DOCX • Max 50MB</Text>
        </View>

        <Text style={styles.sectionTitle}>Recent ({recentImports.length})</Text>
        {recentImports.length ? (
          recentImports.map((doc) => (
            <View key={doc.id} style={styles.docRow}>
              <TouchableOpacity
                style={styles.docRowContent}
                onPress={() =>
                  navigation.navigate('HighlightWorkspace', {
                    doc: {
                      title: doc.name,
                      url: doc.url,
                      extracted_text: doc.extracted_text,
                    },
                  })
                }>
                <View style={styles.docIcon}>
                  <Text>📄</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  <Text style={styles.docMeta}>
                    {doc.size} • {doc.date}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteDocument(doc.id)}>
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>No documents</Text>
            <Text style={styles.emptyText}>
              Choose file above to get started
            </Text>
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cancelText: { fontSize: 17, color: '#007AFF', fontWeight: '600' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    flex: 1,
    textAlign: 'center',
  },
  uploadBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
  },
  uploadDisabled: { backgroundColor: '#C7C7CC' },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  scroll: { paddingTop: 20 },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  infoTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  infoSub: { fontSize: 16, color: '#6E6E73', marginTop: 4 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    marginLeft: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    marginHorizontal: 20,
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
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    height: 48,
    width: 48,
    marginRight: 10,
  },
  deleteBtnText: { fontSize: 18 },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  docInfo: { flex: 1 },
  docName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  docMeta: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
  chevron: { fontSize: 20, color: '#C7C7CC' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 56, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  emptyText: { fontSize: 16, color: '#8E8E93', textAlign: 'center' },
});
