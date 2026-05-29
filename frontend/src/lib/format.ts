// Indian Rupee + date formatting helpers.

export function formatINR(value: number, withDecimals = false): string {
  const num = Number.isFinite(value) ? value : 0;
  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  });
  return `₹${formatted}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function monthName(monthIndex1: number): string {
  return MONTHS[monthIndex1 - 1] ?? "";
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function paymentLabel(method: string): string {
  switch (method) {
    case "upi_lite":
      return "UPI Lite";
    case "paytm":
      return "Paytm Wallet";
    case "bank":
      return "Bank";
    default:
      return "Cash";
  }
}

export function walletTypeLabel(t: string): string {
  return t === "upi_lite" ? "UPI Lite" : "Paytm Wallet";
}

export function statusLabel(s: string): string {
  switch (s) {
    case "fully_allocated":
      return "Fully allocated";
    case "partially_allocated":
      return "Partially allocated";
    default:
      return "Unresolved";
  }
}
