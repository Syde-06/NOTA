import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { useAppContext } from '../contexts/AppContext';
import {
  COLOR_ROLES,
  buildFlashcards,
  buildExportPayload,
  buildStructuredExportSections,
  getHighlightedGroups,
  normalizeDocument,
  splitIntoTokens,
} from './notaData';

const FORMATS = [
  { id: 'markdown', label: 'MD' },
  { id: 'json', label: 'JSON' },
  { id: 'csv', label: 'CSV' },
];

const TEMPLATES = [
  { id: 'study-notes', label: 'Notes' },
  { id: 'reviewer', label: 'Reviewer' },
  { id: 'outline', label: 'Outline' },
  { id: 'flashcards', label: 'Cards' },
];

const IMAGE_PAGE_MAX_UNITS = 10.5;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFileName(value = 'Nota Export') {
  const clean = String(value)
    .replace(/\.[Pp][Dd][Ff]$/, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || 'Nota Export';
}

function splitTextForImage(text = '', maxChars = 68) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function pushWrappedLine(lines, type, text, options = {}) {
  const maxChars = options.maxChars || (type === 'title' ? 54 : 68);
  splitTextForImage(text, maxChars).forEach((line, index) => {
    lines.push({
      type: index === 0 ? type : 'body',
      text: line,
      prefix: index === 0 ? options.prefix : null,
    });
  });
}

function buildImagePages({ sections, flashcards, template, exportName }) {
  const lines = [];
  pushWrappedLine(lines, 'title', exportName || 'Nota Export', { maxChars: 48 });

  if (template === 'flashcards') {
    flashcards.forEach((card, index) => {
      lines.push({ type: 'heading', text: `Card ${index + 1} | ${card.section}` });
      pushWrappedLine(lines, 'title', card.front, { maxChars: 54 });
      pushWrappedLine(lines, 'body', card.back);
    });
  } else {
    sections.forEach((section) => {
      pushWrappedLine(lines, 'title', section.title, { maxChars: 48 });

      if (template === 'reviewer') {
        if (section.summaries.length) lines.push({ type: 'heading', text: 'Quick Summary' });
        section.summaries.forEach((item) => pushWrappedLine(lines, 'body', item));
        if (section.definitions.length) lines.push({ type: 'heading', text: 'Key Terms' });
        section.definitions.forEach((item) => pushWrappedLine(lines, 'body', item));
        if (section.examples.length) lines.push({ type: 'heading', text: 'Examples' });
        section.examples.forEach((item) => pushWrappedLine(lines, 'body', item));
        if (section.listItems.length) lines.push({ type: 'heading', text: 'Checklist' });
        section.listItems.forEach((item) => pushWrappedLine(lines, 'bullet', item, { prefix: '[ ]' }));
        return;
      }

      if (template === 'outline') {
        [
          ...section.definitions.map((item) => ({ label: 'Definition', text: item })),
          ...section.listItems.map((item) => ({ label: 'Point', text: item })),
          ...section.examples.map((item) => ({ label: 'Example', text: item })),
          ...section.summaries.map((item) => ({ label: 'Summary', text: item })),
        ].forEach((row, index) => pushWrappedLine(lines, 'bullet', row.text, { prefix: `${index + 1}. ${row.label}` }));
        return;
      }

      section.definitions.forEach((item) => pushWrappedLine(lines, 'body', item));
      section.listItems.forEach((item) => pushWrappedLine(lines, 'bullet', item, { prefix: '•' }));
      section.examples.forEach((item) => pushWrappedLine(lines, 'body', item, { prefix: 'Example:' }));
      section.summaries.forEach((item) => pushWrappedLine(lines, 'body', item));
    });
  }

  const pages = [];
  let current = [];
  let units = 0;

  lines.forEach((line) => {
    const lineUnits = line.type === 'title' ? 1.35 : line.type === 'heading' ? 1.15 : 1;
    if (current.length && units + lineUnits > IMAGE_PAGE_MAX_UNITS) {
      pages.push(current);
      current = [];
      units = 0;
    }
    current.push(line);
    units += lineUnits;
  });

  if (current.length) pages.push(current);
  return pages.length ? pages : [[{ type: 'body', text: 'No highlights yet.' }]];
}

function buildExportHtml({ doc, sections, flashcards, template, exportName }) {
  const content = template === 'flashcards'
    ? flashcards.map((card, index) => `
        <section class="card">
          <p class="meta">Card ${index + 1} | ${escapeHtml(card.section)}</p>
          <h2>${escapeHtml(card.front)}</h2>
          <p>${escapeHtml(card.back)}</p>
        </section>
      `).join('')
    : template === 'reviewer'
      ? sections.map((section) => `
        <section>
          <h1>${escapeHtml(section.title)}</h1>
          ${section.summaries.length ? '<h2>Quick Summary</h2>' : ''}
          ${section.summaries.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
          ${section.definitions.length ? '<h2>Key Terms</h2>' : ''}
          ${section.definitions.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
          ${section.examples.length ? '<h2>Examples</h2>' : ''}
          ${section.examples.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
          ${section.listItems.length ? '<h2>Checklist</h2>' : ''}
          ${section.listItems.length ? `<ul>${section.listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
        </section>
      `).join('')
      : template === 'outline'
        ? sections.map((section) => `
        <section>
          <h1>${escapeHtml(section.title)}</h1>
          <ul>
            ${section.definitions.map((item) => `<li><strong>Definition:</strong> ${escapeHtml(item)}</li>`).join('')}
            ${section.listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            ${section.examples.map((item) => `<li><strong>Example:</strong> ${escapeHtml(item)}</li>`).join('')}
            ${section.summaries.map((item) => `<li><strong>Summary:</strong> ${escapeHtml(item)}</li>`).join('')}
          </ul>
        </section>
      `).join('')
        : sections.map((section) => `
        <section>
          <h1>${escapeHtml(section.title)}</h1>
          ${section.definitions.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
          ${section.listItems.length ? `<ul>${section.listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
          ${section.examples.map((item) => `<p><strong>Example:</strong> ${escapeHtml(item)}</p>`).join('')}
          ${section.summaries.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
        </section>
      `).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { margin: 0; padding: 28px; background: #000; color: #e2e2e4; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; line-height: 16px; }
          h1 { font-size: 12px; line-height: 16px; margin: 0 0 10px; font-weight: 900; }
          h2 { font-size: 12px; line-height: 16px; margin: 0 0 8px; font-weight: 900; }
          p { margin: 0 0 6px; }
          ul { margin: 2px 0 8px; padding-left: 18px; }
          li { margin-bottom: 6px; }
          section { margin-bottom: 28px; break-inside: avoid; }
          .card { border: 1px solid #303034; border-radius: 14px; padding: 16px; }
          .meta { color: #8e8e93; font-weight: 900; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(exportName || doc.title)}</h1>
        ${content || '<p>No highlights yet.</p>'}
      </body>
    </html>
  `;
}

function ExportSection({ section }) {
  return (
    <View style={styles.exportSection}>
      <Text style={styles.exportTitle}>{section.title}</Text>

      {section.definitions.map((item, index) => (
        <Text key={`definition-${index}-${item}`} style={styles.definitionText}>
          {item}
        </Text>
      ))}

      {section.listItems.length > 0 && (
        <View style={styles.listWrap}>
          {section.listItems.map((item, index) => (
            <View key={`list-${index}-${item}`} style={styles.listRow}>
              <Text style={styles.bullet}>{'\u2022'}</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {section.examples.map((item, index) => (
        <Text key={`example-${index}-${item}`} style={styles.exampleText}>
          <Text>Example: </Text>
          {item}
        </Text>
      ))}

      {section.summaries.map((item, index) => (
        <Text key={`summary-${index}-${item}`} style={styles.summaryText}>
          {item}
        </Text>
      ))}
    </View>
  );
}

function ReviewerSection({ section }) {
  return (
    <View style={styles.exportSection}>
      <Text style={styles.exportTitle}>{section.title}</Text>
      {section.summaries.length > 0 && <Text style={styles.groupHeading}>Quick Summary</Text>}
      {section.summaries.map((item, index) => <Text key={`summary-${index}-${item}`} style={styles.definitionText}>{item}</Text>)}
      {section.definitions.length > 0 && <Text style={styles.groupHeading}>Key Terms</Text>}
      {section.definitions.map((item, index) => <Text key={`definition-${index}-${item}`} style={styles.definitionText}>{item}</Text>)}
      {section.examples.length > 0 && <Text style={styles.groupHeading}>Examples</Text>}
      {section.examples.map((item, index) => <Text key={`example-${index}-${item}`} style={styles.exampleText}>{item}</Text>)}
      {section.listItems.length > 0 && <Text style={styles.groupHeading}>Checklist</Text>}
      {section.listItems.map((item, index) => (
        <View key={`list-${index}-${item}`} style={styles.listRow}>
          <Text style={styles.checkbox}>[ ]</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function OutlineSection({ section }) {
  const rows = [
    ...section.definitions.map((item) => ({ label: 'Definition', text: item })),
    ...section.listItems.map((item) => ({ label: 'Point', text: item })),
    ...section.examples.map((item) => ({ label: 'Example', text: item })),
    ...section.summaries.map((item) => ({ label: 'Summary', text: item })),
  ];

  return (
    <View style={styles.exportSection}>
      <Text style={styles.exportTitle}>{section.title}</Text>
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}-${row.text}`} style={styles.outlineRow}>
          <Text style={styles.outlineIndex}>{index + 1}.</Text>
          <View style={styles.outlineBody}>
            <Text style={styles.outlineLabel}>{row.label}</Text>
            <Text style={styles.listText}>{row.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ImageExportPage({ lines, index, total, setRef }) {
  return (
    <View ref={setRef} collapsable={false} style={styles.imagePage}>
      <View style={styles.imagePageHeader}>
        <Text style={styles.imagePageBrand}>NOTA</Text>
        <Text style={styles.imagePageNumber}>{index + 1}/{total}</Text>
      </View>
      <View style={styles.imagePageBody}>
        {lines.map((line, lineIndex) => (
          <View key={`${lineIndex}-${line.text}`} style={line.type === 'bullet' ? styles.imageBulletRow : null}>
            {line.prefix ? <Text style={styles.imagePrefix}>{line.prefix}</Text> : null}
            <Text
              style={[
                styles.imageLine,
                line.type === 'title' && styles.imageTitle,
                line.type === 'heading' && styles.imageHeading,
                line.type === 'bullet' && styles.imageBulletText,
              ]}>
              {line.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ExportScreen({ route, navigation }) {
  const { documents, highlightsByDoc, appendActivity, preferences } = useAppContext();
  const previewRef = useRef(null);
  const imagePageRefs = useRef([]);
  const routeDoc = normalizeDocument(route?.params?.doc || documents[0] || {});
  const doc = documents.find((item) => item.id === routeDoc.id) || routeDoc;
  const [format, setFormat] = useState(preferences?.settings?.defaultExportFormat || 'markdown');
  const [template, setTemplate] = useState(preferences?.settings?.defaultExportTemplate || 'study-notes');
  const [exportName, setExportName] = useState(`${doc.title.replace(/\.[^.]+$/, '')} Notes`);
  const [selectedRoles, setSelectedRoles] = useState(
    Object.fromEntries(COLOR_ROLES.map((role) => [role.id, true]))
  );

  const tokens = useMemo(() => splitIntoTokens(doc.extracted_text || ''), [doc.extracted_text]);
  const groups = useMemo(
    () => getHighlightedGroups(tokens, highlightsByDoc?.[doc.id] || {}),
    [doc.id, highlightsByDoc, tokens]
  );
  const sections = useMemo(
    () => buildStructuredExportSections(groups, selectedRoles),
    [groups, selectedRoles]
  );
  const selectedCount = groups.filter((group) => selectedRoles[group.roleId]).length;
  const flashcards = useMemo(() => buildFlashcards(groups, selectedRoles), [groups, selectedRoles]);
  const payload = useMemo(
    () => buildExportPayload({ doc, groups, format, selectedRoles, template }),
    [doc, format, groups, selectedRoles, template]
  );
  const imagePages = useMemo(
    () => buildImagePages({ sections, flashcards, template, exportName: exportName.trim() || doc.title }),
    [doc.title, exportName, flashcards, sections, template]
  );

  const toggleRole = (roleId) => {
    setSelectedRoles((current) => ({ ...current, [roleId]: !current[roleId] }));
  };

  const shareImage = async () => {
    if (selectedCount === 0) {
      Alert.alert('Nothing To Export', 'Select at least one highlighted role.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        await Share.share({ title: `${doc.title} Image`, message: payload });
        return;
      }

      const refs = imagePageRefs.current.filter(Boolean);
      if (!refs.length) throw new Error('No image pages rendered');

      for (let index = 0; index < refs.length; index += 1) {
        const uri = await captureRef(refs[index], {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });

        const title = `${exportName || doc.title} ${index + 1}-${refs.length}`;
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: title,
            UTI: 'public.png',
          });
        } else {
          await Share.share({ title, url: uri, message: title });
        }
      }
      await appendActivity(`Exported ${refs.length} image${refs.length === 1 ? '' : 's'} from ${doc.title}.`);
    } catch (error) {
      console.log('Image export failed:', error);
      Alert.alert('Image Export Failed', 'Please try again after the preview finishes rendering.');
    }
  };

  const sharePdf = async () => {
    if (selectedCount === 0) {
      Alert.alert('Nothing To Export', 'Select at least one highlighted role.');
      return;
    }

    try {
      const cleanName = sanitizeFileName(exportName || doc.title);
      const html = buildExportHtml({ doc, sections, flashcards, template, exportName: cleanName });
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      const renamedUri = `${FileSystem.cacheDirectory}${cleanName}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: renamedUri });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(renamedUri, {
          mimeType: 'application/pdf',
          dialogTitle: `${cleanName} PDF`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Share.share({ title: `${cleanName} PDF`, url: renamedUri, message: `${cleanName} PDF` });
      }
      await appendActivity(`Exported PDF from ${doc.title}.`);
    } catch (error) {
      console.log('PDF export failed:', error);
      Alert.alert('PDF Export Failed', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.controlBand}>
        <View style={styles.nameRow}>
          <Text style={styles.nameLabel}>PDF Name</Text>
          <TextInput
            style={styles.nameInput}
            value={exportName}
            onChangeText={setExportName}
            placeholder="Export name"
            placeholderTextColor="#8E8E93"
          />
        </View>
        <View style={styles.fileActionRow}>
          <TouchableOpacity style={styles.fileAction} onPress={shareImage}>
            <Text style={styles.fileActionText}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileAction} onPress={sharePdf}>
            <Text style={styles.fileActionText}>PDF</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlRow}>
          {FORMATS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.formatChip, format === item.id && styles.formatChipActive]}
              onPress={() => setFormat(item.id)}>
              <Text style={[styles.formatChipText, format === item.id && styles.formatChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          {TEMPLATES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.formatChip, template === item.id && styles.formatChipActive]}
              onPress={() => setTemplate(item.id)}>
              <Text style={[styles.formatChipText, template === item.id && styles.formatChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          {COLOR_ROLES.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.roleChip,
                { borderColor: role.color },
                selectedRoles[role.id] && { backgroundColor: role.color },
              ]}
              onPress={() => toggleRole(role.id)}>
              <Text style={[styles.roleChipText, selectedRoles[role.id] && styles.roleChipTextActive]}>
                {role.shortLabel}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.exportCanvas} contentContainerStyle={styles.exportContent}>
        <View ref={previewRef} collapsable={false} style={styles.captureArea}>
          {sections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No highlights yet</Text>
              <Text style={styles.emptyText}>Highlight Title, Definition, List, Example, and Summary text to build this export.</Text>
            </View>
          ) : template === 'flashcards' ? (
            flashcards.map((card, index) => (
              <View key={`${card.front}-${index}`} style={styles.flashcard}>
                <Text style={styles.flashcardMeta}>Card {index + 1} | {card.section}</Text>
                <Text style={styles.flashcardFront}>{card.front}</Text>
                <Text style={styles.flashcardBack}>{card.back}</Text>
              </View>
            ))
          ) : template === 'reviewer' ? (
            sections.map((section) => <ReviewerSection key={section.id} section={section} />)
          ) : template === 'outline' ? (
            sections.map((section) => <OutlineSection key={section.id} section={section} />)
          ) : (
            sections.map((section) => <ExportSection key={section.id} section={section} />)
          )}
        </View>
      </ScrollView>

      <View pointerEvents="none" style={styles.hiddenImagePages}>
        {imagePages.map((lines, index) => (
          <ImageExportPage
            key={`hidden-image-page-${index}`}
            lines={lines}
            index={index}
            total={imagePages.length}
            setRef={(ref) => {
              imagePageRefs.current[index] = ref;
            }}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#000',
  },
  headerButton: { minWidth: 68 },
  headerButtonText: { color: '#E8E8EA', fontSize: 16, fontWeight: '800' },
  headerTitle: { color: '#E8E8EA', fontSize: 17, fontWeight: '900' },
  controlBand: {
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#191919',
    paddingBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 10,
  },
  nameLabel: { color: '#8E8E93', fontSize: 12, fontWeight: '900' },
  nameInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#303034',
    color: '#E8E8EA',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '800',
  },
  fileActionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 10 },
  fileAction: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#303034',
    alignItems: 'center',
    paddingVertical: 9,
  },
  fileActionText: { color: '#E8E8EA', fontSize: 12, fontWeight: '900' },
  controlRow: { paddingHorizontal: 20, gap: 8 },
  formatChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#303034',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  formatChipActive: { backgroundColor: '#E8E8EA', borderColor: '#E8E8EA' },
  formatChipText: { color: '#D8D8DA', fontSize: 12, fontWeight: '900' },
  formatChipTextActive: { color: '#000' },
  roleChip: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleChipText: { color: '#E8E8EA', fontSize: 12, fontWeight: '900' },
  roleChipTextActive: { color: '#000' },
  exportCanvas: { flex: 1, backgroundColor: '#000' },
  captureArea: { backgroundColor: '#000' },
  exportContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 64,
  },
  hiddenImagePages: { position: 'absolute', left: -1200, top: 0, width: 1080 },
  imagePage: {
    width: '100%',
    aspectRatio: 1.91,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  imagePageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  imagePageBrand: { color: '#E2E2E4', fontSize: 9, fontWeight: '900' },
  imagePageNumber: { color: '#8E8E93', fontSize: 9, fontWeight: '900' },
  imagePageBody: { flex: 1 },
  imageLine: { color: '#E2E2E4', fontSize: 10, lineHeight: 13, marginBottom: 2 },
  imageTitle: { fontSize: 12, lineHeight: 15, fontWeight: '900', marginBottom: 4 },
  imageHeading: { color: '#8E8EEA', fontSize: 10, lineHeight: 13, fontWeight: '900', marginTop: 2 },
  imageBulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  imagePrefix: { width: 42, color: '#8E8E93', fontSize: 9, lineHeight: 13, fontWeight: '900' },
  imageBulletText: { flex: 1 },
  exportSection: { marginBottom: 28 },
  exportTitle: {
    color: '#E2E2E4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  definitionText: {
    color: '#E2E2E4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginBottom: 6,
  },
  listWrap: { marginTop: 2, marginBottom: 8, paddingLeft: 14 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bullet: {
    width: 12,
    color: '#E2E2E4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  listText: {
    flex: 1,
    color: '#E2E2E4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  exampleText: {
    color: '#E2E2E4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginBottom: 16,
  },
  groupHeading: {
    color: '#8E8EEA',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  checkbox: {
    width: 26,
    color: '#E2E2E4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  outlineRow: { flexDirection: 'row', marginBottom: 8 },
  outlineIndex: { width: 20, color: '#8E8E93', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  outlineBody: { flex: 1, borderLeftWidth: 1, borderLeftColor: '#303034', paddingLeft: 10 },
  outlineLabel: { color: '#8E8E93', fontSize: 10, lineHeight: 13, fontWeight: '900', textTransform: 'uppercase' },
  summaryText: {
    color: '#E2E2E4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 8,
  },
  emptyState: { paddingTop: 80 },
  emptyTitle: {
    color: '#E2E2E4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    marginBottom: 18,
  },
  emptyText: {
    color: '#E2E2E4',
    fontSize: 12,
    lineHeight: 16,
  },
  flashcard: {
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 18,
    padding: 22,
    marginBottom: 18,
  },
  flashcardMeta: { color: '#8E8E93', fontSize: 13, fontWeight: '900', marginBottom: 12 },
  flashcardFront: { color: '#E2E2E4', fontSize: 12, lineHeight: 16, fontWeight: '900', marginBottom: 8 },
  flashcardBack: { color: '#E2E2E4', fontSize: 12, lineHeight: 16 },
});
