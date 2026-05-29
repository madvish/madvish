import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";
import { lightColors, darkColors, ThemeColors } from "./colors";

type Mode = "light" | "dark" | "system";

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "flow_theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(STORAGE_KEY, "system");
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
      setReady(true);
    })();
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    storage.setItem(STORAGE_KEY, m);
  }, []);

  const isDark = mode === "system" ? system === "dark" : mode === "dark";
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, mode, setMode, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
