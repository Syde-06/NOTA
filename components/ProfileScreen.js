import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, TextInput,
  ActivityIndicator, Alert,
} from "react-native";
import { useAppContext } from "../contexts/AppContext";

const COLOR_ROLES = [
  { color: "#FF3B30", label: "Title", key: "red" },
  { color: "#FFCC00", label: "Definition", key: "yellow" },
  { color: "#34C759", label: "List / Enum", key: "green" },
  { color: "#007AFF", label: "Example / Evidence", key: "blue" },
  { color: "#AF52DE", label: "Summary / Conclusion", key: "purple" },
];

function getInitials(fullName = "") {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  // First letter of first name + first letter of last name + first letter of middle (if 3 parts)
  return parts
    .slice(0, 3)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export default function ProfileScreen({ navigation }) {
  const {
    profile,
    statusMessage,
    activityFeed,
    authLoading,
    updateProfile,
    logout,
  } = useAppContext();
  const [name, setName] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleLabels, setRoleLabels] = useState({
    red: "Title",
    yellow: "Definition",
    green: "List / Enum",
    blue: "Example / Evidence",
    purple: "Summary / Conclusion",
  });

  useEffect(() => {
    setName(profile?.full_name || "");
    setStatusDraft(statusMessage || "");
  }, [profile, statusMessage]);

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Name cannot be empty.");
      return;
    }
    if (!statusDraft.trim()) {
      Alert.alert("Validation", "Status message cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await updateProfile({
        fullName: name,
        status: statusDraft,
      });
      if (error) throw error;
      setEditing(false);
    } catch (e) {
      Alert.alert("Error", "Failed to save profile. Please try again.");
      console.log("saveProfile error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDone = () => {
    if (editing) {
      saveProfile();
    } else {
      setEditing(true);
    }
  };

  const handleSignOut = async () => {
    await logout();
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#1C1C1E" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={{ height: 25 }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={handleDone} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.editBtn}>{editing ? "Done" : "Edit"}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
          {editing && (
            <TouchableOpacity style={styles.changePhotoBtn}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          )}
          {!editing && <Text style={styles.profileName}>{name || "Nota User"}</Text>}
          {!editing && <Text style={styles.profileEmail}>{profile?.email || ""}</Text>}
          {!editing && <Text style={styles.profileStatus}>{statusDraft}</Text>}
        </View>

        {/* Info Card */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            {editing ? (
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                placeholder="Full Name"
              />
            ) : (
              <Text style={styles.fieldValue}>{name}</Text>
            )}
          </View>
          <View style={styles.cardSep} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{profile?.email || "No email available"}</Text>
          </View>
          <View style={styles.cardSep} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Plan</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>
          <View style={styles.cardSep} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Status</Text>
            {editing ? (
              <TextInput
                style={styles.fieldInput}
                value={statusDraft}
                onChangeText={setStatusDraft}
                placeholder="Working on..."
              />
            ) : (
              <Text style={styles.fieldValue}>{statusDraft}</Text>
            )}
          </View>
        </View>

        {/* Color Role Editor */}
        <Text style={styles.sectionLabel}>Color Roles</Text>
        <View style={styles.card}>
          {COLOR_ROLES.map((r, i) => (
            <View key={r.key}>
              <View style={styles.roleRow}>
                <View style={[styles.roleDot, { backgroundColor: r.color }]} />
                {editing ? (
                  <TextInput
                    style={styles.roleInput}
                    value={roleLabels[r.key]}
                    onChangeText={(v) =>
                      setRoleLabels((prev) => ({ ...prev, [r.key]: v }))
                    }
                  />
                ) : (
                  <Text style={styles.roleLabel}>{roleLabels[r.key]}</Text>
                )}
              </View>
              {i < COLOR_ROLES.length - 1 && <View style={styles.cardSep} />}
            </View>
          ))}
        </View>

        {/* Stats */}
        <Text style={styles.sectionLabel}>Stats</Text>
        <View style={styles.statsRow}>
          {[
            { num: String(activityFeed.length), label: "Activities" },
            { num: "259", label: "Highlights" },
            { num: "7", label: "Exports" },
            { num: "4", label: "Weeks Active" },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statNum}>{s.num}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Settings */}
        <Text style={styles.sectionLabel}>Settings</Text>
        <View style={styles.card}>
          {["Notifications", "Dark Mode", "Export Defaults"].map((item, i, arr) => (
            <View key={item}>
              <TouchableOpacity style={styles.settingRow}>
                <Text style={styles.settingLabel}>{item}</Text>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={styles.cardSep} />}
            </View>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F5F7" },
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  backArrow: { fontSize: 26, color: "#007AFF", lineHeight: 30 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  editBtn: { fontSize: 17, color: "#007AFF", fontWeight: "600" },
  scroll: { paddingHorizontal: 20 },
  avatarSection: { alignItems: "center", paddingVertical: 28 },
  avatar: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: "#1C1C1E", justifyContent: "center", alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12,
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 28 },
  changePhotoBtn: { marginTop: 4 },
  changePhotoText: { color: "#007AFF", fontSize: 16 },
  profileName: { fontSize: 22, fontWeight: "800", color: "#1C1C1E" },
  profileEmail: { fontSize: 14, color: "#8E8E93", marginTop: 4 },
  profileStatus: { fontSize: 14, color: "#3A3A40", marginTop: 8, textAlign: "center" },
  sectionLabel: {
    fontSize: 13, fontWeight: "700", color: "#8E8E93",
    marginBottom: 10, textTransform: "uppercase", letterSpacing: 1,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 14,
    marginBottom: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  fieldRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  fieldLabel: { fontSize: 15, color: "#1C1C1E" },
  fieldValue: { fontSize: 15, color: "#8E8E93" },
  fieldInput: {
    fontSize: 15, color: "#007AFF",
    borderBottomWidth: 1, borderBottomColor: "#007AFF",
    minWidth: 160, textAlign: "right",
  },
  cardSep: { height: 1, backgroundColor: "#F2F2F7", marginHorizontal: 16 },
  proBadge: {
    backgroundColor: "#FF9500", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  proBadgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  roleRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  roleDot: { width: 14, height: 14, borderRadius: 7 },
  roleLabel: { fontSize: 15, color: "#1C1C1E" },
  roleInput: {
    flex: 1, fontSize: 15, color: "#007AFF",
    borderBottomWidth: 1, borderBottomColor: "#007AFF",
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  statNum: { fontSize: 20, fontWeight: "800", color: "#1C1C1E" },
  statLabel: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  settingRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 16,
  },
  settingLabel: { fontSize: 15, color: "#1C1C1E" },
  settingArrow: { fontSize: 20, color: "#C7C7CC" },
  signOutBtn: {
    backgroundColor: "#fff", borderRadius: 14,
    paddingVertical: 16, alignItems: "center",
    borderWidth: 1, borderColor: "#FF3B30",
  },
  signOutText: { color: "#FF3B30", fontSize: 16, fontWeight: "700" },
});
