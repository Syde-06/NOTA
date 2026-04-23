import React, { useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { buildStructuredSections, buildHighlightSummary, ROLE_DEFINITIONS } from '../utils/documentUtils';

export default function PreviewScreen({ route, navigation }) {
  const doc = route.params?.doc;
  const sections = useMemo(
    () => buildStructuredSections(doc?.extracted_text || '', doc?.highlights || {}),
    [doc]
  );
  const summary = useMemo(() => buildHighlightSummary(doc?.highlights || {}), [doc]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Preview</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={() => navigation?.navigate('Export', { doc })}>
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll}>
        {ROLE_DEFINITIONS.map((role) => (
          <View key={role.id} style={styles.legendChip}>
            <View style={[styles.legendDot, { backgroundColor: role.color }]} />
            <Text style={styles.legendLabel}>{role.label}</Text>
            <Text style={styles.legendCount}>{summary[role.id]}</Text>
          </View>
        ))}
        <View style={{ width: 16 }} />
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.docName}>{doc?.title || 'Document Preview'}</Text>
        <Text style={styles.docSubMeta}>
          {doc?.pages || 1} pages · {doc?.highlightCount || Object.keys(doc?.highlights || {}).length} highlights · Auto-structured
        </Text>

        {sections.length > 0 ? (
          sections.map((section) => (
            <View
              key={section.id}
              style={[
                styles.block,
                { borderLeftColor: section.roleDef.color, backgroundColor: section.roleDef.soft },
              ]}
            >
              <View style={styles.blockHeader}>
                <View style={[styles.blockBadge, { backgroundColor: section.roleDef.color }]}>
                  <Text style={styles.blockBadgeText}>{section.roleDef.emoji}</Text>
                </View>
                <Text style={[styles.blockLabel, { color: section.roleDef.color }]}>{section.roleDef.label}</Text>
              </View>
              <Text
                style={[
                  styles.blockText,
                  section.role === 'title' && styles.titleText,
                  section.role === 'summary' && styles.summaryText,
                ]}
              >
                {section.text}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No structured content yet</Text>
            <Text style={styles.emptySub}>Add highlights in the workspace to build a richer preview.</Text>
          </View>
        )}

        <View style={styles.aiBanner}>
          <Text style={styles.aiIcon}>◌</Text>
          <View style={styles.aiInfo}>
            <Text style={styles.aiTitle}>Structure-first preview</Text>
            <Text style={styles.aiSub}>This view groups your tagged content into a clean study sheet.</Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
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
  exportBtn: { backgroundColor: '#007AFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  exportText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  legendScroll: { paddingVertical: 10, paddingHorizontal: 16, maxHeight: 54 },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
  legendCount: { fontSize: 12, color: '#8E8E93' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  docName: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  docSubMeta: { fontSize: 13, color: '#8E8E93', marginBottom: 20 },
  block: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  blockBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  blockLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  blockText: { fontSize: 15, color: '#1C1C1E', lineHeight: 24 },
  titleText: { fontSize: 19, fontWeight: '800' },
  summaryText: { fontStyle: 'italic' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  aiIcon: { fontSize: 28, color: '#fff' },
  aiInfo: { flex: 1 },
  aiTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  aiSub: { color: '#A7A7AE', fontSize: 12, marginTop: 2 },
});
