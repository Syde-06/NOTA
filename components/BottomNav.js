import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

const TABS = [
  { name: "Home", icon: "⌂", screen: "Home" },
  { name: "Docs", icon: "📄", screen: "Document" },
  { name: "Profile", icon: "◯", screen: "Profile" },
];

export default function BottomNav({ navigation, active }) {
  const currentRoute = navigation.getState()?.routes[navigation.getState().index];
  const activeTab = currentRoute?.name || 'Home';

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.screen)}
          >
            <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

}

const styles = StyleSheet.create({
  bar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#E5E5EA",
    paddingVertical: 8, paddingBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 12,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 4 },
  icon: { fontSize: 22, color: "#C7C7CC" },
  iconActive: { color: "#1C1C1E" },
  label: { fontSize: 10, color: "#C7C7CC", marginTop: 3 },
  labelActive: { color: "#1C1C1E", fontWeight: "700" },
});