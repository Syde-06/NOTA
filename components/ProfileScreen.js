import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppContext } from '../contexts/AppContext';

const COLOR_ROLES = [
  { color: '#FF3B30', label: 'Title', key: 'red' },
  { color: '#FFCC00', label: 'Definition', key: 'yellow' },
  { color: '#34C759', label: 'List / Enum', key: 'green' },
  { color: '#007AFF', label: 'Example / Evidence', key: 'blue' },
  { color: '#AF52DE', label: 'Summary / Conclusion', key: 'purple' },
];

function getInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0].toUpperCase())
    .join('');
}

// ─── theme helpers ───────────────────────────────────────────────────────────
function makeColors(dark) {
  return {
    bg: dark ? '#1C1C1E' : '#F5F5F7',
    card: dark ? '#2C2C2E' : '#fff',
    cardSep: dark ? '#3A3A3C' : '#F2F2F7',
    text: dark ? '#F5F5F7' : '#1C1C1E',
    sub: dark ? '#A0A0A8' : '#8E8E93',
    avatar: dark ? '#3A3A3C' : '#1C1C1E',
    settingArrow: dark ? '#636366' : '#C7C7CC',
    statusBar: dark ? 'light-content' : 'dark-content',
    inputBorder: '#007AFF',
  };
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }) {
  const {
    profile,
    profilePhoto,
    statusMessage,
    activityFeed,
    authLoading,
    updateProfile,
    updateProfilePhoto,
    logout,
    darkMode,
    toggleDarkMode,
  } = useAppContext();

  const C = makeColors(darkMode);

  const [name, setName] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [roleLabels, setRoleLabels] = useState({
    red: 'Title',
    yellow: 'Definition',
    green: 'List / Enum',
    blue: 'Example / Evidence',
    purple: 'Summary / Conclusion',
  });

  useEffect(() => {
    setName(profile?.full_name || '');
    setStatusDraft(statusMessage || '');
    setPhotoUri(profilePhoto || null);
  }, [profile, statusMessage, profilePhoto]);

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Photo picker error:', error);
      Alert.alert('Error', 'Unable to select a photo.');
    }
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }
    if (!statusDraft.trim()) {
      Alert.alert('Validation', 'Status message cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      if (photoUri !== profilePhoto) {
        const { error: photoError } = await updateProfilePhoto(photoUri);
        if (photoError) throw photoError;
      }
      const { error } = await updateProfile({
        fullName: name,
        status: statusDraft,
      });
      if (error) throw error;
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
      console.log('saveProfile error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDone = () => (editing ? saveProfile() : setEditing(true));
  const handleSignOut = async () => {
    await logout();
  };

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={C.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} />
      <View style={{ height: 25 }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={[styles.backArrow, { color: '#007AFF' }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>Profile</Text>
        <TouchableOpacity onPress={handleDone} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.editBtn}>{editing ? 'Done' : 'Edit'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: C.avatar }]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitials(name)}</Text>
            )}
          </View>
          {editing && (
            <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickPhoto}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          )}
          {!editing && (
            <Text style={[styles.profileName, { color: C.text }]}>
              {name || 'Nota User'}
            </Text>
          )}
          {!editing && (
            <Text style={[styles.profileEmail, { color: C.sub }]}>
              {profile?.email || ''}
            </Text>
          )}
          {!editing && (
            <Text style={[styles.profileStatus, { color: C.text }]}>
              {statusDraft}
            </Text>
          )}
        </View>

        {/* Account Card */}
        <Text style={[styles.sectionLabel, { color: C.sub }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: C.card }]}>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: C.text }]}>
              Full Name
            </Text>
            {editing ? (
              <TextInput
                style={[
                  styles.fieldInput,
                  { borderBottomColor: C.inputBorder, color: C.inputBorder },
                ]}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                placeholder="Full Name"
              />
            ) : (
              <Text style={[styles.fieldValue, { color: C.sub }]}>{name}</Text>
            )}
          </View>
          <View style={[styles.cardSep, { backgroundColor: C.cardSep }]} />
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: C.text }]}>Email</Text>
            <Text style={[styles.fieldValue, { color: C.sub }]}>
              {profile?.email || 'No email available'}
            </Text>
          </View>
          <View style={[styles.cardSep, { backgroundColor: C.cardSep }]} />
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: C.text }]}>Plan</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>
          <View style={[styles.cardSep, { backgroundColor: C.cardSep }]} />
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: C.text }]}>Status</Text>
            {editing ? (
              <TextInput
                style={[
                  styles.fieldInput,
                  { borderBottomColor: C.inputBorder, color: C.inputBorder },
                ]}
                value={statusDraft}
                onChangeText={setStatusDraft}
                placeholder="Working on..."
              />
            ) : (
              <Text style={[styles.fieldValue, { color: C.sub }]}>
                {statusDraft}
              </Text>
            )}
          </View>
        </View>

        {/* Color Roles */}
        <Text style={[styles.sectionLabel, { color: C.sub }]}>Color Roles</Text>
        <View style={[styles.card, { backgroundColor: C.card }]}>
          {COLOR_ROLES.map((r, i) => (
            <View key={r.key}>
              <View style={styles.roleRow}>
                <View style={[styles.roleDot, { backgroundColor: r.color }]} />
                {editing ? (
                  <TextInput
                    style={[
                      styles.roleInput,
                      {
                        borderBottomColor: C.inputBorder,
                        color: C.inputBorder,
                      },
                    ]}
                    value={roleLabels[r.key]}
                    onChangeText={(v) =>
                      setRoleLabels((prev) => ({ ...prev, [r.key]: v }))
                    }
                  />
                ) : (
                  <Text style={[styles.roleLabel, { color: C.text }]}>
                    {roleLabels[r.key]}
                  </Text>
                )}
              </View>
              {i < COLOR_ROLES.length - 1 && (
                <View
                  style={[styles.cardSep, { backgroundColor: C.cardSep }]}
                />
              )}
            </View>
          ))}
        </View>

        {/* Stats */}
        <Text style={[styles.sectionLabel, { color: C.sub }]}>Stats</Text>
        <View style={styles.statsRow}>
          {[
            { num: String(activityFeed.length), label: 'Activities' },
            { num: '259', label: 'Highlights' },
            { num: '7', label: 'Exports' },
            { num: '4', label: 'Weeks Active' },
          ].map((s, i) => (
            <View
              key={i}
              style={[styles.statCard, { backgroundColor: C.card }]}>
              <Text style={[styles.statNum, { color: C.text }]}>{s.num}</Text>
              <Text style={[styles.statLabel, { color: C.sub }]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Settings */}
        <Text style={[styles.sectionLabel, { color: C.sub }]}>Settings</Text>
        <View style={[styles.card, { backgroundColor: C.card }]}>
          {/* Notifications row */}
          <TouchableOpacity style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: C.text }]}>
              Notifications
            </Text>
            <Text style={[styles.settingArrow, { color: C.settingArrow }]}>
              ›
            </Text>
          </TouchableOpacity>

          <View style={[styles.cardSep, { backgroundColor: C.cardSep }]} />

          {/* Dark Mode toggle — FIXED */}
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: C.text }]}>
              Dark Mode
            </Text>
            <Switch
              value={darkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: '#E5E5EA', true: '#34C759' }}
              thumbColor="#fff"
              ios_backgroundColor="#E5E5EA"
            />
          </View>

          <View style={[styles.cardSep, { backgroundColor: C.cardSep }]} />

          {/* Export Defaults row */}
          <TouchableOpacity style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: C.text }]}>
              Export Defaults
            </Text>
            <Text style={[styles.settingArrow, { color: C.settingArrow }]}>
              ›
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: C.card }]}
          onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backArrow: { fontSize: 26, lineHeight: 30 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  editBtn: { fontSize: 17, color: '#007AFF', fontWeight: '600' },
  scroll: { paddingHorizontal: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 28 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 43 },
  changePhotoBtn: { marginTop: 4 },
  changePhotoText: { color: '#007AFF', fontSize: 16 },
  profileName: { fontSize: 22, fontWeight: '800' },
  profileEmail: { fontSize: 14, marginTop: 4 },
  profileStatus: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    borderRadius: 14,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldLabel: { fontSize: 15 },
  fieldValue: { fontSize: 15 },
  fieldInput: {
    fontSize: 15,
    borderBottomWidth: 1,
    minWidth: 160,
    textAlign: 'right',
  },
  cardSep: { height: 1, marginHorizontal: 16 },
  proBadge: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  proBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  roleDot: { width: 14, height: 14, borderRadius: 7 },
  roleLabel: { fontSize: 15 },
  roleInput: {
    flex: 1,
    fontSize: 15,
    borderBottomWidth: 1,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLabel: { fontSize: 15 },
  settingArrow: { fontSize: 20 },
  signOutBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  signOutText: { color: '#FF3B30', fontSize: 16, fontWeight: '700' },
});
