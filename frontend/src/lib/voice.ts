import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";

// Wrapper around expo-speech-recognition with graceful degradation.
// In Expo Go (no native module) start() throws -> we surface `unsupported`.
let Speech: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Speech = require("expo-speech-recognition");
} catch {
  Speech = null;
}

export interface VoiceState {
  listening: boolean;
  transcript: string;
  error: string | null;
}

export function useVoiceInput(onFinalResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subs = useRef<any[]>([]);

  useEffect(() => {
    if (!Speech?.ExpoSpeechRecognitionModule) return;
    const M = Speech.ExpoSpeechRecognitionModule;
    const addListener = M.addListener?.bind(M) || Speech.addSpeechRecognitionListener;

    try {
      const onResult = M.addListener("result", (e: any) => {
        const t = e?.results?.[0]?.transcript ?? "";
        if (e?.isFinal && t) {
          onFinalResult(t);
        }
      });
      const onEnd = M.addListener("end", () => setListening(false));
      const onErr = M.addListener("error", (e: any) => {
        setError(e?.message || "Voice recognition error");
        setListening(false);
      });
      subs.current = [onResult, onEnd, onErr];
    } catch (e: any) {
      // listeners unavailable
    }

    return () => {
      subs.current.forEach((s) => s?.remove?.());
      subs.current = [];
    };
  }, [onFinalResult]);

  const start = useCallback(async () => {
    setError(null);
    const M = Speech?.ExpoSpeechRecognitionModule;
    if (!M) {
      setError("Voice input needs a development build. It is unavailable in Expo Go / web preview.");
      return;
    }
    try {
      const perm = await M.requestPermissionsAsync();
      if (!perm?.granted) {
        setError("Microphone permission denied. Enable it in Settings to use voice input.");
        return;
      }
      setListening(true);
      M.start({
        lang: "en-IN",
        interimResults: true,
        continuous: false,
        ...(Platform.OS === "android" ? { androidIntentOptions: {} } : {}),
      });
    } catch (e: any) {
      setListening(false);
      setError(
        "Voice input needs a development build. It is unavailable in Expo Go / web preview."
      );
    }
  }, []);

  const stop = useCallback(() => {
    try {
      Speech?.ExpoSpeechRecognitionModule?.stop?.();
    } catch {}
    setListening(false);
  }, []);

  return { listening, error, start, stop, setError };
}
