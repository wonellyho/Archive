import type { VinylSpinState } from "../../hooks/useYouTubePlayer";

interface VinylRecordProps {
  spin: VinylSpinState;
  thumbnailUrl?: string;
  title?: string;
}

/**
 * The record. Rotation is driven entirely by CSS via the `data-spin` attribute
 * (see index.css), so it stays in sync with the player state and respects
 * prefers-reduced-motion.
 */
export function VinylRecord({ spin, thumbnailUrl, title }: VinylRecordProps) {
  return (
    <div className="relative mx-auto aspect-square w-64 max-w-full sm:w-72 lg:w-80">
      <div
        data-spin={spin}
        className="vinyl-disc absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,#2a2730_0_20%,#0a090d_20%_22%,#1a1820_22%_78%,#0a090d_78%_80%,#1a1820_80%)] shadow-2xl"
      >
        {/* Center label / album art — enlarged so the thumbnail reads clearly */}
        <div className="absolute left-1/2 top-1/2 size-[52%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-black/40 bg-ink-soft shadow-inner">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title ? `${title} cover` : ""}
              className="size-full object-cover"
            />
          ) : null}
        </div>
        {/* Spindle hole */}
        <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
      </div>
    </div>
  );
}
