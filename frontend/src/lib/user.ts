import { storage } from "@/src/utils/storage";

const KEY = "flow_user_id";
let cached: string | null = null;
let inflight: Promise<string> | null = null;

function genId(): string {
  return "u-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function resolveId(): Promise<string> {
  let id = await storage.getItem<string>(KEY, "");
  if (!id) {
    id = genId();
    await storage.setItem(KEY, id);
  }
  cached = id;
  return id;
}

export async function getUserId(): Promise<string> {
  if (cached) return cached;
  // Single-flight: concurrent callers share one resolution so we never
  // generate two different ids in the same session.
  if (!inflight) inflight = resolveId();
  return inflight;
}
