import { createContext, useContext } from "react";
import type { BackgroundTone } from "../utils/backgroundImage";

export type { BackgroundTone };
export type ToneOverride = "auto" | BackgroundTone;
export type BackgroundFilter = "none" | "blur" | "noir" | "warm";

export interface BackgroundValue {
  /** Data URL of the custom wallpaper, or null for the default paper texture. */
  imageUrl: string | null;
  /** Tone actually in effect right now (auto-detected, or the override). */
  tone: BackgroundTone;
  toneOverride: ToneOverride;
  /** 0–100. How strongly the wallpaper shows through vs. the paper texture. */
  bgOpacity: number;
  filter: BackgroundFilter;
  /** 0–100. Strength of the selected filter; irrelevant when filter is "none". */
  filterIntensity: number;
  /** 0–100. Opacity of the top nav bar's glass surface. */
  navOpacity: number;
  isProcessing: boolean;
  error: string | null;
  setImageFromFile: (file: File) => Promise<void>;
  setToneOverride: (value: ToneOverride) => void;
  setBgOpacity: (value: number) => void;
  setFilter: (value: BackgroundFilter) => void;
  setFilterIntensity: (value: number) => void;
  setNavOpacity: (value: number) => void;
  clear: () => void;
}

export const BackgroundContext = createContext<BackgroundValue | null>(null);

export function useBackground(): BackgroundValue {
  const ctx = useContext(BackgroundContext);
  if (!ctx) {
    throw new Error("useBackground must be used within a BackgroundProvider");
  }
  return ctx;
}
