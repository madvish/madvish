import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeContext";
import { ThemeColors } from "@/src/theme/colors";
import { AppHeader, Chip } from "@/src/components/ui";
import { api, Category } from "@/src/lib/api";
import { categoryIcon } from "@/src/lib/icons";
import { formatINR, paymentLabel } from "@/src/lib/format";
import { useVoiceInput } from "@/src/lib/voice";

const PAYMENT_METHODS = ["cash", "bank", "upi_lite", "paytm"];

function localAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, "");
  const m = cleaned.match(/(\d+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1]) : null;
}

export default function AddScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [rawText, setRawText] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [userPicked, setUserPicked] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onVoiceResult = useCallback((text: string) => {
    setRawText(text);
  }, []);
  const voice = useVoiceInput(onVoiceResult);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  // Debounced backend parse for description + category prediction.
  useEffect(() => {
    setAmount(localAmount(rawText));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!rawText.trim()) {
      setDescription("");
      if (!userPicked) setCategoryId(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.parse(rawText);
        if (r.amount != null) setAmount(r.amount);
        setDescription(r.description);
        if (!userPicked && r.categoryId) setCategoryId(r.categoryId);
      } catch {}
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawText, userPicked]);

  useEffect(() => {
    if (voice.error) {
      Alert.alert("Voice input", voice.error);
      voice.setError(null);
    }
  }, [voice.error]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const isWallet = paymentMethod === "upi_lite" || paymentMethod === "paytm";

  const handleSave = async () => {
    if (!amount || amount <= 0) {
      Alert.alert("Add an amount", "Type something like '120 chai and samosa' or just '450'.");
      return;
    }
    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await api.createExpense({
        amount,
        description: description || rawText.trim(),
        note,
        paymentMethod,
        categoryId: categoryId || undefined,
        source: "manual",
      });
      setRawText("");
      setAmount(null);
      setDescription("");
      setNote("");
      setPaymentMethod("cash");
      setCategoryId(null);
      setUserPicked(false);
      router.push("/(tabs)");
    } catch (e: any) {
      Alert.alert("Could not save", e.message || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <AppHeader title="Add Expense" subtitle="Type naturally — Flow does the rest" />

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
      >
        {/* Natural language input */}
        <View style={s.nlWrap}>
          <Text style={s.amountPreview} testID="amount-preview">
            {amount ? formatINR(amount) : "₹0"}
          </Text>
          <TextInput
            testID="nl-input"
            value={rawText}
            onChangeText={setRawText}
            placeholder="120 chai and samosa"
            placeholderTextColor={colors.textSecondary}
            style={s.nlInput}
            multiline
            autoFocus
          />
          {description ? (
            <Text style={s.descPreview} numberOfLines={1}>
              {description}
            </Text>
          ) : null}

          <TouchableOpacity
            testID="voice-input-btn"
            onPress={voice.listening ? voice.stop : voice.start}
            activeOpacity={0.85}
            style={[s.voiceBtn, { backgroundColor: voice.listening ? colors.expense : colors.primary }]}
          >
            <Ionicons name={voice.listening ? "stop" : "mic"} size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
        {voice.listening ? (
          <Text style={s.listeningText}>Listening… speak your expense</Text>
        ) : null}

        {/* Category chip */}
        <Text style={s.label}>Category</Text>
        <TouchableOpacity
          testID="category-chip"
          activeOpacity={0.8}
          onPress={() => setPickerOpen(true)}
          style={s.categoryChip}
        >
          <Ionicons
            name={categoryIcon(selectedCategory?.icon) as any}
            size={18}
            color={colors.primary}
          />
          <Text style={s.categoryChipText}>
            {selectedCategory ? selectedCategory.name : "Predicting…"}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Payment method */}
        <Text style={s.label}>Payment method</Text>
        <View style={s.row} testID="payment-method-scroll">
          {PAYMENT_METHODS.map((m) => (
            <Chip
              key={m}
              testID={`payment-${m}`}
              label={paymentLabel(m)}
              active={paymentMethod === m}
              onPress={() => setPaymentMethod(m)}
            />
          ))}
        </View>
        {isWallet ? (
          <Text style={s.walletHint}>
            <Ionicons name="information-circle" size={13} color={colors.walletLoad} /> Linked to your
            most recent {paymentLabel(paymentMethod)} load.
          </Text>
        ) : null}

        {/* Note */}
        <Text style={s.label}>Why? (optional)</Text>
        <TextInput
          testID="note-input"
          value={note}
          onChangeText={setNote}
          placeholder="treat for finishing project"
          placeholderTextColor={colors.textSecondary}
          style={s.noteInput}
        />
      </KeyboardAwareScrollView>

      {/* Sticky Save */}
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            testID="save-expense-btn"
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={saving}
            style={[s.saveBtn, { opacity: saving ? 0.7 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                <Text style={s.saveBtnText}>Save Expense</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>

      {/* Category picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Choose category</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  testID={`category-option-${c.id}`}
                  style={[s.catRow, categoryId === c.id && { backgroundColor: colors.primaryLight }]}
                  onPress={() => {
                    setCategoryId(c.id);
                    setUserPicked(true);
                    setPickerOpen(false);
                  }}
                >
                  <View style={[s.catIcon, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name={categoryIcon(c.icon) as any} size={20} color={colors.primary} />
                  </View>
                  <Text style={s.catName}>{c.name}</Text>
                  {categoryId === c.id ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    nlWrap: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    amountPreview: { fontSize: 40, fontWeight: "800", color: c.primary, letterSpacing: -1 },
    nlInput: {
      fontSize: 20,
      fontWeight: "600",
      color: c.textPrimary,
      marginTop: 8,
      minHeight: 32,
      padding: 0,
    },
    descPreview: { fontSize: 14, color: c.textSecondary, marginTop: 6 },
    voiceBtn: {
      position: "absolute",
      right: 16,
      bottom: 16,
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#4F46E5",
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    listeningText: { color: c.expense, fontWeight: "600", marginTop: 10, fontSize: 13 },
    label: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 24,
      marginBottom: 10,
    },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: c.primaryLight,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 24,
      gap: 8,
    },
    categoryChipText: { fontSize: 15, fontWeight: "700", color: c.primary },
    row: { flexDirection: "row", flexWrap: "wrap" },
    walletHint: { fontSize: 12, color: c.walletLoad, marginTop: 2 },
    noteInput: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 14,
      fontSize: 16,
      color: c.textPrimary,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      gap: 8,
    },
    saveBtnText: { color: c.white, fontSize: 16, fontWeight: "700" },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 36,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: "center",
      marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", color: c.textPrimary, marginBottom: 12 },
    catRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      gap: 12,
    },
    catIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    catName: { flex: 1, fontSize: 16, fontWeight: "600", color: c.textPrimary },
  });
