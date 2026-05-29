import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useTheme } from "@/src/theme/ThemeContext";
import { ThemeColors } from "@/src/theme/colors";
import { AppHeader, Card, HeaderIconButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { formatINR, walletTypeLabel } from "@/src/lib/format";

const SAMPLES = [
  "Rs.500.00 debited from a/c XX1234 on 15-06-26 for UPI Lite Load. Avl bal: Rs.3200.00",
  "Rs.299 debited at SWIGGY via UPI ref 4455667788 on 12-02-26. -SBI",
  "INR 1,250.00 spent at AMAZON on your HDFC card. Ref 9988776655",
];

export default function SmsImportScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [text, setText] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const doParse = async (t?: string) => {
    const input = (t ?? text).trim();
    if (!input) return;
    setParsing(true);
    try {
      const r = await api.parseSms(input);
      setPreview(r);
    } catch (e: any) {
      Alert.alert("Parse failed", e.message || "Try a different SMS.");
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!text.trim()) return;
    setImporting(true);
    try {
      const r = await api.ingestSms(text.trim());
      if (r.duplicate) {
        Alert.alert("Already imported", "This transaction was detected before (duplicate reference).");
      } else if (r.kind === "wallet_load") {
        Alert.alert("Wallet load added", `${formatINR(r.record.amount)} ${walletTypeLabel(r.record.walletType)} load recorded.`, [
          { text: "Done", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Expense logged", `${formatINR(r.record.amount)} added for review.`, [
          { text: "Review now", onPress: () => router.replace("/review") },
          { text: "Done", onPress: () => router.back() },
        ]);
      }
      setText("");
      setPreview(null);
    } catch (e: any) {
      Alert.alert("Could not import", e.message || "Make sure the SMS contains an amount.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <AppHeader
        title="Import SMS"
        subtitle="Paste a bank / UPI message"
        left={<HeaderIconButton testID="back-btn" icon="chevron-back" onPress={() => router.back()} />}
      />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} bottomOffset={20} showsVerticalScrollIndicator={false}>
        <TextInput
          testID="sms-input"
          value={text}
          onChangeText={(t) => {
            setText(t);
            setPreview(null);
          }}
          placeholder="Paste your transaction SMS here…"
          placeholderTextColor={colors.textSecondary}
          style={s.input}
          multiline
        />

        <View style={s.btnRow}>
          <TouchableOpacity testID="parse-sms-btn" style={s.parseBtn} onPress={() => doParse()} disabled={parsing || !text.trim()} activeOpacity={0.85}>
            {parsing ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={s.parseBtnText}>Preview</Text>}
          </TouchableOpacity>
        </View>

        {preview ? (
          <Card style={{ marginTop: 8 }} testID="sms-preview">
            <View style={s.previewHeader}>
              <View style={[s.kindBadge, { backgroundColor: preview.kind === "wallet_load" ? colors.walletLoad + "22" : colors.primaryLight }]}>
                <Ionicons name={preview.kind === "wallet_load" ? "wallet" : "card"} size={14} color={preview.kind === "wallet_load" ? colors.walletLoad : colors.primary} />
                <Text style={[s.kindText, { color: preview.kind === "wallet_load" ? colors.walletLoad : colors.primary }]}>
                  {preview.kind === "wallet_load" ? "Wallet Load" : "Expense"}
                </Text>
              </View>
              <Text style={s.previewAmount}>{preview.amount != null ? formatINR(preview.amount) : "—"}</Text>
            </View>
            <View style={s.previewRow}>
              <Text style={s.previewLabel}>Merchant</Text>
              <Text style={s.previewValue}>{preview.merchant || "—"}</Text>
            </View>
            {preview.walletType ? (
              <View style={s.previewRow}>
                <Text style={s.previewLabel}>Wallet</Text>
                <Text style={s.previewValue}>{walletTypeLabel(preview.walletType)}</Text>
              </View>
            ) : null}
            <View style={s.previewRow}>
              <Text style={s.previewLabel}>Reference</Text>
              <Text style={s.previewValue}>{preview.reference || "—"}</Text>
            </View>

            <TouchableOpacity testID="import-sms-confirm-btn" style={s.importBtn} onPress={doImport} disabled={importing} activeOpacity={0.85}>
              {importing ? <ActivityIndicator color={colors.white} /> : <Text style={s.importBtnText}>Import this transaction</Text>}
            </TouchableOpacity>
          </Card>
        ) : null}

        <Text style={s.samplesTitle}>Try a sample</Text>
        {SAMPLES.map((sample, i) => (
          <TouchableOpacity
            key={i}
            testID={`sample-sms-${i}`}
            style={s.sampleCard}
            onPress={() => {
              setText(sample);
              doParse(sample);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
            <Text style={s.sampleText}>{sample}</Text>
          </TouchableOpacity>
        ))}

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={s.noteText}>
            Automatic background SMS reading is enabled in the production Android build. In preview, paste messages here to test parsing.
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    input: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      fontSize: 15,
      color: c.textPrimary,
      minHeight: 110,
      textAlignVertical: "top",
    },
    btnRow: { marginTop: 12 },
    parseBtn: { backgroundColor: c.primaryLight, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    parseBtnText: { color: c.primary, fontSize: 15, fontWeight: "700" },
    previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    kindBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    kindText: { fontSize: 13, fontWeight: "700" },
    previewAmount: { fontSize: 22, fontWeight: "800", color: c.textPrimary },
    previewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    previewLabel: { fontSize: 14, color: c.textSecondary },
    previewValue: { fontSize: 14, fontWeight: "600", color: c.textPrimary, maxWidth: "60%", textAlign: "right" },
    importBtn: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 16 },
    importBtnText: { color: c.white, fontSize: 15, fontWeight: "700" },
    samplesTitle: { fontSize: 14, fontWeight: "700", color: c.textSecondary, marginTop: 28, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
    sampleCard: { flexDirection: "row", gap: 10, backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    sampleText: { flex: 1, fontSize: 13, color: c.textPrimary, lineHeight: 19 },
    note: { flexDirection: "row", gap: 8, marginTop: 16, paddingHorizontal: 4 },
    noteText: { flex: 1, fontSize: 12, color: c.textSecondary, lineHeight: 18 },
  });
