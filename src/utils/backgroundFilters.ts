import type { BackgroundFilter } from "../context/backgroundContext";

/**
 * Builds the CSS `filter` value for a preset at a given strength (0–100).
 * At 0 every preset is a no-op — the slider genuinely ramps from "off" to
 * "full effect" rather than jumping straight to a fixed look.
 */
export function buildFilterCss(filter: BackgroundFilter, intensity: number): string {
  const t = Math.min(100, Math.max(0, intensity)) / 100;

  switch (filter) {
    case "blur":
      return t === 0 ? "none" : `blur(${(t * 22).toFixed(1)}px)`;
    case "noir":
      return t === 0
        ? "none"
        : `grayscale(${t.toFixed(2)}) contrast(${(1 + t * 0.3).toFixed(2)}) brightness(${(1 - t * 0.12).toFixed(2)})`;
    case "warm":
      return t === 0
        ? "none"
        : `sepia(${(t * 0.6).toFixed(2)}) saturate(${(1 + t * 0.5).toFixed(2)}) hue-rotate(${(-t * 12).toFixed(1)}deg) brightness(${(1 + t * 0.05).toFixed(2)})`;
    default:
      return "none";
  }
}
