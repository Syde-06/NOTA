import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppContext } from '../contexts/AppContext';

const TABS = [
  { name: 'Home', icon: '⌂', screen: 'Home' },
  { name: 'Docs', icon: '📄', screen: 'Document' },
  { name: 'Profile', icon: '◯', screen: 'Profile' },
];

export default function BottomNav({ navigation }) {
  const { darkMode } = useAppContext();
  const currentRoute =
    navigation.getState()?.routes[navigation.getState().index];
  const activeTab = currentRoute?.name || 'Home';

  const bg = darkMode ? '#2C2C2E' : '#fff';
  const border = darkMode ? '#3A3A3C' : '#E5E5EA';
  const activeColor = darkMode ? '#F5F5F7' : '#1C1C1E';
  const inactiveColor = darkMode ? '#636366' : '#C7C7CC';

  return (
    <View style={[styles.bar, { backgroundColor: bg, borderTopColor: border }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.screen)}>
            <Text
              style={[
                styles.icon,
                { color: isActive ? activeColor : inactiveColor },
              ]}>
              {tab.icon}
            </Text>
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? activeColor : inactiveColor,
                  fontWeight: isActive ? '700' : '400',
                },
              ]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  icon: { fontSize: 22 },
  label: { fontSize: 10, marginTop: 3 },
});
