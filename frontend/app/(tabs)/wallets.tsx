import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useTheme } from "@/src/theme/ThemeContext";
import { ThemeColors } from "@/src/theme/colors";
import { AppHeader, Card, Chip, EmptyState } from "@/src/components/ui";
import { api, WalletLoad } from "@/src/lib/api";
import { formatINR, formatDate, walletTypeLabel, statusLabel, formatDayLabel } from "@/src/lib/format";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STATUS_COLOR: Record<string, "income" | "walletLoad" | "expense"> = {
  fully_allocated: "income",
  partially_allocated: "walletLoad",
  unresolved: "expense",
};

export default function WalletsScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const [loads, setLoads] = useState<WalletLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [walletType, setWalletType] = useState("upi_lite");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getWalletLoads();
      setLoads(data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(expanded === id ? null : id);
  };

  const createLoad = async () => {
    const amt = parseFloat(amount.replace(/,/g, ""));
    if (!amt || amt <= 0) {
      Alert.alert("Enter amount", "Please enter a valid load amount.");
      return;
    }
    setCreating(true);
    try {
      await api.createWalletLoad(amt, walletType);
      setModalOpen(false);
      setAmount("");
      setWalletType("upi_lite");
      load();
    } catch (e: any) {
      Alert.alert("Could not add", e.message || "Try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <AppHeader
        title="Wallets"
        subtitle="UPI Lite & Paytm loads"
        right={
          <TouchableOpacity testID="add-wallet-load-btn" style={s.addBtn} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={22} color={colors.white} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
        >
          {loads.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="No wallet loads yet"
              subtitle="When you load money into UPI Lite or Paytm, it appears here. Tap + to add one, or import a wallet-load SMS."
            />
          ) : (
            loads.map((w) => {
              const isOpen = expanded === w.id;
              const pct = w.amount > 0 ? Math.min((w.allocated / w.amount) * 100, 100) : 0;
              const statusKey = STATUS_COLOR[w.status] || "expense";
              return (
                <Card key={w.id} style={{ marginBottom: 14 }} testID={`wallet-load-${w.id}`}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => toggle(w.id)}>
                    <View style={s.loadHeader}>
                      <View style={[s.loadIcon, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="wallet" size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.loadType}>{walletTypeLabel(w.walletType)}</Text>
                        <Text style={s.loadDate}>{formatDate(w.date)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={s.loadAmount}>{formatINR(w.amount)}</Text>
                        <View style={[s.statusBadge, { backgroundColor: colors[statusKey] + "22" }]}>
                          <Text style={[s.statusText, { color: colors[statusKey] }]}>{statusLabel(w.status)}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={s.progressRow}>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: colors[statusKey] }]} />
                      </View>
                    </View>
                    <View style={s.allocRow}>
                      <Text style={s.allocLabel}>Spent {formatINR(w.allocated)}</Text>
                      <Text style={s.allocLabel}>Remaining {formatINR(w.remaining)}</Text>
                    </View>

                    <View style={s.expandRow}>
                      <Text style={s.expandText}>
                        {w.linkedExpenses.length} linked expense{w.linkedExpenses.length !== 1 ? "s" : ""}
                      </Text>
                      <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                    </View>
                  </TouchableOpacity>

                  {isOpen ? (
                    <View style={s.linkedList}>
                      {w.linkedExpenses.length === 0 ? (
                        <Text style={s.noLinked}>No expenses linked yet. Add an expense with this wallet as payment.</Text>
                      ) : (
                        w.linkedExpenses.map((e) => (
                          <View key={e.id} style={s.linkedRow}>
                            <View style={s.dot} />
                            <Text style={s.linkedDesc} numberOfLines={1}>
                              {e.description || e.merchant || "Expense"}
                            </Text>
                            <Text style={s.linkedDate}>{formatDayLabel(e.date)}</Text>
                            <Text style={s.linkedAmount}>{formatINR(e.amount)}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add load modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
            <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled">
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Add wallet load</Text>
              <Text style={s.modalLabel}>Amount</Text>
              <TextInput
                testID="wallet-load-amount-input"
                value={amount}
                onChangeText={setAmount}
                placeholder="500"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                style={s.modalInput}
              />
              <Text style={s.modalLabel}>Wallet type</Text>
              <View style={{ flexDirection: "row" }}>
                <Chip label="UPI Lite" active={walletType === "upi_lite"} onPress={() => setWalletType("upi_lite")} testID="wt-upi-lite" />
                <Chip label="Paytm Wallet" active={walletType === "paytm"} onPress={() => setWalletType("paytm")} testID="wt-paytm" />
              </View>
              <TouchableOpacity testID="confirm-wallet-load-btn" style={s.modalBtn} onPress={createLoad} disabled={creating} activeOpacity={0.85}>
                {creating ? <ActivityIndicator color={colors.white} /> : <Text style={s.modalBtnText}>Add Load</Text>}
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    addBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
    loadHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    loadIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    loadType: { fontSize: 16, fontWeight: "700", color: c.textPrimary },
    loadDate: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    loadAmount: { fontSize: 18, fontWeight: "800", color: c.textPrimary },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
    statusText: { fontSize: 11, fontWeight: "700" },
    progressRow: { marginTop: 14 },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: c.surfaceElevated, overflow: "hidden" },
    progressFill: { height: 8, borderRadius: 4 },
    allocRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    allocLabel: { fontSize: 13, color: c.textSecondary, fontWeight: "500" },
    expandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
    expandText: { fontSize: 13, color: c.primary, fontWeight: "600" },
    linkedList: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 12 },
    noLinked: { fontSize: 13, color: c.textSecondary, fontStyle: "italic" },
    linkedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary },
    linkedDesc: { flex: 1, fontSize: 14, color: c.textPrimary, fontWeight: "500" },
    linkedDate: { fontSize: 12, color: c.textSecondary },
    linkedAmount: { fontSize: 14, fontWeight: "700", color: c.textPrimary },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    modalSheet: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: "center", marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: "700", color: c.textPrimary, marginBottom: 16 },
    modalLabel: { fontSize: 12, fontWeight: "700", color: c.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
    modalInput: { backgroundColor: c.surfaceElevated, borderRadius: 12, padding: 14, fontSize: 18, fontWeight: "600", color: c.textPrimary },
    modalBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 24 },
    modalBtnText: { color: c.white, fontSize: 16, fontWeight: "700" },
  });
