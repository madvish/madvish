import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";

import { useTheme } from "@/src/theme/ThemeContext";

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  return <Ionicons name={name as any} size={size} color={color} />;
}

function AddTabIcon() {
  const { colors } = useTheme();
  return (
    <View style={[styles.addBtn, { backgroundColor: colors.primary }]}>
      <Ionicons name="add" size={28} color={colors.white} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarButtonTestID: "dashboard-tab",
          tabBarIcon: ({ color, size }) => <TabIcon name="grid" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarButtonTestID: "add-expense-tab",
          tabBarIcon: () => <AddTabIcon />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="wallets"
        options={{
          title: "Wallets",
          tabBarButtonTestID: "wallets-tab",
          tabBarIcon: ({ color, size }) => <TabIcon name="wallet" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarButtonTestID: "reports-tab",
          tabBarIcon: ({ color, size }) => <TabIcon name="bar-chart" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
