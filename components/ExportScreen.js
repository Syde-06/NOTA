import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView
} from "react-native";

const FORMATS = [
  { id: "pdf", icon: "📄", title: "PDF", sub: "Print-ready formatted document", badge: "Popular" },
  { id: "docx", icon: "📝", title: "Word Document", sub: "Editable .docx with styles", badge: null },
  { id: "md", icon: "🗒️", title: "Markdown", sub: "Clean text with heading hierarchy", badge: null },
  { id: "notion", icon: "◼", title: "Notion Page", sub: "Import directly to Notion", badge: "New" },
  { id: "obsidian", icon: "💎", title: "Obsidian Vault", sub: "Wiki-linked note format", badge: null },
];

const OPTIONS = [
  { id: "include_page_refs", label: "Include page references", on: true },
  { id: "include_color_legend", label: "Include color legend", on: true },
  { id: "ai_summaries", label: "Add AI-generated summaries", on: false },
  { id: "group_by_color", label: "Group sections by color role", on: false },
];

export default function ExportScreen({ navigation }) {
  const [selectedFormat, setSelectedFormat] = useState("pdf");
  const [options, setOptions] = useState(OPTIONS);

  const toggleOption = (id) => {
    setOptions(opts => opts.map(o => o.id === id ? { ...o, on: !o.on } : o));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={{ height: 25 }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Doc info */}
        <View style={styles.docInfo}>
          <Text style={styles.docIcon}>📄</Text>
          <View>
            <Text style={styles.docTitle}>Cognitive Psychology Ch.4</Text>
            <Text style={styles.docMeta}>34 highlights · 7 sections structured</Text>
          </View>
        </View>

        {/* Format */}
        <Text style={styles.sectionLabel}>Format</Text>
        {FORMATS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.formatRow, selectedFormat === f.id && styles.formatRowSelected]}
            onPress={() => setSelectedFormat(f.id)}
          >
            <Text style={styles.formatIcon}>{f.icon}</Text>
            <View style={styles.formatInfo}>
              <View style={styles.formatTitleRow}>
                <Text style={styles.formatTitle}>{f.title}</Text>
                {f.badge && (
                  <View style={[styles.badge, f.badge === "New" && styles.badgeNew]}>
                    <Text style={styles.badgeText}>{f.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.formatSub}>{f.sub}</Text>
            </View>
            <View style={[styles.radio, selectedFormat === f.id && styles.radioSelected]}>
              {selectedFormat === f.id && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}

        {/* Options */}
        <Text style={styles.sectionLabel}>Options</Text>
        <View style={styles.optionsCard}>
          {options.map((opt, i) => (
            <View key={opt.id}>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => toggleOption(opt.id)}
              >
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <View style={[styles.toggle, opt.on && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, opt.on && styles.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
              {i < options.length - 1 && <View style={styles.optSep} />}
            </View>
          ))}
        </View>

        {/* Export CTA */}
        <TouchableOpacity style={styles.exportCTA}>
          <Text style={styles.exportCTAIcon}>↑</Text>
          <Text style={styles.exportCTAText}>Export Document</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>Share Link</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F5F7" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  backBtn: { flexDirection: "row", alignItems: "center", width: 70 },
  backArrow: { fontSize: 26, color: "#007AFF", lineHeight: 30 },
  backText: { color: "#007AFF", fontSize: 17 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  scroll: { padding: 20 },
  docInfo: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    padding: 16, marginBottom: 24, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  docIcon: { fontSize: 32 },
  docTitle: { fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  docMeta: { fontSize: 13, color: "#8E8E93", marginTop: 3 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#8E8E93", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },
  formatRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    padding: 14, marginBottom: 10, gap: 12,
    borderWidth: 2, borderColor: "transparent",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6,
  },
  formatRowSelected: { borderColor: "#007AFF", backgroundColor: "#EFF6FF" },
  formatIcon: { fontSize: 26 },
  formatInfo: { flex: 1 },
  formatTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  formatTitle: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  formatSub: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  badge: {
    backgroundColor: "#FF9500", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeNew: { backgroundColor: "#34C759" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: "#C7C7CC",
    justifyContent: "center", alignItems: "center",
  },
  radioSelected: { borderColor: "#007AFF" },
  radioDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: "#007AFF" },
  optionsCard: {
    backgroundColor: "#fff", borderRadius: 14,
    marginBottom: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  optionRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  optionLabel: { fontSize: 15, color: "#1C1C1E" },
  optSep: { height: 1, backgroundColor: "#F2F2F7", marginHorizontal: 16 },
  toggle: {
    width: 50, height: 30, borderRadius: 15,
    backgroundColor: "#E5E5EA", padding: 3,
  },
  toggleOn: { backgroundColor: "#34C759" },
  toggleThumb: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2,
  },
  toggleThumbOn: { transform: [{ translateX: 20 }] },
  exportCTA: {
    backgroundColor: "#1C1C1E", borderRadius: 16,
    paddingVertical: 17, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12,
  },
  exportCTAIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },
  exportCTAText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  shareBtn: {
    backgroundColor: "#fff", borderRadius: 16,
    paddingVertical: 17, alignItems: "center",
    borderWidth: 1.5, borderColor: "#E5E5EA",
  },
  shareBtnText: { color: "#1C1C1E", fontSize: 17, fontWeight: "600" },
});