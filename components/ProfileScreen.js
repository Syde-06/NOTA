import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLOR_ROLES, ROLE_PRESETS } from './notaData';
import { useAppContext } from '../contexts/AppContext';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

const EXPORT_FORMATS = ['markdown', 'json', 'csv'];
const EXPORT_TEMPLATES = ['study-notes', 'reviewer', 'outline', 'flashcards'];

function getInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NU';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function formatSettingValue(value) {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (value === 'markdown') return 'Markdown';
  if (value === 'study-notes') return 'Study Notes';
  if (value === 'flashcards') return 'Flashcards';
  const preset = ROLE_PRESETS.find((item) => item.id === value);
  if (preset) return preset.label;
  return String(value || '').toUpperCase();
}

export default function ProfileScreen({ navigation }) {
  const {
    profile,
    statusMessage,
    activityFeed,
    authLoading,
    documents,
    highlightsByDoc,
    preferences,
    session,
    updateProfile,
    updatePreferences,
    logout,
  } = useAppContext();
  const [name, setName] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [roleLabels, setRoleLabels] = useState({});
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const darkMode = Boolean(preferences.settings.darkMode);
  const styles = useMemo(() => createStyles(darkMode), [darkMode]);

  useEffect(() => {
    setName(profile?.full_name || '');
    setStatusDraft(statusMessage || '');
    setAvatarUrl(profile?.avatar_url || null);
    setRoleLabels(preferences.roleLabels);
  }, [profile, preferences.roleLabels, statusMessage]);

  const stats = useMemo(() => {
    const highlightCount = Object.values(highlightsByDoc || {}).reduce(
      (sum, item) => sum + Object.keys(item || {}).length,
      0
    );
    const exportCount = activityFeed.filter((item) => item.message?.toLowerCase().includes('export')).length;
    const firstActivity = activityFeed[activityFeed.length - 1]?.createdAt;
    const daysActive = firstActivity
      ? Math.max(1, Math.ceil((Date.now() - new Date(firstActivity).getTime()) / 86400000))
      : 0;

    return [
      { num: String(documents.length), label: 'Docs' },
      { num: String(highlightCount), label: 'Highlights' },
      { num: String(exportCount), label: 'Exports' },
      { num: String(daysActive), label: 'Days Active' },
    ];
  }, [activityFeed, documents.length, highlightsByDoc]);

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await updateProfile({
        fullName: name,
        status: statusDraft,
        avatarUrl,
      });
      if (error) throw error;

      await updatePreferences({
        roleLabels,
        activityMessage: 'Updated profile preferences.',
      });
      setEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
      console.log('saveProfile error:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = async (key) => {
    const currentSettings = preferences.settings;
    if (key === 'defaultExportFormat') {
      const currentIndex = EXPORT_FORMATS.indexOf(currentSettings.defaultExportFormat);
      const nextFormat = EXPORT_FORMATS[(currentIndex + 1) % EXPORT_FORMATS.length];
      await updatePreferences({
        settings: { defaultExportFormat: nextFormat },
        activityMessage: `Changed default export format to ${formatSettingValue(nextFormat)}.`,
      });
      return;
    }

    if (key === 'defaultExportTemplate') {
      const currentIndex = EXPORT_TEMPLATES.indexOf(currentSettings.defaultExportTemplate);
      const nextTemplate = EXPORT_TEMPLATES[(currentIndex + 1) % EXPORT_TEMPLATES.length];
      await updatePreferences({
        settings: { defaultExportTemplate: nextTemplate },
        activityMessage: `Changed default export template to ${formatSettingValue(nextTemplate)}.`,
      });
      return;
    }

    if (key === 'rolePreset') {
      const currentIndex = ROLE_PRESETS.findIndex((preset) => preset.id === currentSettings.rolePreset);
      const nextPreset = ROLE_PRESETS[(currentIndex + 1) % ROLE_PRESETS.length] || ROLE_PRESETS[0];
      setRoleLabels(nextPreset.labels);
      await updatePreferences({
        roleLabels: nextPreset.labels,
        settings: { rolePreset: nextPreset.id },
        activityMessage: `Changed role preset to ${nextPreset.label}.`,
      });
      return;
    }

    await updatePreferences({
      settings: { [key]: !currentSettings[key] },
      activityMessage: `Turned ${key === 'darkMode' ? 'dark mode' : 'notifications'} ${
        currentSettings[key] ? 'off' : 'on'
      }.`,
    });
  };

  const changePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Needed', 'Allow photo access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });

    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;

    let nextAvatarUrl = uri;
    if (session?.access_token && session?.user?.id) {
      try {
        const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
        const fileName = `${session.user.id}/avatar-${Date.now()}.${extension}`;
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': result.assets?.[0]?.mimeType || 'image/jpeg',
            'x-upsert': 'true',
          },
          body: await fetch(uri).then((res) => res.blob()),
        });

        if (uploadRes.ok) {
          nextAvatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
        }
      } catch (error) {
        console.log('avatar upload failed:', error);
      }
    }

    setAvatarUrl(nextAvatarUrl);
    await updateProfile({
      fullName: name || profile?.full_name || 'Nota User',
      status: statusDraft || statusMessage,
      avatarUrl: nextAvatarUrl,
    });
  };

  const resetRoles = async () => {
    const defaults = Object.fromEntries(COLOR_ROLES.map((role) => [role.id, role.label]));
    setRoleLabels(defaults);
    await updatePreferences({
      roleLabels: defaults,
      activityMessage: 'Reset color role labels.',
    });
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Sign out of Nota?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={darkMode ? '#F5F5F7' : '#1C1C1E'} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={darkMode ? '#0B0B0C' : '#F5F5F7'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={editing ? saveProfile : () => setEditing(true)} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.editBtn}>{editing ? 'Done' : 'Edit'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitials(name)}</Text>
            )}
          </View>
          {editing && (
            <TouchableOpacity style={styles.changePhotoBtn} onPress={changePhoto}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.profileName}>{name || 'Nota User'}</Text>
          <Text style={styles.profileEmail}>{profile?.email || 'No email available'}</Text>
          <Text style={styles.profileStatus}>{statusDraft || 'Ready to annotate smarter.'}</Text>
        </View>

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
              <Text style={styles.fieldValue}>{name || 'Nota User'}</Text>
            )}
          </View>
          <View style={styles.cardSep} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{profile?.email || 'No email available'}</Text>
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
              <Text style={styles.fieldValue}>{statusDraft || 'Ready to annotate smarter.'}</Text>
            )}
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Color Roles</Text>
          {editing && (
            <TouchableOpacity onPress={resetRoles}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingRow} onPress={() => toggleSetting('rolePreset')}>
            <Text style={styles.settingLabel}>Preset</Text>
            <View style={styles.settingValueWrap}>
              <Text style={styles.settingValue}>{formatSettingValue(preferences.settings.rolePreset)}</Text>
              <Text style={styles.settingArrow}>{'>'}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.cardSep} />
          {COLOR_ROLES.map((role, index) => (
            <View key={role.id}>
              <View style={styles.roleRow}>
                <View style={[styles.roleDot, { backgroundColor: role.color }]} />
                {editing ? (
                  <TextInput
                    style={styles.roleInput}
                    value={roleLabels[role.id]}
                    onChangeText={(value) => setRoleLabels((current) => ({ ...current, [role.id]: value }))}
                    placeholder={role.label}
                  />
                ) : (
                  <Text style={styles.roleLabel}>{roleLabels[role.id] || role.label}</Text>
                )}
              </View>
              {index < COLOR_ROLES.length - 1 && <View style={styles.cardSep} />}
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Stats</Text>
        <View style={styles.statsRow}>
          {stats.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <Text style={styles.statNum}>{item.num}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Settings</Text>
        <View style={styles.card}>
          {[
            { key: 'notifications', label: 'Notifications', value: preferences.settings.notifications },
            { key: 'darkMode', label: 'Dark Mode', value: preferences.settings.darkMode },
            { key: 'defaultExportFormat', label: 'Export Default', value: preferences.settings.defaultExportFormat },
            { key: 'defaultExportTemplate', label: 'Export Template', value: preferences.settings.defaultExportTemplate },
          ].map((item, index, arr) => (
            <View key={item.key}>
              <TouchableOpacity style={styles.settingRow} onPress={() => toggleSetting(item.key)}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <View style={styles.settingValueWrap}>
                  <Text style={styles.settingValue}>{formatSettingValue(item.value)}</Text>
                  <Text style={styles.settingArrow}>{'>'}</Text>
                </View>
              </TouchableOpacity>
              {index < arr.length - 1 && <View style={styles.cardSep} />}
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Extraction</Text>
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>OCR Fallback</Text>
            <Text style={styles.fieldValue}>Edge Secret</Text>
          </View>
          <View style={styles.cardSep} />
          <View style={styles.emptyActivity}>
            <Text style={styles.activityMeta}>
              Scanned PDFs use OCR when the extract-pdf-text function has OCR_SPACE_API_KEY configured.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Recent Activity</Text>
        <View style={styles.card}>
          {activityFeed.length ? (
            activityFeed.slice(0, 5).map((item, index, arr) => (
              <View key={item.id}>
                <View style={styles.activityRow}>
                  <View style={styles.activityDot} />
                  <View style={styles.activityBody}>
                    <Text style={styles.activityText}>{item.message}</Text>
                    <Text style={styles.activityMeta}>{new Date(item.createdAt).toLocaleString()}</Text>
                  </View>
                </View>
                {index < arr.length - 1 && <View style={styles.cardSep} />}
              </View>
            ))
          ) : (
            <View style={styles.emptyActivity}>
              <Text style={styles.fieldValue}>No activity yet</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(darkMode) {
  const theme = {
    background: darkMode ? '#0B0B0C' : '#F5F5F7',
    card: darkMode ? '#1C1C1E' : '#fff',
    text: darkMode ? '#F5F5F7' : '#1C1C1E',
    muted: darkMode ? '#A9A9B0' : '#8E8E93',
    subtext: darkMode ? '#D1D1D6' : '#3A3A40',
    border: darkMode ? '#2C2C2E' : '#F2F2F7',
    avatarBg: darkMode ? '#F5F5F7' : '#1C1C1E',
    avatarText: darkMode ? '#0B0B0C' : '#fff',
  };

  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backArrow: { fontSize: 18, color: '#007AFF', lineHeight: 30, fontWeight: '900' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: theme.text },
  editBtn: { fontSize: 17, color: '#007AFF', fontWeight: '800' },
  scroll: { paddingHorizontal: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: 26 },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: theme.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarImage: { width: 86, height: 86, borderRadius: 43 },
  avatarText: { color: theme.avatarText, fontWeight: '900', fontSize: 28 },
  changePhotoBtn: { marginBottom: 10 },
  changePhotoText: { color: '#007AFF', fontSize: 15, fontWeight: '800' },
  profileName: { fontSize: 22, fontWeight: '900', color: theme.text },
  profileEmail: { fontSize: 14, color: theme.muted, marginTop: 4 },
  profileStatus: { fontSize: 14, color: theme.subtext, marginTop: 8, textAlign: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.muted,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  resetText: { color: '#007AFF', fontWeight: '800', marginBottom: 10 },
  card: { backgroundColor: theme.card, borderRadius: 14, marginBottom: 24 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  fieldLabel: { fontSize: 15, color: theme.text, fontWeight: '700' },
  fieldValue: { flex: 1, fontSize: 15, color: theme.muted, textAlign: 'right' },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: '#007AFF',
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
    textAlign: 'right',
  },
  cardSep: { height: 1, backgroundColor: theme.border, marginHorizontal: 16 },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  roleDot: { width: 14, height: 14, borderRadius: 7 },
  roleLabel: { fontSize: 15, color: theme.text, fontWeight: '700' },
  roleInput: {
    flex: 1,
    fontSize: 15,
    color: '#007AFF',
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: {
    flexGrow: 1,
    flexBasis: '22%',
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '900', color: theme.text },
  statLabel: { fontSize: 11, color: theme.muted, marginTop: 2, fontWeight: '700' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingLabel: { fontSize: 15, color: theme.text, fontWeight: '700' },
  settingValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingValue: { color: theme.muted, fontSize: 13, fontWeight: '900' },
  settingArrow: { fontSize: 16, color: '#C7C7CC', fontWeight: '900' },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  activityDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#007AFF', marginTop: 5 },
  activityBody: { flex: 1 },
  activityText: { color: theme.text, fontSize: 14, fontWeight: '800' },
  activityMeta: { color: theme.muted, fontSize: 12, marginTop: 4 },
  emptyActivity: { padding: 16 },
  signOutBtn: {
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  signOutText: { color: '#FF3B30', fontSize: 16, fontWeight: '900' },
  });
}
