import { Platform } from "react-native";
import * as Sharing from "expo-sharing";

export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const str = String(v ?? "");
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const lines = [headers.map(esc).join(",")];
  for (const row of rows) lines.push(row.map(esc).join(","));
  return lines.join("\n");
}

export async function shareCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // Native: write to cache then open the OS share sheet.
  const { File, Paths } = await import("expo-file-system");
  const file = new File(Paths.cache, filename);
  try {
    if (file.exists) file.delete();
  } catch {}
  file.create();
  file.write(csv);

  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      dialogTitle: "Export Flow report",
      UTI: "public.comma-separated-values-text",
    });
  }
}
