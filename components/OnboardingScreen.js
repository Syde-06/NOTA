import { useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../contexts/AppContext';
import { COLOR_ROLES } from './notaData';
import { useNotaTheme } from './theme';

export default function OnboardingScreen({ navigation }) {
  const { updatePreferences } = useAppContext();
  const { darkMode, theme } = useNotaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const finish = async () => {
    await updatePreferences({
      settings: { onboardingComplete: true },
      activityMessage: 'Completed Nota onboarding.',
    });
    navigation?.navigate('MainTabs');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>N</Text>
        </View>
        <Text style={styles.title}>Structure highlights as you read</Text>
        <Text style={styles.body}>
          Mark words by role, then Nota turns them into study notes, outlines, reviewer sheets, and flashcards.
        </Text>

        <View style={styles.card}>
          {COLOR_ROLES.map((role) => (
            <View key={role.id} style={styles.roleRow}>
              <View style={[styles.roleDot, { backgroundColor: role.color }]} />
              <View style={styles.roleCopy}>
                <Text style={styles.roleTitle}>{role.label}</Text>
                <Text style={styles.roleSub}>{getRoleHint(role.id)}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={finish}>
          <Text style={styles.primaryText}>Start Annotating</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function getRoleHint(roleId) {
  if (roleId === 'title') return 'Section names and major concepts';
  if (roleId === 'definition') return 'Meaning, explanation, or key claim';
  if (roleId === 'list') return 'Steps, parts, causes, or grouped ideas';
  if (roleId === 'example') return 'Cases, applications, and worked examples';
  return 'Condensed takeaways and review notes';
}

function createStyles(theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
    logo: {
      width: 70,
      height: 70,
      borderRadius: 20,
      backgroundColor: theme.button,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 22,
    },
    logoText: { color: theme.buttonText, fontSize: 36, fontWeight: '900' },
    title: { color: theme.text, fontSize: 30, lineHeight: 36, fontWeight: '900', marginBottom: 12 },
    body: { color: theme.subtext, fontSize: 16, lineHeight: 24, marginBottom: 24 },
    card: { backgroundColor: theme.card, borderRadius: 18, padding: 16, gap: 14, marginBottom: 24 },
    roleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    roleDot: { width: 16, height: 16, borderRadius: 8 },
    roleCopy: { flex: 1 },
    roleTitle: { color: theme.text, fontSize: 15, fontWeight: '900' },
    roleSub: { color: theme.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
    primaryButton: {
      backgroundColor: theme.button,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    primaryText: { color: theme.buttonText, fontWeight: '900', fontSize: 16 },
  });
}
