import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "@/src/theme/ThemeContext";
import { ThemeColors, CHART_PALETTE } from "@/src/theme/colors";
import { AppHeader, Card, EmptyState } from "@/src/components/ui";
import { DonutChart } from "@/src/components/DonutChart";
import { api, ReportData, Category } from "@/src/lib/api";
import { categoryIcon } from "@/src/lib/icons";
import { formatINR, monthName, formatDate, formatDayLabel } from "@/src/lib/format";
import { buildCsv, shareCsv } from "@/src/lib/csv";

type Period = "monthly" | "yearly" | "custom";

export default function ReportsScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const now = new Date();
  const [period, setPeriod] = useState<Period>("monthly");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [endDate, setEndDate] = useState(now);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const [data, setData] = useState<ReportData | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.getCategories().then(setCats).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let params: any = { period };
      if (period === "monthly") params = { period, year, month };
      else if (period === "yearly") params = { period, year };
      else
        params = {
          period,
          start: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0).getTime(),
          end: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).getTime(),
        };
      const r = await api.reports(params);
      setData(r);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [period, year, month, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const catName = (id?: string | null) => cats.find((c) => c.id === id)?.name || "Uncategorized";

  const onExport = async () => {
    if (!data || data.transactions.length === 0) {
      Alert.alert("Nothing to export", "There are no transactions in this period.");
      return;
    }
    setExporting(true);
    try {
      const headers = ["Date", "Description", "Category", "Amount (INR)", "Payment", "Source"];
      const rows = data.transactions.map((t) => [
        formatDate(t.date),
        t.description || t.merchant || "Expense",
        catName(t.categoryId),
        t.amount,
        t.paymentMethod,
        t.source,
      ]);
      const csv = buildCsv(headers, rows);
      const label = period === "monthly" ? `${monthName(month)}-${year}` : period === "yearly" ? `${year}` : "custom";
      await shareCsv(`flow-report-${label}.csv`, csv);
    } catch (e: any) {
      Alert.alert("Export failed", e.message || "Try again.");
    } finally {
      setExporting(false);
    }
  };

  const shiftMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <AppHeader
        title="Reports"
        right={
          <TouchableOpacity testID="export-csv-btn" style={s.exportBtn} onPress={onExport} disabled={exporting} activeOpacity={0.85}>
            {exporting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="share-outline" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        }
      />

      {/* Tabs */}
      <View style={s.tabs} testID="report-tabs">
        {(["monthly", "yearly", "custom"] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            testID={`tab-${p}`}
            style={[s.tab, period === p && s.tabActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, { color: period === p ? colors.white : colors.textSecondary }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period selectors */}
      <View style={s.selectorRow}>
        {period === "monthly" ? (
          <View style={s.navRow}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={s.navBtn} testID="prev-month">
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.navLabel}>{monthName(month)} {year}</Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={s.navBtn} testID="next-month">
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        ) : period === "yearly" ? (
          <View style={s.navRow}>
            <TouchableOpacity onPress={() => setYear(year - 1)} style={s.navBtn} testID="prev-year">
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.navLabel}>{year}</Text>
            <TouchableOpacity onPress={() => setYear(year + 1)} style={s.navBtn} testID="next-year">
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.dateRow}>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowStart(true)} testID="start-date-btn">
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={s.dateBtnText}>{formatDate(startDate.getTime())}</Text>
            </TouchableOpacity>
            <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowEnd(true)} testID="end-date-btn">
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={s.dateBtnText}>{formatDate(endDate.getTime())}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showStart && (
        <DateTimePicker
          value={startDate}
          mode="date"
          onChange={(_, d) => {
            setShowStart(Platform.OS === "ios");
            if (d) setStartDate(d);
          }}
        />
      )}
      {showEnd && (
        <DateTimePicker
          value={endDate}
          mode="date"
          onChange={(_, d) => {
            setShowEnd(Platform.OS === "ios");
            if (d) setEndDate(d);
          }}
        />
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Card style={{ marginBottom: 20, alignItems: "center" }} testID="report-total-card">
            <Text style={s.totalLabel}>Total spent</Text>
            <Text style={s.totalValue}>{formatINR(data?.total ?? 0)}</Text>
            <Text style={s.totalCount}>{data?.count ?? 0} transactions</Text>
          </Card>

          {data && data.breakdown.length > 0 ? (
            <>
              <Card style={{ marginBottom: 20 }}>
                <View style={{ alignItems: "center", marginBottom: 12 }}>
                  <DonutChart data={data.breakdown} size={160} strokeWidth={24} trackColor={colors.surfaceElevated}>
                    <Text style={s.donutCount}>{data.breakdown.length}</Text>
                    <Text style={s.donutCountLabel}>categories</Text>
                  </DonutChart>
                </View>
                {data.breakdown.map((b, i) => (
                  <View key={b.categoryId} style={[s.catRow, i === data.breakdown.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[s.legendDot, { backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }]} />
                    <Ionicons name={categoryIcon(b.icon) as any} size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                    <Text style={s.catName}>{b.name}</Text>
                    <Text style={s.catPct}>{b.percent}%</Text>
                    <Text style={s.catAmount}>{formatINR(b.amount)}</Text>
                  </View>
                ))}
              </Card>

              <Text style={s.txnTitle}>Transactions</Text>
              <Card>
                {data.transactions.map((t, i) => (
                  <View key={t.id} style={[s.txnRow, i === data.transactions.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[s.txnIcon, { backgroundColor: colors.surfaceElevated }]}>
                      <Ionicons name={categoryIcon(cats.find((c) => c.id === t.categoryId)?.icon) as any} size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.txnDesc} numberOfLines={1}>{t.description || t.merchant || "Expense"}</Text>
                      <Text style={s.txnDate}>{formatDayLabel(t.date)}{t.source === "sms" ? " · SMS" : ""}</Text>
                    </View>
                    <Text style={s.txnAmount}>{formatINR(t.amount)}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : (
            <EmptyState icon="bar-chart-outline" title="No data for this period" subtitle="Try a different month or range, or add some expenses." />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    exportBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.primaryLight, alignItems: "center", justifyContent: "center" },
    tabs: { flexDirection: "row", backgroundColor: c.surfaceElevated, borderRadius: 14, padding: 4, marginHorizontal: 20 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
    tabActive: { backgroundColor: c.primary },
    tabText: { fontSize: 14, fontWeight: "700" },
    selectorRow: { paddingHorizontal: 20, paddingVertical: 16 },
    navRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 },
    navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    navLabel: { fontSize: 16, fontWeight: "700", color: c.textPrimary, minWidth: 140, textAlign: "center" },
    dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
    dateBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surface, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    dateBtnText: { fontSize: 14, fontWeight: "600", color: c.textPrimary },
    totalLabel: { fontSize: 14, color: c.textSecondary, fontWeight: "500" },
    totalValue: { fontSize: 36, fontWeight: "800", color: c.textPrimary, marginTop: 4, letterSpacing: -1 },
    totalCount: { fontSize: 13, color: c.textSecondary, marginTop: 4 },
    donutCount: { fontSize: 22, fontWeight: "800", color: c.textPrimary },
    donutCountLabel: { fontSize: 11, color: c.textSecondary },
    catRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    catName: { flex: 1, fontSize: 14, fontWeight: "600", color: c.textPrimary },
    catPct: { fontSize: 13, color: c.textSecondary, fontWeight: "600", marginRight: 12, width: 44, textAlign: "right" },
    catAmount: { fontSize: 14, fontWeight: "700", color: c.textPrimary, width: 80, textAlign: "right" },
    txnTitle: { fontSize: 18, fontWeight: "700", color: c.textPrimary, marginBottom: 12 },
    txnRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    txnIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    txnDesc: { fontSize: 15, fontWeight: "600", color: c.textPrimary },
    txnDate: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    txnAmount: { fontSize: 15, fontWeight: "700", color: c.textPrimary },
  });
