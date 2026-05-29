import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeContext";
import { ThemeColors } from "@/src/theme/colors";

export function useStyles() {
  const { colors } = useTheme();
  return { colors, s: makeStyles(colors) };
}

export function AppHeader({
  title,
  subtitle,
  right,
  left,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
}) {
  const { colors, s } = useStyles();
  return (
    <View style={s.header}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        {left}
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{title}</Text>
          {subtitle ? <Text style={s.headerSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { s } = useStyles();
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: string;
  testID?: string;
}) {
  const { colors, s } = useStyles();
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.8}
      onPress={onPress}
      style={[s.chip, active ? s.chipActive : s.chipInactive]}
    >
      {icon ? (
        <Ionicons
          name={icon as any}
          size={15}
          color={active ? colors.white : colors.textSecondary}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={[s.chipText, { color: active ? colors.white : colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  const { colors, s } = useStyles();
  return (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon as any} size={32} color={colors.primary} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={s.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { s } = useStyles();
  return <Text style={s.sectionTitle}>{children}</Text>;
}

export function HeaderIconButton({
  icon,
  onPress,
  testID,
}: {
  icon: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, s } = useStyles();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={s.iconBtn} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={22} color={colors.textPrimary} />
    </TouchableOpacity>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    headerTitle: { fontSize: 28, fontWeight: "700", color: c.textPrimary, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOpacity: 0.03,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 24,
      marginRight: 8,
      marginBottom: 8,
    },
    chipActive: { backgroundColor: c.primary },
    chipInactive: { backgroundColor: c.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    chipText: { fontSize: 14, fontWeight: "600" },
    empty: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 32 },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: c.textPrimary, textAlign: "center" },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 20 },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: c.textPrimary, marginBottom: 12 },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
  });
