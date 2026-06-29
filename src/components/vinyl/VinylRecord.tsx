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
    <div className="relative mx-auto aspect-square w-56 max-w-full sm:w-64">
      <div
        data-spin={spin}
        className="vinyl-disc absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,#2a2730_0_28%,#0a090d_28%_30%,#1a1820_30%_70%,#0a090d_70%_72%,#1a1820_72%)] shadow-2xl"
      >
        {/* Center label / album art */}
        <div className="absolute left-1/2 top-1/2 size-[38%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-black/40 bg-ink-soft">
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
