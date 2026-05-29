import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeContext";
import { ThemeColors } from "@/src/theme/colors";
import { AppHeader, Card, EmptyState, HeaderIconButton } from "@/src/components/ui";
import { api, Category, Expense } from "@/src/lib/api";
import { categoryIcon } from "@/src/lib/icons";
import { formatINR, formatDate } from "@/src/lib/format";

export default function ReviewScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<Expense[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.pendingReview(), api.getCategories()]);
      setItems(p);
      setCats(c);
      const init: Record<string, string> = {};
      p.forEach((e) => {
        if (e.categoryId) init[e.id] = e.categoryId;
      });
      setSelected(init);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirm = async (e: Expense) => {
    setBusy(e.id);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await api.updateExpense(e.id, {
        reviewed: true,
        categoryId: selected[e.id] || e.categoryId || undefined,
      });
      setItems((prev) => prev.filter((x) => x.id !== e.id));
    } catch {
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <AppHeader
        title="Review"
        subtitle="Categorize SMS expenses"
        left={<HeaderIconButton testID="back-btn" icon="chevron-back" onPress={() => router.back()} />}
      />
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon="checkmark-done-circle-outline" title="All caught up!" subtitle="No SMS expenses are waiting for review." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {items.map((e) => (
            <Card key={e.id} style={{ marginBottom: 14 }} testID={`review-item-${e.id}`}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.merchant}>{e.merchant || e.description || "SMS Transaction"}</Text>
                  <Text style={s.date}>{formatDate(e.date)}</Text>
                </View>
                <Text style={s.amount}>{formatINR(e.amount)}</Text>
              </View>

              <Text style={s.pickLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 2 }}>
                {cats.map((c) => {
                  const active = (selected[e.id] || e.categoryId) === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      testID={`review-cat-${e.id}-${c.id}`}
                      style={[s.catChip, active ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceElevated }]}
                      onPress={() => setSelected((p) => ({ ...p, [e.id]: c.id }))}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={categoryIcon(c.icon) as any} size={14} color={active ? colors.white : colors.textSecondary} />
                      <Text style={[s.catChipText, { color: active ? colors.white : colors.textSecondary }]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity testID={`confirm-sms-btn-${e.id}`} style={s.confirmBtn} onPress={() => confirm(e)} disabled={busy === e.id} activeOpacity={0.85}>
                {busy === e.id ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={colors.white} />
                    <Text style={s.confirmText}>Confirm</Text>
                  </>
                )}
              </TouchableOpacity>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    row: { flexDirection: "row", alignItems: "center" },
    merchant: { fontSize: 16, fontWeight: "700", color: c.textPrimary },
    date: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    amount: { fontSize: 18, fontWeight: "800", color: c.expense },
    pickLabel: { fontSize: 12, fontWeight: "700", color: c.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 10 },
    catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, marginRight: 8 },
    catChipText: { fontSize: 13, fontWeight: "600" },
    confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 12, marginTop: 16 },
    confirmText: { color: c.white, fontSize: 15, fontWeight: "700" },
  });
