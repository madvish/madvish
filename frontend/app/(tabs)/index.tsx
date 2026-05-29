import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { useTheme } from "@/src/theme/ThemeContext";
import { ThemeColors, CHART_PALETTE } from "@/src/theme/colors";
import { AppHeader, Card, EmptyState, HeaderIconButton, SectionTitle } from "@/src/components/ui";
import { DonutChart } from "@/src/components/DonutChart";
import { api, DashboardData, Expense } from "@/src/lib/api";
import { categoryIcon } from "@/src/lib/icons";
import { formatINR, monthName, formatDayLabel } from "@/src/lib/format";

export default function DashboardScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [pending, setPending] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api.dashboard(), api.pendingReview()]);
      setData(d);
      setPending(p.length);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load runs on the live instance (survives StrictMode remount on web).
  useEffect(() => {
    load();
  }, [load]);
  // Refresh whenever the tab regains focus (e.g. after adding an expense).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const smsTotal = data?.smsTotal ?? 0;
  const manualTotal = data?.manualTotal ?? 0;
  const splitTotal = smsTotal + manualTotal;
  const manualPct = splitTotal > 0 ? (manualTotal / splitTotal) * 100 : 0;

  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <AppHeader
        title="Flow"
        subtitle={data ? `${monthName(data.month)} ${data.year}` : ""}
        right={
          <HeaderIconButton testID="settings-btn" icon="settings-outline" onPress={() => router.push("/settings")} />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero total */}
        <View style={s.hero} testID="total-spent-card">
          <Text style={s.heroLabel}>Total spent this month</Text>
          <Text style={s.heroValue}>{formatINR(data?.total ?? 0)}</Text>
          <View style={s.heroStatsRow}>
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{formatINR(data?.dailyAverage ?? 0)}</Text>
              <Text style={s.heroStatLabel}>Daily avg</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{data?.count ?? 0}</Text>
              <Text style={s.heroStatLabel}>Transactions</Text>
            </View>
          </View>
        </View>

        {/* Pending review banner */}
        {pending > 0 ? (
          <TouchableOpacity
            testID="pending-review-banner"
            style={s.pendingBanner}
            activeOpacity={0.85}
            onPress={() => router.push("/review")}
          >
            <View style={s.pendingIcon}>
              <Ionicons name="notifications" size={18} color={colors.white} />
            </View>
            <Text style={s.pendingText}>
              {pending} SMS expense{pending > 1 ? "s" : ""} need review
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        {/* Quick actions */}
        <View style={s.quickRow}>
          <TouchableOpacity style={s.quickBtn} activeOpacity={0.85} onPress={() => router.push("/sms-import")} testID="import-sms-btn">
            <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.primary} />
            <Text style={s.quickBtnText}>Import SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} activeOpacity={0.85} onPress={() => router.push("/(tabs)/reports")} testID="view-reports-btn">
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <Text style={s.quickBtnText}>Reports</Text>
          </TouchableOpacity>
        </View>

        {data && data.breakdown.length > 0 ? (
          <>
            {/* Category breakdown donut */}
            <SectionTitle>Category breakdown</SectionTitle>
            <Card style={{ marginBottom: 24 }}>
              <View style={s.donutRow}>
                <DonutChart data={data.breakdown} size={150} strokeWidth={22} trackColor={colors.surfaceElevated}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={s.donutCenterLabel}>Total</Text>
                    <Text style={s.donutCenterValue}>{formatINR(data.total)}</Text>
                  </View>
                </DonutChart>
                <View style={s.legend}>
                  {data.breakdown.slice(0, 6).map((b, i) => (
                    <View key={b.categoryId} style={s.legendRow}>
                      <View style={[s.legendDot, { backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }]} />
                      <Text style={s.legendName} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <Text style={s.legendPct}>{b.percent}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            {/* Top 3 categories */}
            <SectionTitle>Top categories</SectionTitle>
            <Card style={{ marginBottom: 24 }}>
              {data.topCategories.map((b, i) => {
                const maxAmt = data.topCategories[0]?.amount || 1;
                return (
                  <View key={b.categoryId} style={{ marginBottom: i === data.topCategories.length - 1 ? 0 : 16 }}>
                    <View style={s.barHeader}>
                      <View style={s.barLeft}>
                        <Ionicons name={categoryIcon(b.icon) as any} size={16} color={colors.primary} />
                        <Text style={s.barName}>{b.name}</Text>
                      </View>
                      <Text style={s.barAmount}>{formatINR(b.amount)}</Text>
                    </View>
                    <View style={s.barTrack}>
                      <View
                        style={[
                          s.barFill,
                          {
                            width: `${(b.amount / maxAmt) * 100}%`,
                            backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length],
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>

            {/* SMS vs Manual split */}
            <SectionTitle>Auto vs Manual</SectionTitle>
            <Card style={{ marginBottom: 24 }}>
              <View style={s.splitBar}>
                <View style={[s.splitSegment, { flex: Math.max(manualPct, 1), backgroundColor: colors.primary, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]} />
                <View style={[s.splitSegment, { flex: Math.max(100 - manualPct, 1), backgroundColor: colors.walletLoad, borderTopRightRadius: 8, borderBottomRightRadius: 8 }]} />
              </View>
              <View style={s.splitLegend}>
                <View style={s.splitLegendItem}>
                  <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={s.splitLegendText}>Manual {formatINR(manualTotal)}</Text>
                </View>
                <View style={s.splitLegendItem}>
                  <View style={[s.legendDot, { backgroundColor: colors.walletLoad }]} />
                  <Text style={s.splitLegendText}>From SMS {formatINR(smsTotal)}</Text>
                </View>
              </View>
            </Card>

            {/* Recent */}
            <View style={s.recentHeader}>
              <SectionTitle>Recent</SectionTitle>
              <TouchableOpacity onPress={() => router.push("/(tabs)/reports")}>
                <Text style={s.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <Card>
              {data.recent.map((t, i) => (
                <TransactionRow key={t.id} t={t} colors={colors} last={i === data.recent.length - 1} />
              ))}
            </Card>
          </>
        ) : (
          <EmptyState
            icon="receipt-outline"
            title="No expenses yet"
            subtitle="Tap the + button to log your first expense. Type something like '120 chai and samosa'."
          />
        )}
      </ScrollView>
    </View>
  );
}

function TransactionRow({ t, colors, last }: { t: Expense; colors: ThemeColors; last: boolean }) {
  const s = makeStyles(colors);
  return (
    <View style={[s.txnRow, !last && s.txnBorder]}>
      <View style={[s.txnIcon, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name="card-outline" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.txnDesc} numberOfLines={1}>
          {t.description || t.merchant || "Expense"}
        </Text>
        <Text style={s.txnDate}>
          {formatDayLabel(t.date)}
          {t.source === "sms" ? " · SMS" : ""}
        </Text>
      </View>
      <Text style={s.txnAmount}>{formatINR(t.amount)}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { alignItems: "center", justifyContent: "center" },
    hero: {
      backgroundColor: c.primary,
      borderRadius: 24,
      padding: 24,
      marginBottom: 20,
      shadowColor: c.primary,
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    heroLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500" },
    heroValue: { color: "#fff", fontSize: 40, fontWeight: "800", marginTop: 6, letterSpacing: -1 },
    heroStatsRow: { flexDirection: "row", alignItems: "center", marginTop: 20 },
    heroStat: { flex: 1 },
    heroStatValue: { color: "#fff", fontSize: 18, fontWeight: "700" },
    heroStatLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
    heroDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.25)", marginHorizontal: 16 },
    pendingBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.primaryLight,
      borderRadius: 16,
      padding: 14,
      marginBottom: 20,
      gap: 12,
    },
    pendingIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    pendingText: { flex: 1, fontSize: 14, fontWeight: "600", color: c.primary },
    quickRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
    quickBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingVertical: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    quickBtnText: { fontSize: 14, fontWeight: "600", color: c.textPrimary },
    donutRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    donutCenterLabel: { fontSize: 11, color: c.textSecondary, fontWeight: "600" },
    donutCenterValue: { fontSize: 16, fontWeight: "800", color: c.textPrimary, marginTop: 2 },
    legend: { flex: 1 },
    legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    legendName: { flex: 1, fontSize: 13, color: c.textPrimary, fontWeight: "500" },
    legendPct: { fontSize: 13, color: c.textSecondary, fontWeight: "600" },
    barHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    barLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    barName: { fontSize: 14, fontWeight: "600", color: c.textPrimary },
    barAmount: { fontSize: 14, fontWeight: "700", color: c.textPrimary },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: c.surfaceElevated, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4 },
    splitBar: { flexDirection: "row", height: 16, marginBottom: 14 },
    splitSegment: { height: 16 },
    splitLegend: { flexDirection: "row", justifyContent: "space-between" },
    splitLegendItem: { flexDirection: "row", alignItems: "center" },
    splitLegendText: { fontSize: 13, color: c.textSecondary, fontWeight: "500" },
    recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    viewAll: { color: c.primary, fontWeight: "600", fontSize: 14, marginBottom: 12 },
    txnRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
    txnBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    txnIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    txnDesc: { fontSize: 15, fontWeight: "600", color: c.textPrimary },
    txnDate: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    txnAmount: { fontSize: 15, fontWeight: "700", color: c.textPrimary },
  });
