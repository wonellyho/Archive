import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BackgroundContext } from "./backgroundContext";
import type { BackgroundFilter, BackgroundTone, ToneOverride } from "./backgroundContext";
import { processBackgroundImage } from "../utils/backgroundImage";

const STORAGE_KEY = "dumpout:background";
const NAV_OPACITY_KEY = "dumpout:navOpacity";
const DEFAULT_NAV_OPACITY = 90;

const DEFAULT_FILTER_INTENSITY = 60;

interface StoredBackground {
  dataUrl: string;
  detectedTone: BackgroundTone;
  toneOverride: ToneOverride;
  bgOpacity: number;
  filter: BackgroundFilter;
  filterIntensity: number;
}

function readStored(): StoredBackground | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredBackground>;
    if (!parsed.dataUrl) return null;
    return {
      dataUrl: parsed.dataUrl,
      detectedTone: parsed.detectedTone === "dark" ? "dark" : "light",
      toneOverride:
        parsed.toneOverride === "light" || parsed.toneOverride === "dark"
          ? parsed.toneOverride
          : "auto",
      bgOpacity:
        typeof parsed.bgOpacity === "number"
          ? Math.min(100, Math.max(0, parsed.bgOpacity))
          : 100,
      filter:
        parsed.filter === "blur" || parsed.filter === "noir" || parsed.filter === "warm"
          ? parsed.filter
          : "none",
      filterIntensity:
        typeof parsed.filterIntensity === "number"
          ? Math.min(100, Math.max(0, parsed.filterIntensity))
          : DEFAULT_FILTER_INTENSITY,
    };
  } catch {
    return null;
  }
}

function readNavOpacity(): number {
  try {
    const raw = localStorage.getItem(NAV_OPACITY_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_NAV_OPACITY;
  } catch {
    return DEFAULT_NAV_OPACITY;
  }
}

/**
 * Owns site-wide appearance: the custom wallpaper (upload → resize/compress →
 * localStorage), its opacity/filter/text-contrast tone, and the nav bar's
 * glass opacity (#66 background picker → appearance settings). Persisted
 * per-browser, so it survives a refresh but — being localStorage, not the
 * profile record — only shows on the device that set it, not on
 * `/u/:username` for other visitors.
 */
export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredBackground | null>(() => readStored());
  const [navOpacity, setNavOpacityState] = useState<number>(() => readNavOpacity());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (stored) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage full or unavailable (e.g. private browsing) — the wallpaper
      // still works for this session, it just won't survive a refresh.
    }
  }, [stored]);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_OPACITY_KEY, String(navOpacity));
    } catch {
      // Same fallback as above — session-only if storage isn't available.
    }
  }, [navOpacity]);

  const tone: BackgroundTone = stored
    ? stored.toneOverride === "auto"
      ? stored.detectedTone
      : stored.toneOverride
    : "light";

  // Drive the app-wide contrast flip + nav opacity via root attributes/vars,
  // so any component's CSS can react without threading them through props.
  useEffect(() => {
    if (stored) document.documentElement.dataset.bgTone = tone;
    else delete document.documentElement.dataset.bgTone;
  }, [stored, tone]);

  useEffect(() => {
    document.documentElement.style.setProperty("--nav-alpha", String(navOpacity / 100));
  }, [navOpacity]);

  const setImageFromFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const { dataUrl, tone: detectedTone } = await processBackgroundImage(file);
      setStored({
        dataUrl,
        detectedTone,
        toneOverride: "auto",
        bgOpacity: 100,
        filter: "none",
        filterIntensity: DEFAULT_FILTER_INTENSITY,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't use that image.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const setToneOverride = useCallback((value: ToneOverride) => {
    setStored((prev) => (prev ? { ...prev, toneOverride: value } : prev));
  }, []);

  const setBgOpacity = useCallback((value: number) => {
    setStored((prev) => (prev ? { ...prev, bgOpacity: Math.min(100, Math.max(0, value)) } : prev));
  }, []);

  const setFilter = useCallback((value: BackgroundFilter) => {
    setStored((prev) => (prev ? { ...prev, filter: value } : prev));
  }, []);

  const setFilterIntensity = useCallback((value: number) => {
    setStored((prev) =>
      prev ? { ...prev, filterIntensity: Math.min(100, Math.max(0, value)) } : prev,
    );
  }, []);

  const setNavOpacity = useCallback((value: number) => {
    setNavOpacityState(Math.min(100, Math.max(0, value)));
  }, []);

  const clear = useCallback(() => {
    setStored(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      imageUrl: stored?.dataUrl ?? null,
      tone,
      toneOverride: stored?.toneOverride ?? ("auto" as ToneOverride),
      bgOpacity: stored?.bgOpacity ?? 100,
      filter: stored?.filter ?? ("none" as BackgroundFilter),
      filterIntensity: stored?.filterIntensity ?? DEFAULT_FILTER_INTENSITY,
      navOpacity,
      isProcessing,
      error,
      setImageFromFile,
      setToneOverride,
      setBgOpacity,
      setFilter,
      setFilterIntensity,
      setNavOpacity,
      clear,
    }),
    [
      stored,
      tone,
      navOpacity,
      isProcessing,
      error,
      setImageFromFile,
      setToneOverride,
      setBgOpacity,
      setFilter,
      setFilterIntensity,
      setNavOpacity,
      clear,
    ],
  );

  return (
    <BackgroundContext.Provider value={value}>{children}</BackgroundContext.Provider>
  );
}
