import React, { useMemo, useState } from 'react';
import {
  Alert, SafeAreaView, ScrollView, Share, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { buildExportText, buildStructuredSections } from '../utils/documentUtils';
import { useAppContext } from '../contexts/AppContext';

const FORMATS = [
  { id: 'txt', icon: '◫', title: 'Plain Text', sub: 'Simple shareable text export' },
  { id: 'md', icon: '◇', title: 'Markdown', sub: 'Heading-friendly study notes' },
  { id: 'outline', icon: '≣', title: 'Study Outline', sub: 'Compact revision handout' },
];
const INITIAL_OPTIONS = [
  { id: 'include_page_refs', label: 'Include page references', on: true },
  { id: 'include_color_legend', label: 'Include color legend', on: true },
  { id: 'group_by_color', label: 'Group sections by role', on: true },
];

function makeColors(dark) {
  return {
    bg: dark ? '#1C1C1E' : '#F5F5F7',
    card: dark ? '#2C2C2E' : '#fff',
    text: dark ? '#F5F5F7' : '#1C1C1E',
    sub: dark ? '#A0A0A8' : '#8E8E93',
    sub2: dark ? '#A0A0A8' : '#4F4F57',
    sep: dark ? '#3A3A3C' : '#F2F2F7',
    statusBar: dark ? 'light-content' : 'dark-content',
    selectedBg: dark ? '#1A2A3A' : '#EFF6FF',
    selectedBorder: '#007AFF',
    toggleOff: dark ? '#3A3A3C' : '#E5E5EA',
    primaryBtn: dark ? '#F5F5F7' : '#1C1C1E',
    primaryBtnText: dark ? '#1C1C1E' : '#fff',
  };
}

export default function ExportScreen({ route, navigation }) {
  const { darkMode } = useAppContext();
  const C = makeColors(darkMode);
  const doc = route.params?.doc;
  const [selectedFormat, setSelectedFormat] = useState('txt');
  const [options, setOptions] = useState(INITIAL_OPTIONS);

  const sections = useMemo(() => buildStructuredSections(doc?.extracted_text || '', doc?.highlights || {}), [doc]);
  const toggleOption = (id) => setOptions((v) => v.map((o) => (o.id === id ? { ...o, on: !o.on } : o)));
  const optionMap = Object.fromEntries(options.map((o) => [o.id, o.on]));

  const handleExport = async () => {
    if (sections.length === 0) { Alert.alert('Nothing to export', 'Add highlights first so the export has meaningful content.'); return; }
    const message = buildExportText(
      { ...doc, highlightCount: Object.keys(doc?.highlights || {}).length },
      sections,
      { includeColorLegend: optionMap.include_color_legend }
    );
    await Share.share({
      title: `${doc?.title || 'Document'} export`,
      message: selectedFormat === 'outline' ? `STUDY OUTLINE\n\n${message}` : selectedFormat === 'md' ? `# ${doc?.title || 'Document'}\n\n${message}` : message,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>Export</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.docInfo, { backgroundColor: C.card }]}>
          <Text style={styles.docIcon}>📄</Text>
          <View>
            <Text style={[styles.docTitle, { color: C.text }]}>{doc?.title || 'Document'}</Text>
            <Text style={[styles.docMeta, { color: C.sub }]}>{Object.keys(doc?.highlights || {}).length} highlights · {sections.length} structured sections</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: C.sub }]}>Format</Text>
        {FORMATS.map((format) => (
          <TouchableOpacity
            key={format.id}
            style={[styles.formatRow, { backgroundColor: selectedFormat === format.id ? C.selectedBg : C.card, borderColor: selectedFormat === format.id ? C.selectedBorder : 'transparent' }]}
            onPress={() => setSelectedFormat(format.id)}
          >
            <Text style={styles.formatIcon}>{format.icon}</Text>
            <View style={styles.formatInfo}>
              <Text style={[styles.formatTitle, { color: C.text }]}>{format.title}</Text>
              <Text style={[styles.formatSub, { color: C.sub }]}>{format.sub}</Text>
            </View>
            <View style={[styles.radio, { borderColor: selectedFormat === format.id ? '#007AFF' : '#C7C7CC' }]}>
              {selectedFormat === format.id ? <View style={styles.radioDot} /> : null}
            </View>
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionLabel, { color: C.sub }]}>Options</Text>
        <View style={[styles.optionsCard, { backgroundColor: C.card }]}>
          {options.map((option, index) => (
            <View key={option.id}>
              <TouchableOpacity style={styles.optionRow} onPress={() => toggleOption(option.id)}>
                <Text style={[styles.optionLabel, { color: C.text }]}>{option.label}</Text>
                <View style={[styles.toggle, { backgroundColor: option.on ? '#34C759' : C.toggleOff }]}>
                  <View style={[styles.toggleThumb, option.on && styles.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
              {index < options.length - 1 ? <View style={[styles.optSep, { backgroundColor: C.sep }]} /> : null}
            </View>
          ))}
        </View>

        <View style={[styles.previewCard, { backgroundColor: C.card }]}>
          <Text style={[styles.previewTitle, { color: C.text }]}>Export Preview</Text>
          <Text style={[styles.previewText, { color: C.sub2 }]} numberOfLines={10}>
            {buildExportText({ ...doc, highlightCount: Object.keys(doc?.highlights || {}).length }, sections, { includeColorLegend: optionMap.include_color_legend })}
          </Text>
        </View>

        <TouchableOpacity style={[styles.exportCTA, { backgroundColor: C.primaryBtn }]} onPress={handleExport}>
          <Text style={[styles.exportCTAIcon, { color: C.primaryBtnText }]}>↑</Text>
          <Text style={[styles.exportCTAText, { color: C.primaryBtnText }]}>Export Document</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  backArrow: { fontSize: 26, color: '#007AFF', lineHeight: 30 },
  backText: { color: '#007AFF', fontSize: 17 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20 },
  docInfo: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 24, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8 },
  docIcon: { fontSize: 32 },
  docTitle: { fontSize: 16, fontWeight: '700' },
  docMeta: { fontSize: 13, marginTop: 3 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  formatRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
  formatIcon: { fontSize: 26 },
  formatInfo: { flex: 1 },
  formatTitle: { fontSize: 15, fontWeight: '700' },
  formatSub: { fontSize: 12, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#007AFF' },
  optionsCard: { borderRadius: 14, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  optionLabel: { fontSize: 15 },
  optSep: { height: 1, marginHorizontal: 16 },
  toggle: { width: 50, height: 30, borderRadius: 15, padding: 3 },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  toggleThumbOn: { transform: [{ translateX: 20 }] },
  previewCard: { borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8 },
  previewTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  previewText: { fontSize: 13, lineHeight: 20 },
  exportCTA: { borderRadius: 16, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  exportCTAIcon: { fontSize: 18, fontWeight: '700' },
  exportCTAText: { fontSize: 17, fontWeight: '700' },
});