import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNotaTheme } from './theme';

const TABS = [
  { name: 'Home', icon: 'home', screen: 'Home' },
  { name: 'Docs', icon: 'docs', screen: 'Document' },
  { name: 'Profile', icon: 'profile', screen: 'Profile' },
];

function NavIcon({ type, active, styles }) {
  const iconStyle = active ? styles.iconActiveShape : styles.iconShape;

  if (type === 'home') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.homeRoofLeft, iconStyle]} />
        <View style={[styles.homeRoofRight, iconStyle]} />
        <View style={[styles.homeBody, iconStyle]} />
      </View>
    );
  }

  if (type === 'docs') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.docPage, iconStyle]}>
          <View style={[styles.docFold, iconStyle]} />
          <View style={[styles.docLine, iconStyle]} />
          <View style={[styles.docLineShort, iconStyle]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.iconBox}>
      <View style={[styles.profileHead, iconStyle]} />
      <View style={[styles.profileBody, iconStyle]} />
    </View>
  );
}

export default function BottomNav({ navigation, active = 'Home' }) {
  const { theme } = useNotaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = active === tab.screen;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.screen)}
          >
            <NavIcon type={tab.icon} active={isActive} styles={styles} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    bar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingVertical: 8,
      paddingBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: theme.darkMode ? 0.18 : 0.06,
      shadowRadius: 12,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
    iconBox: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconShape: {
      borderColor: theme.faint,
      backgroundColor: theme.faint,
    },
    iconActiveShape: {
      borderColor: theme.text,
      backgroundColor: theme.text,
    },
    homeRoofLeft: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: 11,
      height: 2,
      borderRadius: 1,
      transform: [{ rotate: '-38deg' }],
    },
    homeRoofRight: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 11,
      height: 2,
      borderRadius: 1,
      transform: [{ rotate: '38deg' }],
    },
    homeBody: {
      position: 'absolute',
      top: 11,
      width: 14,
      height: 9,
      borderWidth: 2,
      borderTopWidth: 0,
      borderRadius: 2,
      backgroundColor: 'transparent',
    },
    docPage: {
      width: 15,
      height: 18,
      borderWidth: 2,
      borderRadius: 3,
      backgroundColor: 'transparent',
    },
    docFold: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 7,
      height: 7,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      borderTopWidth: 0,
      borderRightWidth: 0,
      borderRadius: 1,
      backgroundColor: 'transparent',
    },
    docLine: {
      position: 'absolute',
      left: 3,
      bottom: 6,
      width: 7,
      height: 2,
      borderRadius: 1,
    },
    docLineShort: {
      position: 'absolute',
      left: 3,
      bottom: 3,
      width: 5,
      height: 2,
      borderRadius: 1,
    },
    profileHead: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginBottom: 2,
    },
    profileBody: {
      width: 15,
      height: 7,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    label: { fontSize: 10, color: theme.faint, marginTop: 3 },
    labelActive: { color: theme.text, fontWeight: '700' },
  });
}
