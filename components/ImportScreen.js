import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { inflate, inflateRaw } from 'pako';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';
import { useAppContext } from '../contexts/AppContext';
import { COLOR_ROLES, formatBytes, normalizeDocument } from './notaData';
import { useNotaTheme } from './theme';

async function extractTextFromDocx(uri) {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) return null;

    const xml = await xmlFile.async('string');
    const paragraphs = [];
    const paragraphMatches = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
    paragraphMatches.forEach((paragraphXml) => {
      const text = [...paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((match) => match[1])
        .join('');
      if (text.trim()) paragraphs.push(text.trim());
    });
    return paragraphs.join('\n\n') || null;
  } catch (error) {
    console.log('DOCX extraction failed:', error);
    return null;
  }
}

function decodePdfBytes(bytes) {
  if (!bytes?.length) return '';

  const chunkSize = 8192;
  let output = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    output += String.fromCharCode(...chunk);
  }

  return output;
}

function inflatePdfStream(streamBytes) {
  if (!streamBytes?.length) return null;

  try {
    const inflated = inflate(streamBytes);
    if (inflated?.length) return inflated;
  } catch (error) {
    // Some PDFs store raw deflate streams without a zlib wrapper.
  }

  try {
    const inflatedRaw = inflateRaw(streamBytes);
    if (inflatedRaw?.length) return inflatedRaw;
  } catch (error) {
    // Many PDFs include compressed image/font streams that are not useful for text extraction.
  }

  return null;
}

function decodePdfString(value) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, escaped) => {
      const map = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '(': '(',
        ')': ')',
        '\\': '\\',
      };
      return map[escaped] || escaped;
    })
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHexPdfString(hex) {
  const cleanHex = hex.replace(/\s+/g, '');
  if (!cleanHex) return '';

  const bytes = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes.push(parseInt(cleanHex.slice(i, i + 2).padEnd(2, '0'), 16));
  }

  const isUtf16Be = bytes[0] === 0xfe && bytes[1] === 0xff;
  if (isUtf16Be) {
    let output = '';
    for (let i = 2; i < bytes.length - 1; i += 2) {
      output += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return output.replace(/\s+/g, ' ').trim();
  }

  return bytes
    .map((byte) => (byte >= 32 && byte !== 127 ? String.fromCharCode(byte) : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectTextFromPdfContent(content) {
  const chunks = [];

  for (const block of content.matchAll(/BT([\s\S]*?)ET/g)) {
    const textBlock = block[1];

    for (const item of textBlock.matchAll(/\((?:\\.|[^\\)])*\)\s*T[j']/g)) {
      const literal = item[0].match(/\(([\s\S]*)\)/)?.[1];
      const clean = decodePdfString(literal || '');
      if (clean.length > 1) chunks.push(clean);
    }

    for (const item of textBlock.matchAll(/<([0-9a-fA-F\s]{4,})>\s*Tj/g)) {
      const clean = decodeHexPdfString(item[1]);
      if (clean.length > 1) chunks.push(clean);
    }

    for (const arrayText of textBlock.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
      const pieces = [];
      for (const literal of arrayText[1].matchAll(/\((?:\\.|[^\\)])*\)/g)) {
        pieces.push(decodePdfString(literal[0].slice(1, -1)));
      }
      for (const hex of arrayText[1].matchAll(/<([0-9a-fA-F\s]{4,})>/g)) {
        pieces.push(decodeHexPdfString(hex[1]));
      }
      const clean = pieces.join('').replace(/\s+/g, ' ').trim();
      if (clean.length > 1) chunks.push(clean);
    }
  }

  return chunks;
}

function extractPdfStreams(raw, bytes) {
  const streams = [];
  const streamRegex = /<<(?:[\s\S]*?)>>\s*stream\r?\n?/g;
  let match;

  while ((match = streamRegex.exec(raw)) !== null) {
    const dict = match[0];
    const streamStart = match.index + match[0].length;
    const endMarker = raw.indexOf('endstream', streamStart);
    if (endMarker === -1) break;

    let streamBytes = bytes.subarray(streamStart, endMarker);
    while (streamBytes.length && (streamBytes[0] === 10 || streamBytes[0] === 13)) {
      streamBytes = streamBytes.subarray(1);
    }
    while (
      streamBytes.length &&
      (streamBytes[streamBytes.length - 1] === 10 || streamBytes[streamBytes.length - 1] === 13)
    ) {
      streamBytes = streamBytes.subarray(0, streamBytes.length - 1);
    }

    if (/\/FlateDecode\b/.test(dict)) {
      const inflated = inflatePdfStream(streamBytes);
      if (inflated) streams.push(decodePdfBytes(inflated));
    } else {
      streams.push(decodePdfBytes(streamBytes));
    }

    streamRegex.lastIndex = endMarker + 'endstream'.length;
  }

  return streams;
}

async function extractTextFromPdf(uri) {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const raw = decodePdfBytes(bytes);
    const streams = extractPdfStreams(raw, bytes);
    const chunks = [
      ...collectTextFromPdfContent(raw),
      ...streams.flatMap((stream) => collectTextFromPdfContent(stream)),
    ];

    const extracted = chunks.join(' ').replace(/\s{3,}/g, '\n\n').trim();
    return extracted.length > 50 ? extracted : null;
  } catch (error) {
    console.log('PDF extraction failed:', error);
    return null;
  }
}

async function extractText(file) {
  const uri = file.uri || '';
  const mimeType = file.mimeType || '';
  if (mimeType.includes('wordprocessingml') || uri.toLowerCase().endsWith('.docx')) {
    return extractTextFromDocx(uri);
  }
  if (mimeType === 'application/pdf' || uri.toLowerCase().endsWith('.pdf')) {
    return extractTextFromPdf(uri);
  }
  return null;
}

async function extractTextFromPdfEdge({ url, token, enableOcr = false }) {
  if (!url || !token) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-pdf-text`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, enableOcr }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.log('Edge PDF extraction failed:', data?.error || data?.ocrError || res.status);
      return null;
    }

    return data?.text?.trim()?.length > 50 ? data.text.trim() : null;
  } catch (error) {
    console.log('Edge PDF extraction failed:', error?.message || error);
    return null;
  }
}

export default function ImportScreen({ navigation }) {
  const { session, documents, addDocument } = useAppContext();
  const { darkMode, theme } = useNotaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [uploading, setUploading] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('Pasted Notes');
  const [pasteText, setPasteText] = useState('');
  const recentImports = useMemo(() => documents.slice(0, 5), [documents]);

  const pickDocument = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) return;
      const fileSize = file.size ?? file.fileSize ?? 0;
      if (fileSize > 50 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please choose a file smaller than 50 MB.');
        return;
      }

      const isPdf = file.mimeType === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      let extractedText = await extractText(file);
      let publicUrl = file.uri;
      let cloudId = null;

      if (session?.access_token) {
        const userId = session.user.id;
        const fileName = `${userId}/${Date.now()}_${file.name}`;
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${fileName}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': file.mimeType || 'application/octet-stream',
            'x-upsert': 'true',
          },
          body: await fetch(file.uri).then((res) => res.blob()),
        });

        if (uploadRes.ok) {
          publicUrl = `${SUPABASE_URL}/storage/v1/object/public/documents/${fileName}`;

          if (isPdf) {
            const edgeText = await extractTextFromPdfEdge({
              url: publicUrl,
              token: session.access_token,
            });
            if (edgeText) {
              extractedText = edgeText;
            } else {
              const ocrText = await extractTextFromPdfEdge({
                url: publicUrl,
                token: session.access_token,
                enableOcr: true,
              });
              extractedText = ocrText || extractedText;
            }
          }

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
              size: fileSize,
              url: publicUrl,
              uploaded_at: new Date().toISOString(),
              user_id: userId,
              extracted_text: extractedText,
            }),
          });
          const rows = await dbRes.json();
          cloudId = Array.isArray(rows) ? rows[0]?.id : null;
        }
      }

      const doc = await addDocument(
        normalizeDocument({
          id: cloudId || `local-${Date.now()}`,
          title: file.name,
          name: file.name,
          size: fileSize,
          sizeLabel: formatBytes(fileSize),
          url: publicUrl,
          extracted_text:
            extractedText ||
            `${file.name}\n\nText extraction was not available for this file. If this is a scanned PDF, deploy the extract-pdf-text function with OCR_SPACE_API_KEY for OCR fallback. You can still preview the source document and import a DOCX/PDF with selectable text for word-level highlighting.`,
          folder: isPdf ? 'PDFs' : 'Docs',
          tags: extractedText ? ['extracted'] : ['needs-ocr'],
          colors: COLOR_ROLES.slice(0, 3).map((role) => role.color),
        })
      );

      Alert.alert('Imported', `${file.name} is ready.`, [
        { text: 'Open', onPress: () => navigation?.navigate('HighlightWorkspace', { doc }) },
        { text: 'Done', style: 'cancel' },
      ]);
    } catch (error) {
      console.log('Import failed:', error);
      Alert.alert('Import Failed', 'Please try another PDF or DOCX file.');
    } finally {
      setUploading(false);
    }
  };

  const importPastedText = async () => {
    const text = pasteText.trim();
    if (text.length < 10) {
      Alert.alert('Paste Text', 'Paste at least a few words before importing.');
      return;
    }

    const title = pasteTitle.trim() || 'Pasted Notes';
    const doc = await addDocument(
      normalizeDocument({
        id: `paste-${Date.now()}`,
        title,
        name: title,
        size: text.length,
        sizeLabel: formatBytes(text.length),
        url: null,
        extracted_text: text,
        folder: 'Pasted',
        tags: ['manual'],
        colors: COLOR_ROLES.slice(0, 3).map((role) => role.color),
      })
    );
    setPasteText('');
    Alert.alert('Imported', `${title} is ready.`, [
      { text: 'Open', onPress: () => navigation?.navigate('HighlightWorkspace', { doc }) },
      { text: 'Done', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={[styles.pickCard, uploading && styles.pickCardDisabled]} onPress={pickDocument} disabled={uploading}>
          {uploading ? <ActivityIndicator color={theme.buttonText} /> : <Text style={styles.pickPlus}>+</Text>}
          <Text style={styles.pickTitle}>{uploading ? 'Importing...' : 'Choose PDF or DOCX'}</Text>
          <Text style={styles.pickSub}>Nota extracts text for highlighting when the file allows it.</Text>
        </TouchableOpacity>

        <View style={styles.pasteCard}>
          <Text style={styles.pasteTitle}>Paste Text</Text>
          <TextInput
            style={styles.pasteNameInput}
            value={pasteTitle}
            onChangeText={setPasteTitle}
            placeholder="Document title"
            placeholderTextColor={theme.muted}
          />
          <TextInput
            style={styles.pasteTextInput}
            value={pasteText}
            onChangeText={setPasteText}
            placeholder="Paste extracted text here..."
            placeholderTextColor={theme.muted}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.pasteButton} onPress={importPastedText}>
            <Text style={styles.pasteButtonText}>Import Pasted Text</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Recent Imports</Text>
        {recentImports.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing imported yet</Text>
            <Text style={styles.emptySub}>Choose a file above to start your library.</Text>
          </View>
        ) : (
          recentImports.map((doc) => (
            <TouchableOpacity key={doc.id} style={styles.docRow} onPress={() => navigation?.navigate('Preview', { doc })}>
              <View style={styles.docIcon}>
                <Text style={styles.docIconText}>DOC</Text>
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docName} numberOfLines={1}>{doc.title}</Text>
                <Text style={styles.docMeta}>{doc.sizeLabel} | {doc.date}</Text>
              </View>
              <Text style={styles.chevron}>{'>'}</Text>
            </TouchableOpacity>
          ))
        )}
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
    paddingVertical: 14,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  cancelText: { color: theme.primary, fontSize: 16, fontWeight: '800' },
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: '900' },
  scroll: { padding: 20 },
  pickCard: {
    minHeight: 190,
    borderRadius: 20,
    backgroundColor: theme.button,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginBottom: 24,
  },
  pickCardDisabled: { opacity: 0.75 },
  pickPlus: { color: theme.buttonText, fontSize: 44, lineHeight: 48 },
  pickTitle: { color: theme.buttonText, fontSize: 20, fontWeight: '900', marginTop: 6 },
  pickSub: { color: theme.darkMode ? '#3A3A40' : '#B8B8BE', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  pasteCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 24 },
  pasteTitle: { color: theme.text, fontSize: 16, fontWeight: '900', marginBottom: 12 },
  pasteNameInput: {
    backgroundColor: theme.elevated,
    borderRadius: 12,
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  pasteTextInput: {
    minHeight: 120,
    backgroundColor: theme.elevated,
    borderRadius: 12,
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  pasteButton: {
    backgroundColor: theme.button,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  pasteButtonText: { color: theme.buttonText, fontSize: 13, fontWeight: '900' },
  sectionTitle: { color: theme.muted, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginBottom: 10 },
  docRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, gap: 14 },
  docIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: theme.elevated, alignItems: 'center', justifyContent: 'center' },
  docIconText: { color: theme.text, fontSize: 11, fontWeight: '900' },
  docInfo: { flex: 1 },
  docName: { color: theme.text, fontSize: 15, fontWeight: '900' },
  docMeta: { color: theme.muted, fontSize: 12, marginTop: 3 },
  chevron: { color: theme.faint, fontWeight: '900', fontSize: 18 },
  emptyState: { alignItems: 'center', backgroundColor: theme.card, borderRadius: 16, padding: 28 },
  emptyTitle: { color: theme.text, fontSize: 17, fontWeight: '900' },
  emptySub: { color: theme.muted, marginTop: 6, textAlign: 'center' },
  });
}
