import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView
} from "react-native";
import BottomNav from "./BottomNav";

const STRUCTURED = [
  {
    type: "title",
    color: "#FF3B30",
    icon: "T",
    label: "Title",
    text: "Cognitive Load Theory",
  },
  {
    type: "definition",
    color: "#FFCC00",
    icon: "D",
    label: "Definition",
    text: "Cognitive load refers to the total amount of mental effort being used in the working memory at any given time.",
  },
  {
    type: "list",
    color: "#34C759",
    icon: "L",
    label: "List",
    items: [
      "Intrinsic load — related to the complexity of the material",
      "Extraneous load — caused by poor instructional design",
      "Germane load — effort of creating mental schemas",
    ],
  },
  {
    type: "title",
    color: "#FF3B30",
    icon: "T",
    label: "Title",
    text: "Working Memory Limitations",
  },
  {
    type: "definition",
    color: "#FFCC00",
    icon: "D",
    label: "Definition",
    text: "Miller's Law states that the human mind can hold approximately 7 (±2) chunks of information in working memory at once.",
  },
  {
    type: "example",
    color: "#007AFF",
    icon: "E",
    label: "Example",
    text: "A student learning calculus for the first time will experience high intrinsic cognitive load due to the novelty and complexity of the concepts involved.",
  },
  {
    type: "summary",
    color: "#AF52DE",
    icon: "S",
    label: "Summary",
    text: "Understanding cognitive load helps educators design lessons that align with how the human brain processes and retains information most effectively.",
  },
];

export default function PreviewScreen({ navigation }) {
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
        <Text style={styles.headerTitle}>Live Preview</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => navigation?.navigate("Export")}
        >
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll}>
        {[
          { color: "#FF3B30", label: "Title" },
          { color: "#FFCC00", label: "Definition" },
          { color: "#34C759", label: "List" },
          { color: "#007AFF", label: "Example" },
          { color: "#AF52DE", label: "Summary" },
        ].map((r, i) => (
          <View key={i} style={styles.legendChip}>
            <View style={[styles.legendDot, { backgroundColor: r.color }]} />
            <Text style={styles.legendLabel}>{r.label}</Text>
          </View>
        ))}
        <View style={{ width: 16 }} />
      </ScrollView>

      {/* Structured Document */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.docName}>Cognitive Psychology Ch.4</Text>
        <Text style={styles.docSubMeta}>18 pages · 34 highlights · Auto-structured</Text>

        {STRUCTURED.map((block, i) => {
          if (block.type === "list") {
            return (
              <View key={i} style={[styles.block, styles.listBlock, { borderLeftColor: block.color }]}>
                <View style={styles.blockHeader}>
                  <View style={[styles.blockBadge, { backgroundColor: block.color }]}>
                    <Text style={styles.blockBadgeText}>{block.icon}</Text>
                  </View>
                  <Text style={[styles.blockLabel, { color: block.color }]}>{block.label}</Text>
                </View>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.listItem}>
                    <View style={[styles.bullet, { backgroundColor: block.color }]} />
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <View
              key={i}
              style={[
                styles.block,
                { borderLeftColor: block.color },
                block.type === "title" && styles.titleBlock,
                block.type === "summary" && styles.summaryBlock,
              ]}
            >
              <View style={styles.blockHeader}>
                <View style={[styles.blockBadge, { backgroundColor: block.color }]}>
                  <Text style={styles.blockBadgeText}>{block.icon}</Text>
                </View>
                <Text style={[styles.blockLabel, { color: block.color }]}>{block.label}</Text>
              </View>
              <Text
                style={[
                  styles.blockText,
                  block.type === "title" && styles.titleText,
                  block.type === "summary" && styles.summaryText,
                ]}
              >
                {block.text}
              </Text>
            </View>
          );
        })}

        {/* AI Enhance Banner */}
        <TouchableOpacity style={styles.aiBanner}>
          <Text style={styles.aiIcon}>🤖</Text>
          <View style={styles.aiInfo}>
            <Text style={styles.aiTitle}>AI Enhancement</Text>
            <Text style={styles.aiSub}>Generate summaries & fill gaps</Text>
          </View>
          <Text style={styles.aiArrow}>›</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav navigation={navigation} active="Preview" />
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
  exportBtn: {
    backgroundColor: "#007AFF", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  exportText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  legendScroll: { paddingVertical: 10, paddingHorizontal: 16, maxHeight: 54 },
  legendChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 8, gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontWeight: "600", color: "#1C1C1E" },
  scroll: { flex: 1 },
  content: { padding: 16 },
  docName: { fontSize: 20, fontWeight: "800", color: "#1C1C1E", marginBottom: 4 },
  docSubMeta: { fontSize: 13, color: "#8E8E93", marginBottom: 20 },
  block: {
    backgroundColor: "#fff", borderRadius: 14,
    padding: 16, marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  titleBlock: { backgroundColor: "#FFF5F5" },
  summaryBlock: { backgroundColor: "#F8F0FF" },
  listBlock: {},
  blockHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  blockBadge: {
    width: 22, height: 22, borderRadius: 6,
    justifyContent: "center", alignItems: "center",
  },
  blockBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  blockLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  blockText: { fontSize: 15, color: "#1C1C1E", lineHeight: 24 },
  titleText: { fontSize: 19, fontWeight: "800" },
  summaryText: { fontStyle: "italic" },
  listItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 10 },
  bullet: { width: 7, height: 7, borderRadius: 3.5, marginTop: 8 },
  listItemText: { flex: 1, fontSize: 15, color: "#1C1C1E", lineHeight: 24 },
  aiBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1C1C1E", borderRadius: 16,
    padding: 16, marginTop: 8, gap: 12,
  },
  aiIcon: { fontSize: 28 },
  aiInfo: { flex: 1 },
  aiTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  aiSub: { color: "#8E8E93", fontSize: 12, marginTop: 2 },
  aiArrow: { color: "#fff", fontSize: 22 },
});