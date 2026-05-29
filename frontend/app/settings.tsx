import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/theme/ThemeContext";
import { ThemeColors } from "@/src/theme/colors";
import { AppHeader, Card, HeaderIconButton } from "@/src/components/ui";

const MODES: { key: "system" | "light" | "dark"; label: string; icon: string }[] = [
  { key: "system", label: "System", icon: "phone-portrait-outline" },
  { key: "light", label: "Light", icon: "sunny-outline" },
  { key: "dark", label: "Dark", icon: "moon-outline" },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <AppHeader
        title="Settings"
        left={<HeaderIconButton testID="back-btn" icon="chevron-back" onPress={() => router.back()} />}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>Appearance</Text>
        <Card style={{ marginBottom: 24 }}>
          <View style={s.modeRow} testID="dark-mode-toggle">
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  testID={`theme-${m.key}`}
                  style={[s.modeBtn, active && { backgroundColor: colors.primary }]}
                  onPress={() => setMode(m.key)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={m.icon as any} size={20} color={active ? colors.white : colors.textSecondary} />
                  <Text style={[s.modeText, { color: active ? colors.white : colors.textSecondary }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Text style={s.sectionLabel}>About Flow</Text>
        <Card>
          <Row icon="cash-outline" label="Currency" value="Indian Rupee (₹)" colors={colors} />
          <Row icon="lock-closed-outline" label="Privacy" value="No login · offline-first" colors={colors} />
          <Row icon="sparkles-outline" label="Version" value="1.0.0" colors={colors} last />
        </Card>

        <View style={s.footer}>
          <Text style={s.footerText}>Flow — effortless expense tracking for India.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value, colors, last }: { icon: string; label: string; value: string; colors: ThemeColors; last?: boolean }) {
  const s = makeStyles(colors);
  return (
    <View style={[s.row, !last && s.rowBorder]}>
      <View style={[s.rowIcon, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name={icon as any} size={18} color={colors.primary} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: c.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
    modeRow: { flexDirection: "row", gap: 10 },
    modeBtn: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 16, borderRadius: 14, backgroundColor: c.surfaceElevated },
    modeText: { fontSize: 13, fontWeight: "700" },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: c.textPrimary },
    rowValue: { fontSize: 14, color: c.textSecondary },
    footer: { alignItems: "center", marginTop: 40 },
    footerText: { fontSize: 13, color: c.textSecondary },
  });
