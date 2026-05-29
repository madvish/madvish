// Maps backend category icon keys -> Ionicons names.
export const CATEGORY_ICON: Record<string, string> = {
  burger: "fast-food",
  cart: "cart",
  car: "car",
  bag: "bag-handle",
  film: "film",
  phone: "phone-portrait",
  bulb: "bulb",
  box: "cube",
};

export function categoryIcon(key?: string): string {
  if (!key) return "cube";
  return CATEGORY_ICON[key] ?? "cube";
}
