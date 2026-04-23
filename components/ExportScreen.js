import React, { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { buildExportText, buildStructuredSections } from '../utils/documentUtils';

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

export default function ExportScreen({ route, navigation }) {
  const doc = route.params?.doc;
  const [selectedFormat, setSelectedFormat] = useState('txt');
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const sections = useMemo(
    () => buildStructuredSections(doc?.extracted_text || '', doc?.highlights || {}),
    [doc]
  );

  const toggleOption = (id) => {
    setOptions((value) => value.map((option) => (option.id === id ? { ...option, on: !option.on } : option)));
  };

  const optionMap = Object.fromEntries(options.map((option) => [option.id, option.on]));

  const handleExport = async () => {
    if (sections.length === 0) {
      Alert.alert('Nothing to export', 'Add highlights first so the export has meaningful content.');
      return;
    }

    const message = buildExportText(
      { ...doc, highlightCount: Object.keys(doc?.highlights || {}).length },
      sections,
      { includeColorLegend: optionMap.include_color_legend }
    );

    await Share.share({
      title: `${doc?.title || 'Document'} export`,
      message:
        selectedFormat === 'outline'
          ? `STUDY OUTLINE\n\n${message}`
          : selectedFormat === 'md'
            ? `# ${doc?.title || 'Document'}\n\n${message}`
            : message,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.docInfo}>
          <Text style={styles.docIcon}>📄</Text>
          <View>
            <Text style={styles.docTitle}>{doc?.title || 'Document'}</Text>
            <Text style={styles.docMeta}>
              {Object.keys(doc?.highlights || {}).length} highlights · {sections.length} structured sections
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Format</Text>
        {FORMATS.map((format) => (
          <TouchableOpacity
            key={format.id}
            style={[styles.formatRow, selectedFormat === format.id && styles.formatRowSelected]}
            onPress={() => setSelectedFormat(format.id)}
          >
            <Text style={styles.formatIcon}>{format.icon}</Text>
            <View style={styles.formatInfo}>
              <Text style={styles.formatTitle}>{format.title}</Text>
              <Text style={styles.formatSub}>{format.sub}</Text>
            </View>
            <View style={[styles.radio, selectedFormat === format.id && styles.radioSelected]}>
              {selectedFormat === format.id ? <View style={styles.radioDot} /> : null}
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionLabel}>Options</Text>
        <View style={styles.optionsCard}>
          {options.map((option, index) => (
            <View key={option.id}>
              <TouchableOpacity style={styles.optionRow} onPress={() => toggleOption(option.id)}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <View style={[styles.toggle, option.on && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, option.on && styles.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
              {index < options.length - 1 ? <View style={styles.optSep} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Export Preview</Text>
          <Text style={styles.previewText} numberOfLines={10}>
            {buildExportText(
              { ...doc, highlightCount: Object.keys(doc?.highlights || {}).length },
              sections,
              { includeColorLegend: optionMap.include_color_legend }
            )}
          </Text>
        </View>

        <TouchableOpacity style={styles.exportCTA} onPress={handleExport}>
          <Text style={styles.exportCTAIcon}>↑</Text>
          <Text style={styles.exportCTAText}>Export Document</Text>
        </TouchableOpacity>
      </ScrollView>
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
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  backArrow: { fontSize: 26, color: '#007AFF', lineHeight: 30 },
  backText: { color: '#007AFF', fontSize: 17 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  scroll: { padding: 20 },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  docIcon: { fontSize: 32 },
  docTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  docMeta: { fontSize: 13, color: '#8E8E93', marginTop: 3 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  formatRowSelected: { borderColor: '#007AFF', backgroundColor: '#EFF6FF' },
  formatIcon: { fontSize: 26 },
  formatInfo: { flex: 1 },
  formatTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  formatSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: { borderColor: '#007AFF' },
  radioDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#007AFF' },
  optionsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionLabel: { fontSize: 15, color: '#1C1C1E' },
  optSep: { height: 1, backgroundColor: '#F2F2F7', marginHorizontal: 16 },
  toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#E5E5EA', padding: 3 },
  toggleOn: { backgroundColor: '#34C759' },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  toggleThumbOn: { transform: [{ translateX: 20 }] },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  previewTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  previewText: { fontSize: 13, lineHeight: 20, color: '#4F4F57' },
  exportCTA: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  exportCTAIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  exportCTAText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
